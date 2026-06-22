import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireEmailVerified } from '../middleware/auth.middleware';
import { withdrawalRateLimit } from '../middleware/rateLimit.middleware';
import { checkFraudStatus } from '../middleware/fraud.middleware';
import { withdrawalService } from '../../services/withdrawal.service';
import { query } from '../../config/database';
import { sendSuccess, sendError, getPaginationParams } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

const withdrawalSchema = z.object({
  points: z.number().int().positive(),
  method: z.enum(['upi', 'bank_transfer', 'paypal', 'paytm', 'amazon_pay', 'crypto']),
  accountDetails: z.record(z.string()),
});

const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  timezone: z.string().optional(),
  language: z.string().length(2).optional(),
});

// GET /api/user/dashboard
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const [earnings, recentAds, recentTransactions, referralStats] = await Promise.all([
    query<{
      total_points: number; available_points: number;
      lifetime_earnings: number; total_withdrawn: number;
    }>(
      `SELECT total_points, available_points, lifetime_earnings, total_withdrawn
       FROM users WHERE id = $1`,
      [userId]
    ),
    query<{ ad_title: string; points_earned: number; created_at: Date }>(
      `SELECT a.title as ad_title, av.points_earned, av.created_at
       FROM ad_views av JOIN ads a ON av.ad_id = a.id
       WHERE av.user_id = $1 AND av.is_fraud = FALSE
       ORDER BY av.created_at DESC LIMIT 5`,
      [userId]
    ),
    query<{ type: string; points: number; created_at: Date; description: string }>(
      `SELECT type, points, created_at, description
       FROM point_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [userId]
    ),
    query<{ total_referrals: number; active_referrals: number; total_bonus: number }>(
      `SELECT
         COUNT(*) as total_referrals,
         COUNT(*) FILTER (WHERE status = 'active') as active_referrals,
         COALESCE(SUM(bonus_points), 0) as total_bonus
       FROM referrals WHERE referrer_id = $1`,
      [userId]
    ),
  ]);

  sendSuccess(res, {
    earnings: earnings.rows[0],
    recentAds: recentAds.rows,
    recentTransactions: recentTransactions.rows,
    referralStats: referralStats.rows[0],
    referralCode: req.user!.referral_code,
    referralUrl: `${process.env.APP_URL}/register?ref=${req.user!.referral_code}`,
  });
});

// GET /api/user/transactions
router.get('/transactions', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, offset } = getPaginationParams(
    req.query.page as string,
    req.query.limit as string
  );
  const type = req.query.type as string | undefined;

  const { rows } = await query<{ id: string; type: string; points: number; description: string; created_at: Date; total: string }>(
    `SELECT id, type, status, points, balance_after, description, created_at,
            COUNT(*) OVER() as total
     FROM point_transactions
     WHERE user_id = $1 ${type ? 'AND type = $4' : ''}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    type ? [req.user!.id, limit, offset, type] : [req.user!.id, limit, offset]
  );

  sendSuccess(res, {
    transactions: rows,
    total: rows.length > 0 ? parseInt(rows[0].total) : 0,
    page,
    limit,
  });
});

// GET /api/user/referrals
router.get('/referrals', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, offset } = getPaginationParams(
    req.query.page as string,
    req.query.limit as string
  );

  const { rows } = await query<{
    id: string; username: string; full_name: string;
    status: string; bonus_points: number; activated_at: Date;
    created_at: Date; total: string;
  }>(
    `SELECT r.id, u.username, u.full_name, r.status, r.bonus_points,
            r.activated_at, r.created_at, COUNT(*) OVER() as total
     FROM referrals r
     JOIN users u ON r.referred_id = u.id
     WHERE r.referrer_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user!.id, limit, offset]
  );

  sendSuccess(res, {
    referrals: rows,
    total: rows.length > 0 ? parseInt(rows[0].total) : 0,
    page,
    limit,
  });
});

// GET /api/user/withdrawals
router.get('/withdrawals', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit } = getPaginationParams(
    req.query.page as string,
    req.query.limit as string
  );
  const result = await withdrawalService.getWithdrawals(req.user!.id, page, limit);
  sendSuccess(res, result);
});

// POST /api/user/withdraw
router.post(
  '/withdraw',
  requireEmailVerified, checkFraudStatus, withdrawalRateLimit,
  async (req: AuthenticatedRequest, res: Response) => {
    const body = withdrawalSchema.parse(req.body);
    const withdrawal = await withdrawalService.requestWithdrawal(
      req.user!.id, body as import('../../services/withdrawal.service').WithdrawalRequest, req.ip || ''
    );
    sendSuccess(res, { withdrawalId: withdrawal.id }, 'Withdrawal request submitted!', 201);
  }
);

// PATCH /api/user/profile
router.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const body = updateProfileSchema.parse(req.body);
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (body.full_name) { updates.push(`full_name = $${paramIdx++}`); values.push(body.full_name); }
  if (body.timezone) { updates.push(`timezone = $${paramIdx++}`); values.push(body.timezone); }
  if (body.language) { updates.push(`language = $${paramIdx++}`); values.push(body.language); }

  if (updates.length === 0) {
    sendError(res, 'No updates provided', 400);
    return;
  }

  values.push(req.user!.id);
  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    values
  );

  sendSuccess(res, null, 'Profile updated');
});

// GET /api/user/stats — today's ad count, points, streak
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const [todayRows, streakRows] = await Promise.all([
    query<{ ads_watched_today: number; points_today: number }>(
      `SELECT
         COUNT(av.id) FILTER (WHERE av.created_at >= CURRENT_DATE)::int AS ads_watched_today,
         COALESCE(SUM(av.points_earned) FILTER (WHERE av.created_at >= CURRENT_DATE), 0)::int AS points_today
       FROM ad_views av
       WHERE av.user_id = $1 AND av.completed_at IS NOT NULL AND av.is_fraud = FALSE`,
      [userId]
    ),
    // Streak: count consecutive days with at least 1 ad view ending today/yesterday
    query<{ streak_days: number }>(
      `WITH daily AS (
         SELECT DATE(created_at AT TIME ZONE 'UTC') as day
         FROM ad_views
         WHERE user_id = $1 AND completed_at IS NOT NULL AND is_fraud = FALSE
         GROUP BY day
       ),
       gaps AS (
         SELECT day,
                day - (ROW_NUMBER() OVER (ORDER BY day))::int * INTERVAL '1 day' AS grp
         FROM daily
       ),
       streaks AS (
         SELECT grp, MIN(day) as start_day, MAX(day) as end_day,
                COUNT(*) as streak_len
         FROM gaps GROUP BY grp
       )
       SELECT COALESCE(
         (SELECT streak_len FROM streaks
          WHERE end_day >= CURRENT_DATE - INTERVAL '1 day'
          ORDER BY end_day DESC LIMIT 1),
         0
       )::int AS streak_days`,
      [userId]
    ),
  ]);

  sendSuccess(res, {
    ads_watched_today: todayRows.rows[0]?.ads_watched_today ?? 0,
    points_today: todayRows.rows[0]?.points_today ?? 0,
    streak_days: streakRows.rows[0]?.streak_days ?? 0,
  });
});

// GET /api/user/referral-leaderboard
router.get('/referral-leaderboard', async (_req: AuthenticatedRequest, res: Response) => {
  const { rows } = await query<{
    username: string; full_name: string;
    referral_count: string; total_bonus: string;
  }>(
    `SELECT u.username, u.full_name,
            COUNT(r.id) as referral_count,
            SUM(r.bonus_points) as total_bonus
     FROM referrals r
     JOIN users u ON r.referrer_id = u.id
     WHERE r.status = 'active'
     GROUP BY u.id, u.username, u.full_name
     ORDER BY referral_count DESC
     LIMIT 20`
  );
  sendSuccess(res, { leaderboard: rows });
});

export { router as userRouter };
