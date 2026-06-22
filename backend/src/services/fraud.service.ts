import { query } from '../config/database';
import { cacheGet, cacheSet, cacheIncr, CacheKeys } from '../config/redis';
import { logger } from '../utils/logger';
import axios from 'axios';
import { config } from '../config';

interface FraudCheckResult {
  blocked: boolean;
  isFraud: boolean;
  score: number;
  reason?: string;
  flags: string[];
}

interface IPReputationResult {
  is_vpn: boolean;
  is_proxy: boolean;
  is_datacenter: boolean;
  is_tor: boolean;
  risk_score: number;
  country: string;
  isp: string;
}

export const fraudService = {
  async checkPreAdView(
    userId: string,
    adId: string,
    ip: string,
    fingerprint: string
  ): Promise<{ blocked: boolean; score: number; flags: string[] }> {
    const flags: string[] = [];
    let score = 0;

    if (!config.features.fraudDetectionEnabled) {
      return { blocked: false, score: 0, flags: [] };
    }

    // 1. Check IP reputation
    const ipRep = await this.getIPReputation(ip);
    if (ipRep.is_vpn) { flags.push('vpn_detected'); score += 30; }
    if (ipRep.is_proxy) { flags.push('proxy_detected'); score += 25; }
    if (ipRep.is_tor) { flags.push('tor_detected'); score += 50; }
    if (ipRep.is_datacenter) { flags.push('datacenter_ip'); score += 20; }

    // 2. Check view velocity (too many views in short time)
    const velocityKey = `velocity:${userId}:${Math.floor(Date.now() / 60000)}`; // per minute
    const velocityCount = await cacheIncr(velocityKey, 120);
    if (velocityCount > 3) { flags.push('high_velocity'); score += 40; }

    // 3. Check if same fingerprint used by multiple accounts
    const fpUsersKey = `fp_users:${fingerprint}`;
    const fpUsers = await cacheGet<string[]>(fpUsersKey) || [];
    if (!fpUsers.includes(userId)) {
      fpUsers.push(userId);
      await cacheSet(fpUsersKey, fpUsers, 86400);
    }
    if (fpUsers.length > 3) { flags.push('shared_device'); score += 35; }

    // 4. Check same IP multiple accounts
    const { rows: ipAccounts } = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT user_id) as count FROM device_fingerprints
       WHERE ip_address = $1 AND last_seen > NOW() - INTERVAL '24 hours'`,
      [ip]
    );
    if (parseInt(ipAccounts[0]?.count || '0') > 5) {
      flags.push('ip_multiple_accounts');
      score += 30;
    }

    // 5. Check user overall risk score
    const { rows: userRows } = await query<{ risk_score: number; created_at: Date }>(
      `SELECT risk_score, created_at FROM users WHERE id = $1`,
      [userId]
    );
    if (userRows[0]) {
      score += Math.floor(userRows[0].risk_score * 0.3); // Blend user risk
      const accountAgeDays = (Date.now() - new Date(userRows[0].created_at).getTime()) / 86400000;
      if (accountAgeDays < 1) { flags.push('new_account'); score += 15; }
    }

    const blocked = score >= 80;

    if (flags.length > 0) {
      await this.logFraudEvent(userId, 'pre_ad_view_check', score >= 60 ? 'high' : 'medium', {
        flags, score, ip, adId,
      });
    }

    if (blocked) {
      await this.updateUserRiskScore(userId, score);
    }

    return { blocked, score: Math.min(100, score), flags };
  },

  async checkPostAdView(
    userId: string,
    adId: string,
    watchDuration: number,
    watchPercent: number,
    fingerprint: string
  ): Promise<FraudCheckResult> {
    const flags: string[] = [];
    let score = 0;

    // 1. Suspiciously fast completion
    const { rows: adRows } = await query<{ duration_seconds: number | null }>(
      `SELECT duration_seconds FROM ads WHERE id = $1`,
      [adId]
    );
    const expectedDuration = adRows[0]?.duration_seconds;
    if (expectedDuration && watchDuration < expectedDuration * 0.5) {
      flags.push('too_fast_completion');
      score += 50;
    }

    // 2. Perfect watch percentage (suspicious for bot)
    if (watchPercent === 100 && expectedDuration && watchDuration < expectedDuration - 2) {
      flags.push('impossible_completion_time');
      score += 40;
    }

    // 3. Rapid sequential ad views
    const { rows: recentViews } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ad_views
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'
         AND completed_at IS NOT NULL`,
      [userId]
    );
    if (parseInt(recentViews[0]?.count || '0') > 5) {
      flags.push('rapid_ad_completion');
      score += 35;
    }

    const isFraud = score >= 60;

    if (isFraud) {
      await this.logFraudEvent(userId, 'fraud_ad_view', 'high', {
        flags, score, adId, watchDuration, watchPercent,
      });
      await this.updateUserRiskScore(userId, score);
    }

    return {
      blocked: isFraud,
      isFraud,
      score: Math.min(100, score),
      reason: flags.length > 0 ? flags.join(', ') : undefined,
      flags,
    };
  },

  async getIPReputation(ip: string): Promise<IPReputationResult> {
    const cacheKey = CacheKeys.ipReputation(ip);
    const cached = await cacheGet<IPReputationResult>(cacheKey);
    if (cached) return cached;

    // Loopback/private addresses
    if (ip === '127.0.0.1' || ip?.startsWith('192.168.') || ip?.startsWith('10.')) {
      const safe: IPReputationResult = {
        is_vpn: false, is_proxy: false, is_datacenter: false,
        is_tor: false, risk_score: 0, country: 'IN', isp: 'local',
      };
      await cacheSet(cacheKey, safe, 3600);
      return safe;
    }

    try {
      if (config.geo.ipinfoToken) {
        const resp = await axios.get<{
          privacy?: { vpn: boolean; proxy: boolean; tor: boolean; relay: boolean; hosting: boolean };
          country?: string;
          org?: string;
        }>(
          `https://ipinfo.io/${ip}?token=${config.geo.ipinfoToken}`,
          { timeout: 3000 }
        );
        const data = resp.data;
        const result: IPReputationResult = {
          is_vpn: data.privacy?.vpn || false,
          is_proxy: data.privacy?.proxy || false,
          is_datacenter: data.privacy?.hosting || false,
          is_tor: data.privacy?.tor || false,
          risk_score:
            (data.privacy?.vpn ? 30 : 0) +
            (data.privacy?.proxy ? 25 : 0) +
            (data.privacy?.tor ? 50 : 0) +
            (data.privacy?.hosting ? 20 : 0),
          country: data.country || 'XX',
          isp: data.org || 'unknown',
        };
        await cacheSet(cacheKey, result, 86400); // Cache 24 hours
        return result;
      }
    } catch (err) {
      logger.warn(`IP reputation check failed for ${ip}:`, err);
    }

    // Default safe result if service unavailable
    const defaultResult: IPReputationResult = {
      is_vpn: false, is_proxy: false, is_datacenter: false,
      is_tor: false, risk_score: 0, country: 'XX', isp: 'unknown',
    };
    await cacheSet(cacheKey, defaultResult, 1800);
    return defaultResult;
  },

  async logFraudEvent(
    userId: string,
    eventType: string,
    severity: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO fraud_events (user_id, event_type, severity, description, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId, eventType, severity,
          `Fraud detected: ${eventType}`,
          JSON.stringify(metadata),
        ]
      );
    } catch (err) {
      logger.error('Failed to log fraud event:', err);
    }
  },

  async updateUserRiskScore(userId: string, newScore: number): Promise<void> {
    try {
      // Weighted average with existing score
      const { rows } = await query<{ risk_score: number }>(
        `SELECT risk_score FROM users WHERE id = $1`,
        [userId]
      );
      const currentScore = rows[0]?.risk_score || 0;
      const blendedScore = Math.min(100, Math.round(currentScore * 0.7 + newScore * 0.3));

      await query(
        `UPDATE users SET risk_score = $1, is_flagged = ($1 >= 50) WHERE id = $2`,
        [blendedScore, userId]
      );

      // Auto-suspend at threshold
      if (blendedScore >= 90) {
        await query(
          `UPDATE users SET status = 'suspended', suspended_at = NOW(),
             suspended_reason = 'Automated fraud detection'
           WHERE id = $1 AND status = 'active'`,
          [userId]
        );
        await this.logFraudEvent(userId, 'auto_suspend', 'critical', {
          risk_score: blendedScore,
        });
      }
    } catch (err) {
      logger.error('Failed to update risk score:', err);
    }
  },

  async checkDuplicateAccounts(email: string, phone?: string, ip?: string): Promise<boolean> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users
       WHERE email = $1
          OR ($2::text IS NOT NULL AND phone = $2)
          OR ($3::inet IS NOT NULL AND last_ip = $3 AND created_at > NOW() - INTERVAL '1 hour')`,
      [email, phone || null, ip || null]
    );
    return parseInt(rows[0]?.count || '0') > 0;
  },
};
