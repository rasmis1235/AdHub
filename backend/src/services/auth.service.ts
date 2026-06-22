import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query, transaction } from '../config/database';
import { cacheSet, cacheDel, CacheKeys } from '../config/redis';
import { generateReferralCode, generateToken } from '../utils/crypto';
import { emailService } from './email.service';
import { AppError } from '../api/middleware/error.middleware';
import { User, JwtPayload } from '../types';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const ACCESS_TOKEN_EXPIRY = config.jwt.accessExpiry;

export interface RegisterPayload {
  email: string;
  username: string;
  full_name: string;
  password: string;
  referral_code?: string;
}

export interface LoginResult {
  user: Omit<User, 'password_hash'>;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async register(payload: RegisterPayload, ip: string): Promise<{ userId: string }> {
    const { email, username, full_name, password, referral_code } = payload;

    // Check existing user
    const { rows: existing } = await query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.length > 0) {
      throw new AppError('Email or username already registered', 409);
    }

    // Resolve referral
    let referrerId: string | null = null;
    if (referral_code && config.features.referralEnabled) {
      const { rows: referrer } = await query<{ id: string; status: string }>(
        'SELECT id, status FROM users WHERE referral_code = $1',
        [referral_code.toUpperCase()]
      );
      if (referrer[0]?.status === 'active') {
        referrerId = referrer[0].id;
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const newReferralCode = generateReferralCode(username);
    const verificationToken = generateToken(32);

    const userId = await transaction(async (client) => {
      // Create user
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users
          (email, username, password_hash, full_name, referral_code, referred_by, status, last_ip)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING id`,
        [email.toLowerCase(), username.toLowerCase(), passwordHash, full_name,
         newReferralCode, referrerId, ip]
      );
      const userId = rows[0].id;

      // Create email verification token
      await client.query(
        `INSERT INTO verification_tokens (user_id, token, type, expires_at)
         VALUES ($1, $2, 'email_verify', NOW() + INTERVAL '24 hours')`,
        [userId, verificationToken]
      );

      // Welcome bonus
      const { rows: settings } = await client.query<{ value: { amount: number } }>(
        `SELECT value FROM platform_settings WHERE key = 'new_user_bonus_points'`
      );
      const bonusPoints = settings[0]?.value?.amount || 50;

      await client.query(
        `UPDATE users SET
           total_points = total_points + $1,
           available_points = available_points + $1,
           lifetime_earnings = lifetime_earnings + $1
         WHERE id = $2`,
        [bonusPoints, userId]
      );

      await client.query(
        `INSERT INTO point_transactions
          (user_id, type, status, points, balance_before, balance_after, description)
         VALUES ($1, 'bonus', 'completed', $2, 0, $2, 'Welcome bonus')`,
        [userId, bonusPoints]
      );

      // Create referral record
      if (referrerId) {
        await client.query(
          `INSERT INTO referrals (referrer_id, referred_id, referral_code)
           VALUES ($1, $2, $3)`,
          [referrerId, userId, referral_code]
        );
      }

      return userId;
    });

    // Send verification email (non-blocking)
    emailService
      .sendVerificationEmail(email, full_name, verificationToken)
      .catch((err) => console.error('Email send failed:', err));

    return { userId };
  },

  async verifyEmail(token: string): Promise<void> {
    const { rows } = await query<{ id: string; user_id: string; used_at: Date | null }>(
      `SELECT id, user_id, used_at FROM verification_tokens
       WHERE token = $1 AND type = 'email_verify' AND expires_at > NOW()`,
      [token]
    );

    if (!rows[0]) throw new AppError('Invalid or expired verification token', 400);
    if (rows[0].used_at) throw new AppError('Token already used', 400);

    await transaction(async (client) => {
      await client.query(
        `UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), status = 'active'
         WHERE id = $1`,
        [rows[0].user_id]
      );
      await client.query(
        `UPDATE verification_tokens SET used_at = NOW() WHERE id = $1`,
        [rows[0].id]
      );

      // Activate referral if exists
      await client.query(
        `UPDATE referrals SET status = 'active', activated_at = NOW()
         WHERE referred_id = $1 AND status = 'pending'`,
        [rows[0].user_id]
      );
    });

    // Award referral bonus
    await this.processReferralBonus(rows[0].user_id);
    await cacheDel(CacheKeys.user(rows[0].user_id));
  },

  async processReferralBonus(referredId: string): Promise<void> {
    const { rows: referral } = await query<{ id: string; referrer_id: string }>(
      `SELECT id, referrer_id FROM referrals
       WHERE referred_id = $1 AND status = 'active' AND bonus_paid_at IS NULL`,
      [referredId]
    );
    if (!referral[0]) return;

    const { rows: settings } = await query<{ value: { l1: number } }>(
      `SELECT value FROM platform_settings WHERE key = 'referral_bonus_points'`
    );
    const l1Bonus = settings[0]?.value?.l1 || 100;

    await transaction(async (client) => {
      const { rows: referrer } = await client.query<{ available_points: number }>(
        'SELECT available_points FROM users WHERE id = $1 FOR UPDATE',
        [referral[0].referrer_id]
      );

      const balanceBefore = referrer[0].available_points;
      await client.query(
        `UPDATE users SET
           total_points = total_points + $1,
           available_points = available_points + $1,
           lifetime_earnings = lifetime_earnings + $1
         WHERE id = $2`,
        [l1Bonus, referral[0].referrer_id]
      );

      await client.query(
        `INSERT INTO point_transactions
          (user_id, type, status, points, balance_before, balance_after, referral_id, description)
         VALUES ($1, 'referral_bonus', 'completed', $2, $3, $4, $5, 'Referral bonus - new user verified')`,
        [referral[0].referrer_id, l1Bonus, balanceBefore, balanceBefore + l1Bonus, referral[0].id]
      );

      await client.query(
        `UPDATE referrals SET bonus_points = $1, bonus_paid_at = NOW() WHERE id = $2`,
        [l1Bonus, referral[0].id]
      );
    });

    await cacheDel(CacheKeys.user(referral[0].referrer_id));
  },

  async login(
    emailOrUsername: string,
    password: string,
    ip: string,
    deviceInfo: Record<string, string>
  ): Promise<LoginResult> {
    const { rows } = await query<User & { password_hash: string }>(
      `SELECT * FROM users
       WHERE (email = $1 OR username = $1) AND deleted_at IS NULL`,
      [emailOrUsername.toLowerCase()]
    );

    const user = rows[0];
    if (!user) throw new AppError('Invalid credentials', 401);

    if (!user.password_hash) {
      throw new AppError('Please login with Google', 400);
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) throw new AppError('Invalid credentials', 401);

    if (user.status === 'pending') {
      throw new AppError('Please verify your email before logging in', 403);
    }
    if (user.status === 'banned') throw new AppError('Account banned. Contact support.', 403);
    if (user.status === 'suspended') throw new AppError('Account suspended. Contact support.', 403);

    return this.createSession(user, ip, deviceInfo);
  },

  async createSession(
    user: User,
    ip: string,
    deviceInfo: Record<string, string>
  ): Promise<LoginResult> {
    const refreshToken = generateToken(64);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Normalize UAParser OS name → DB enum value
    const normalizeOS = (raw: string): string => {
      const s = (raw || '').toLowerCase();
      if (s.includes('android')) return 'android';
      if (s.includes('ios') || s.includes('iphone') || s.includes('ipad')) return 'ios';
      if (s.includes('win')) return 'windows';
      if (s.includes('mac') || s.includes('darwin')) return 'macos';
      if (s.includes('linux') || s.includes('ubuntu')) return 'linux';
      return 'other';
    };

    // Normalize device type to enum
    const normalizeDevice = (raw: string): string => {
      if (raw === 'mobile') return 'mobile';
      if (raw === 'tablet') return 'tablet';
      return 'desktop';
    };

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO user_sessions
           (user_id, refresh_token, device_type, device_name, os, browser, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id, refreshToken,
          normalizeDevice(deviceInfo.type),
          deviceInfo.name || null,
          normalizeOS(deviceInfo.os),
          deviceInfo.browser || 'unknown',
          ip, expiresAt
        ]
      );

      await client.query(
        `UPDATE users SET last_login_at = NOW(), last_ip = $1 WHERE id = $2`,
        [ip, user.id]
      );
    });

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    // Cache user (exclude password_hash) — non-blocking, Redis failure must not block login
    const { ...safeUser } = user as User & { password_hash?: string };
    delete safeUser.password_hash;
    cacheSet(CacheKeys.user(user.id), safeUser, 900).catch(() => {});

    return { user: safeUser as User, accessToken, refreshToken };
  },

  async refreshToken(
    token: string,
    ip: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { rows } = await query<{
      id: string;
      user_id: string;
      is_active: boolean;
      expires_at: Date;
    }>(
      `SELECT s.*, u.status, u.role, u.email
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token = $1`,
      [token]
    );

    const session = rows[0];
    if (!session?.is_active) throw new AppError('Invalid refresh token', 401);
    if (new Date(session.expires_at) < new Date()) {
      await query(`UPDATE user_sessions SET is_active = FALSE WHERE id = $1`, [session.id]);
      throw new AppError('Session expired, please login again', 401);
    }

    // Rotate refresh token
    const newRefreshToken = generateToken(64);
    const newExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE user_sessions SET refresh_token = $1, expires_at = $2, last_used_at = NOW()
       WHERE id = $3`,
      [newRefreshToken, newExpiry, session.id]
    );

    const { rows: userRows } = await query<User>(`SELECT * FROM users WHERE id = $1`, [
      session.user_id,
    ]);
    const user = userRows[0];

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    } as jwt.SignOptions);

    await cacheSet(CacheKeys.user(user.id), user, 900);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string): Promise<void> {
    await query(
      `UPDATE user_sessions SET is_active = FALSE WHERE refresh_token = $1`,
      [refreshToken]
    );
  },

  async forgotPassword(email: string): Promise<void> {
    const { rows } = await query<User>(
      `SELECT id, email, full_name FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    if (!rows[0]) return; // Silent fail for security

    const token = generateToken(32);
    await query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES ($1, $2, 'password_reset', NOW() + INTERVAL '1 hour')
       ON CONFLICT DO NOTHING`,
      [rows[0].id, token]
    );

    emailService.sendPasswordResetEmail(email, rows[0].full_name, token).catch(() => {});
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { rows } = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM verification_tokens
       WHERE token = $1 AND type = 'password_reset'
         AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );
    if (!rows[0]) throw new AppError('Invalid or expired reset token', 400);

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await transaction(async (client) => {
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        hash, rows[0].user_id,
      ]);
      await client.query(`UPDATE verification_tokens SET used_at = NOW() WHERE id = $1`, [
        rows[0].id,
      ]);
      // Invalidate all sessions
      await client.query(
        `UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1`,
        [rows[0].user_id]
      );
    });

    await cacheDel(CacheKeys.user(rows[0].user_id));
  },
};
