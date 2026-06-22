import { query, transaction } from '../config/database';
import { cacheGet, cacheSet, cacheIncr, CacheKeys } from '../config/redis';
import { AppError } from '../api/middleware/error.middleware';
import { fraudService } from './fraud.service';
import { Ad, AdView, User } from '../types';
import dayjs from 'dayjs';

// Redis calls must never block core ad logic — 1s timeout fallback
const safeCache = {
  get: <T>(key: string) =>
    Promise.race([cacheGet<T>(key), new Promise<null>((r) => setTimeout(() => r(null), 1000))]),
  incr: (key: string, ttl?: number) =>
    cacheIncr(key, ttl).catch(() => 0),
  set: (key: string, val: unknown, ttl?: number) =>
    cacheSet(key, val, ttl).catch(() => {}),
};

export interface AdViewPayload {
  adId: string;
  watchDuration: number;
  watchPercent: number;
  wasClicked: boolean;
  wasConverted: boolean;
  fingerprint: string;
  sessionId?: string;
}

export const adService = {
  async getAvailableAds(user: User, deviceType: string, country: string): Promise<Ad[]> {
    const today = dayjs().format('YYYY-MM-DD');
    const dailyCountKey = CacheKeys.dailyAdCount(user.id, today);

    // Check daily limit
    const { rows: settings } = await query<{ value: { default: number } }>(
      `SELECT value FROM platform_settings WHERE key = 'max_ads_per_day'`
    );
    const maxAdsPerDay = settings[0]?.value?.default || 20;

    const dailyCount = parseInt((await safeCache.get<string>(dailyCountKey)) || '0');
    if (dailyCount >= maxAdsPerDay) {
      return [];
    }

    // Fetch ads: active, not expired, matching device/country, respecting cooldown
    const { rows: ads } = await query<Ad>(
      `SELECT a.* FROM ads a
       WHERE a.status = 'active'
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
         AND (a.daily_cap IS NULL OR a.views_today < a.daily_cap)
         AND (a.total_cap IS NULL OR a.total_views < a.total_cap)
         AND a.target_countries @> $1::jsonb
         AND a.target_devices @> $2::jsonb
         AND NOT EXISTS (
           SELECT 1 FROM ad_views av
           WHERE av.user_id = $3
             AND av.ad_id = a.id
             AND av.is_fraud = FALSE
             AND av.created_at > NOW() - (a.cooldown_hours || ' hours')::INTERVAL
         )
       ORDER BY a.cpm_rate DESC NULLS LAST, RANDOM()
       LIMIT 10`,
      [JSON.stringify([country]), JSON.stringify([deviceType]), user.id]
    );

    return ads;
  },

  async startAdView(
    userId: string,
    adId: string,
    sessionId: string | undefined,
    ip: string,
    userAgent: string,
    deviceType: string,
    country: string,
    fingerprint: string
  ): Promise<string> {
    // Verify ad exists and is active
    const { rows: ads } = await query<Ad>(
      `SELECT * FROM ads WHERE id = $1 AND status = 'active'`,
      [adId]
    );
    if (!ads[0]) throw new AppError('Ad not available', 404);
    const ad = ads[0];

    // Pre-fraud check
    const fraudResult = await fraudService.checkPreAdView(userId, adId, ip, fingerprint);
    if (fraudResult.blocked) {
      throw new AppError('Action not allowed', 403);
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO ad_views
         (user_id, ad_id, session_id, device_type, ip_address, country, user_agent,
          fraud_score, is_fraud)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId, adId, sessionId || null,
        deviceType, ip, country, userAgent,
        fraudResult.score, fraudResult.score >= 70,
      ]
    );

    return rows[0].id;
  },

  async completeAdView(
    viewId: string,
    userId: string,
    payload: Omit<AdViewPayload, 'adId' | 'sessionId'>
  ): Promise<{ pointsEarned: number; message: string }> {
    const { watchDuration, watchPercent, wasClicked, wasConverted, fingerprint } = payload;

    // Fetch the view record
    const { rows: views } = await query<AdView & { ad_type: string; min_watch_percent: number; points_per_view: number; points_per_click: number; points_per_completion: number; cooldown_hours: number }>(
      `SELECT av.*, a.ad_type, a.min_watch_percent, a.points_per_view,
              a.points_per_click, a.points_per_completion, a.cooldown_hours
       FROM ad_views av
       JOIN ads a ON av.ad_id = a.id
       WHERE av.id = $1 AND av.user_id = $2
         AND av.completed_at IS NULL AND av.is_fraud = FALSE`,
      [viewId, userId]
    );

    if (!views[0]) throw new AppError('Invalid view session', 400);
    const view = views[0];

    // Validate watch percentage
    if (watchPercent < view.min_watch_percent) {
      throw new AppError(`Must watch at least ${view.min_watch_percent}% of the ad`, 400);
    }

    // Post-completion fraud check
    const fraudCheck = await fraudService.checkPostAdView(
      userId, view.ad_id, watchDuration, watchPercent, fingerprint
    );

    let pointsEarned = 0;
    if (!fraudCheck.isFraud) {
      pointsEarned += view.points_per_view;
      if (wasClicked) pointsEarned += view.points_per_click;
      if (wasConverted) pointsEarned += view.points_per_completion;
    }

    await transaction(async (client) => {
      // Update view record
      await client.query(
        `UPDATE ad_views SET
           completed_at = NOW(),
           watch_duration = $1,
           watch_percent = $2,
           was_clicked = $3,
           clicked_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
           was_converted = $4,
           converted_at = CASE WHEN $4 THEN NOW() ELSE NULL END,
           points_earned = $5,
           points_awarded_at = CASE WHEN $5 > 0 THEN NOW() ELSE NULL END,
           is_fraud = $6,
           fraud_reason = $7,
           fraud_score = $8
         WHERE id = $9`,
        [
          watchDuration, watchPercent, wasClicked, wasConverted,
          pointsEarned, fraudCheck.isFraud, fraudCheck.reason,
          fraudCheck.score, viewId,
        ]
      );

      // Update ad stats
      await client.query(
        `UPDATE ads SET total_views = total_views + 1, views_today = views_today + 1
         WHERE id = $1`,
        [view.ad_id]
      );

      // Award points if not fraud
      if (pointsEarned > 0) {
        const { rows: userRows } = await client.query<{ available_points: number }>(
          `SELECT available_points FROM users WHERE id = $1 FOR UPDATE`,
          [userId]
        );
        const balanceBefore = userRows[0].available_points;

        await client.query(
          `UPDATE users SET
             total_points = total_points + $1,
             available_points = available_points + $1,
             lifetime_earnings = lifetime_earnings + $1
           WHERE id = $2`,
          [pointsEarned, userId]
        );

        await client.query(
          `INSERT INTO point_transactions
             (user_id, type, status, points, balance_before, balance_after, ad_view_id, description)
           VALUES ($1, 'ad_completion', 'completed', $2, $3, $4, $5, $6)`,
          [
            userId, pointsEarned, balanceBefore, balanceBefore + pointsEarned,
            viewId, `Ad completed: earned ${pointsEarned} points`,
          ]
        );
      }
    });

    // Update daily count in cache
    const today = dayjs().format('YYYY-MM-DD');
    safeCache.incr(CacheKeys.dailyAdCount(userId, today), 86400);

    return {
      pointsEarned,
      message: fraudCheck.isFraud
        ? 'Ad recorded. Points pending review.'
        : `You earned ${pointsEarned} points!`,
    };
  },

  async getUserAdHistory(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ views: AdView[]; total: number }> {
    const offset = (page - 1) * limit;
    const { rows } = await query<AdView & { total: string; ad_title: string }>(
      `SELECT av.*, a.title as ad_title, COUNT(*) OVER() as total
       FROM ad_views av
       JOIN ads a ON av.ad_id = a.id
       WHERE av.user_id = $1
       ORDER BY av.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      views: rows,
      total: rows.length > 0 ? parseInt(rows[0].total || '0') : 0,
    };
  },
};
