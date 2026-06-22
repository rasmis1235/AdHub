import { Response, NextFunction } from 'express';
import UAParser from 'ua-parser-js';
import { AuthenticatedRequest, DeviceInfo } from '../../types';
import { query } from '../../config/database';
import { cacheGet, cacheSet, CacheKeys } from '../../config/redis';
import { hashFingerprint } from '../../utils/crypto';
import { logger } from '../../utils/logger';

// Attach device and geo info to request
export async function attachDeviceInfo(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ua = req.headers['user-agent'] || '';
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const deviceType =
      result.device.type === 'mobile'
        ? 'mobile'
        : result.device.type === 'tablet'
        ? 'tablet'
        : 'desktop';

    const deviceInfo: DeviceInfo = {
      type: deviceType,
      os: result.os.name || 'other',
      os_version: result.os.version,
      browser: result.browser.name || 'unknown',
      browser_version: result.browser.version,
      is_bot: /bot|crawler|spider|scraper/i.test(ua),
    };

    (req as AuthenticatedRequest & { deviceInfo?: DeviceInfo }).deviceInfo = deviceInfo;

    // Build fingerprint from available signals
    const fingerprintData = {
      ua,
      ip: req.ip,
      accept_language: req.headers['accept-language'] || '',
      accept_encoding: req.headers['accept-encoding'] || '',
    };
    req.deviceFingerprint = hashFingerprint(fingerprintData);

    next();
  } catch (error) {
    logger.warn('Device info parsing error:', error);
    next();
  }
}

// Block bots from ad endpoints
export function blockBots(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const ua = req.headers['user-agent'] || '';
  const botPatterns = /bot|crawler|spider|scraper|headless|phantom|selenium|puppeteer/i;

  if (botPatterns.test(ua) || !ua) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }
  next();
}

// Record device fingerprint after authenticated request
export async function recordFingerprint(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.deviceFingerprint) return next();

  try {
    const cacheKey = `fp:${req.user.id}:${req.deviceFingerprint}`;
    const cached = await cacheGet(cacheKey);
    if (!cached) {
      await query(
        `INSERT INTO device_fingerprints
           (user_id, fingerprint_hash, ip_address, view_count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, fingerprint_hash)
         DO UPDATE SET
           last_seen = NOW(),
           view_count = device_fingerprints.view_count + 1`,
        [req.user.id, req.deviceFingerprint, req.ip]
      );
      await cacheSet(cacheKey, true, 3600);
    }
  } catch (error) {
    logger.warn('Fingerprint recording error:', error);
  }
  next();
}

// Check if user is flagged for fraud before sensitive operations
export async function checkFraudStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) return next();

  if (req.user.risk_score >= 90) {
    res.status(403).json({
      success: false,
      error: 'Account flagged for review. Contact support.',
    });
    return;
  }

  if (req.user.is_flagged) {
    const { rows } = await query<{ resolved: boolean }>(
      `SELECT resolved FROM fraud_events
       WHERE user_id = $1 AND severity IN ('high','critical') AND resolved = FALSE
       LIMIT 1`,
      [req.user.id]
    );
    if (rows.length > 0) {
      res.status(403).json({
        success: false,
        error: 'Account under review. Please contact support.',
      });
      return;
    }
  }

  next();
}
