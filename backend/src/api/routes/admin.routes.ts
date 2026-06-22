import { Router, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { withdrawalService } from '../../services/withdrawal.service';
import { query } from '../../config/database';
import { sendSuccess, getPaginationParams } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

// Helper to cast AuthenticatedRequest handlers to RequestHandler for Router compatibility
const h = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>): RequestHandler =>
  fn as unknown as RequestHandler;

const router = Router();
router.use(authenticate, requireAdmin);

// ============================================================
// DASHBOARD / ANALYTICS
// ============================================================

// GET /api/admin/stats
router.get('/stats', async (_req: AuthenticatedRequest, res: Response) => {
  const [users, revenue, ads, withdrawals, fraud] = await Promise.all([
    query<{
      total: string; active: string; pending: string;
      new_today: string; new_this_week: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_today,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week
       FROM users WHERE deleted_at IS NULL`
    ),
    query<{
      total_views: string; today_views: string;
      total_revenue: string; today_revenue: string;
    }>(
      `SELECT
         COUNT(*) as total_views,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today_views,
         COALESCE(SUM(revenue_earned), 0) as total_revenue,
         COALESCE(SUM(revenue_earned) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) as today_revenue
       FROM ad_views WHERE is_fraud = FALSE`
    ),
    query<{ total: string; active: string }>(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM ads`
    ),
    query<{ pending_count: string; pending_amount: string }>(
      `SELECT COUNT(*) as pending_count, COALESCE(SUM(amount_inr), 0) as pending_amount
       FROM withdrawals WHERE status = 'pending'`
    ),
    query<{ flagged_users: string; open_events: string }>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE is_flagged = TRUE) as flagged_users,
         (SELECT COUNT(*) FROM fraud_events WHERE resolved = FALSE) as open_events`
    ),
  ]);

  sendSuccess(res, {
    users: users.rows[0],
    revenue: revenue.rows[0],
    ads: ads.rows[0],
    withdrawals: withdrawals.rows[0],
    fraud: fraud.rows[0],
  });
});

// GET /api/admin/revenue/chart?days=30
router.get('/revenue/chart', async (req: AuthenticatedRequest, res: Response) => {
  const days = Math.min(90, parseInt(req.query.days as string || '30'));
  const { rows } = await query<{
    date: string; views: string; revenue: string; unique_users: string;
  }>(
    `SELECT
       DATE(created_at) as date,
       COUNT(*) as views,
       COALESCE(SUM(revenue_earned), 0) as revenue,
       COUNT(DISTINCT user_id) as unique_users
     FROM ad_views
     WHERE is_fraud = FALSE AND created_at > NOW() - ($1 || ' days')::INTERVAL
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [days]
  );
  sendSuccess(res, { chart: rows });
});

// ============================================================
// USER MANAGEMENT
// ============================================================

// GET /api/admin/users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, offset } = getPaginationParams(
    req.query.page as string, req.query.limit as string
  );
  const search = req.query.search as string || '';
  const status = req.query.status as string || '';

  const { rows } = await query<{
    id: string; email: string; username: string; full_name: string;
    status: string; role: string; total_points: number; risk_score: number;
    created_at: Date; is_flagged: boolean; total: string;
  }>(
    `SELECT id, email, username, full_name, status, role, total_points,
            available_points, lifetime_earnings, risk_score, is_flagged,
            created_at, last_login_at, country, COUNT(*) OVER() as total
     FROM users
     WHERE deleted_at IS NULL
       AND ($1 = '' OR email ILIKE $1 OR username ILIKE $1 OR full_name ILIKE $1)
       AND ($2 = '' OR status = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [`%${search}%`, status, limit, offset]
  );

  sendSuccess(res, {
    users: rows,
    total: rows.length > 0 ? parseInt(rows[0].total) : 0,
    page, limit,
  });
});

// PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  const statusSchema = z.object({
    status: z.enum(['active', 'suspended', 'banned']),
    reason: z.string().optional(),
  });
  const { status, reason } = statusSchema.parse(req.body);

  await query(
    `UPDATE users SET status = $1, suspended_reason = $2,
       suspended_at = CASE WHEN $1 IN ('suspended', 'banned') THEN NOW() ELSE NULL END
     WHERE id = $3`,
    [status, reason || null, req.params.id]
  );

  await query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_value)
     VALUES ($1, 'user_status_change', 'user', $2, $3)`,
    [req.user!.id, req.params.id, JSON.stringify({ status, reason })]
  );

  sendSuccess(res, null, `User ${status}`);
});

// ============================================================
// AD MANAGEMENT
// ============================================================

// GET /api/admin/ads
router.get('/ads', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, offset } = getPaginationParams(
    req.query.page as string, req.query.limit as string
  );

  const { rows } = await query<{
    id: string; title: string; ad_type: string; status: string;
    total_views: number; cpm_rate: number; created_at: Date; total: string;
  }>(
    `SELECT a.*, pc.name as provider_name, COUNT(*) OVER() as total
     FROM ads a
     LEFT JOIN ad_provider_configs pc ON a.provider_id = pc.id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  sendSuccess(res, {
    ads: rows,
    total: rows.length > 0 ? parseInt(rows[0].total) : 0,
    page, limit,
  });
});

// POST /api/admin/ads
router.post('/ads', async (req: AuthenticatedRequest, res: Response) => {
  const adSchema = z.object({
    title: z.string().min(2).max(200),
    description: z.string().optional(),
    ad_type: z.enum(['video', 'banner', 'interstitial', 'rewarded', 'native']),
    media_url: z.string().url().optional(),
    click_url: z.string().url().optional(),
    duration_seconds: z.number().int().min(5).max(300).optional(),
    target_countries: z.array(z.string().length(2)).default(['IN']),
    target_devices: z.array(z.string()).default(['mobile', 'desktop', 'tablet']),
    points_per_view: z.number().int().min(0).default(2),
    points_per_click: z.number().int().min(0).default(5),
    points_per_completion: z.number().int().min(0).default(10),
    cpm_rate: z.number().min(0).optional(),
    daily_cap: z.number().int().positive().optional(),
    cooldown_hours: z.number().int().min(1).default(24),
    min_watch_percent: z.number().int().min(0).max(100).default(80),
    expires_at: z.string().datetime().optional(),
  });

  const body = adSchema.parse(req.body);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO ads
       (title, description, ad_type, status, media_url, click_url, duration_seconds,
        target_countries, target_devices, points_per_view, points_per_click,
        points_per_completion, cpm_rate, daily_cap, cooldown_hours, min_watch_percent, expires_at)
     VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      body.title, body.description || null, body.ad_type, body.media_url || null,
      body.click_url || null, body.duration_seconds || null,
      JSON.stringify(body.target_countries), JSON.stringify(body.target_devices),
      body.points_per_view, body.points_per_click, body.points_per_completion,
      body.cpm_rate || null, body.daily_cap || null, body.cooldown_hours,
      body.min_watch_percent, body.expires_at || null,
    ]
  );

  sendSuccess(res, { adId: rows[0].id }, 'Ad created', 201);
});

// ============================================================
// WITHDRAWAL MANAGEMENT
// ============================================================

// GET /api/admin/withdrawals
router.get('/withdrawals', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, offset } = getPaginationParams(
    req.query.page as string, req.query.limit as string
  );
  const status = req.query.status as string || 'pending';

  const { rows } = await query<{
    id: string; user_email: string; username: string;
    points_requested: number; amount_inr: number;
    method: string; status: string; requested_at: Date; total: string;
  }>(
    `SELECT w.id, u.email as user_email, u.username, w.points_requested,
            w.points_net, w.amount_inr, w.method, w.status,
            w.requested_at, w.ip_address, COUNT(*) OVER() as total
     FROM withdrawals w
     JOIN users u ON w.user_id = u.id
     WHERE ($1 = '' OR w.status = $1)
     ORDER BY w.requested_at DESC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );

  sendSuccess(res, {
    withdrawals: rows,
    total: rows.length > 0 ? parseInt(rows[0].total) : 0,
    page, limit,
  });
});

// POST /api/admin/withdrawals/:id/process
router.post('/withdrawals/:id/process', async (req: AuthenticatedRequest, res: Response) => {
  const processSchema = z.object({
    action: z.enum(['approve', 'reject']),
    note: z.string().optional(),
    paymentReference: z.string().optional(),
  });

  const { action, note, paymentReference } = processSchema.parse(req.body);
  await withdrawalService.processWithdrawal(
    req.params.id, req.user!.id, action, note, paymentReference
  );

  sendSuccess(res, null, `Withdrawal ${action}d`);
});

// ============================================================
// FRAUD MONITORING
// ============================================================

// GET /api/admin/fraud/events
router.get('/fraud/events', async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, offset } = getPaginationParams(
    req.query.page as string, req.query.limit as string
  );

  const { rows } = await query<{
    id: string; username: string; event_type: string;
    severity: string; description: string; created_at: Date; total: string;
  }>(
    `SELECT fe.id, u.username, u.email, fe.event_type, fe.severity,
            fe.description, fe.metadata, fe.resolved, fe.created_at,
            COUNT(*) OVER() as total
     FROM fraud_events fe
     LEFT JOIN users u ON fe.user_id = u.id
     WHERE ($1 = TRUE OR fe.resolved = FALSE)
     ORDER BY fe.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.query.all === 'true', limit, offset]
  );

  sendSuccess(res, {
    events: rows,
    total: rows.length > 0 ? parseInt(rows[0].total) : 0,
    page, limit,
  });
});

// PATCH /api/admin/fraud/events/:id/resolve
router.patch('/fraud/events/:id/resolve', async (req: AuthenticatedRequest, res: Response) => {
  await query(
    `UPDATE fraud_events SET resolved = TRUE, reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2`,
    [req.user!.id, req.params.id]
  );
  sendSuccess(res, null, 'Fraud event resolved');
});

// GET /api/admin/platform-settings
router.get('/platform-settings', async (_req: AuthenticatedRequest, res: Response) => {
  const { rows } = await query(`SELECT * FROM platform_settings ORDER BY key`);
  sendSuccess(res, { settings: rows });
});

// PUT /api/admin/platform-settings/:key
router.put('/platform-settings/:key', async (req: AuthenticatedRequest, res: Response) => {
  const { value } = z.object({ value: z.record(z.unknown()) }).parse(req.body);
  await query(
    `UPDATE platform_settings SET value = $1, updated_by = $2, updated_at = NOW()
     WHERE key = $3`,
    [JSON.stringify(value), req.user!.id, req.params.key]
  );
  sendSuccess(res, null, 'Setting updated');
});

export { router as adminRouter };
