import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireEmailVerified } from '../middleware/auth.middleware';
import { adViewRateLimit } from '../middleware/rateLimit.middleware';
import { blockBots, attachDeviceInfo, recordFingerprint, checkFraudStatus } from '../middleware/fraud.middleware';
import { adService } from '../../services/ad.service';
import { sendSuccess } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const router = Router();

const completeViewSchema = z.object({
  viewId: z.string().uuid(),
  watchDuration: z.number().min(0).max(7200),
  watchPercent: z.number().min(0).max(100),
  wasClicked: z.boolean().default(false),
  wasConverted: z.boolean().default(false),
  fingerprint: z.string().min(1),
});

// All ad routes require auth, verified email, and fraud checks
router.use(authenticate, requireEmailVerified, attachDeviceInfo, recordFingerprint, checkFraudStatus);

// GET /api/ads - get available ads for user
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const deviceType = (req as AuthenticatedRequest & { deviceInfo?: { type: string } }).deviceInfo?.type || 'desktop';
  const country = req.headers['cf-ipcountry'] as string || user.country || 'IN';

  const ads = await adService.getAvailableAds(user, deviceType, country);
  sendSuccess(res, { ads, count: ads.length });
});

// POST /api/ads/:adId/start - start watching an ad
router.post('/:adId/start', blockBots, adViewRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  const { adId } = req.params;
  const user = req.user!;
  const deviceInfo = (req as AuthenticatedRequest & { deviceInfo?: { type: string } }).deviceInfo;
  const country = req.headers['cf-ipcountry'] as string || user.country || 'IN';

  const viewId = await adService.startAdView(
    user.id, adId,
    req.sessionId,
    req.ip || '',
    req.headers['user-agent'] || '',
    deviceInfo?.type || 'desktop',
    country,
    req.deviceFingerprint || ''
  );

  sendSuccess(res, { viewId }, 'Ad view started', 201);
});

// POST /api/ads/complete - complete an ad view
router.post('/complete', blockBots, async (req: AuthenticatedRequest, res: Response) => {
  const body = completeViewSchema.parse(req.body);
  const result = await adService.completeAdView(body.viewId, req.user!.id, {
    watchDuration: body.watchDuration,
    watchPercent: body.watchPercent,
    wasClicked: body.wasClicked,
    wasConverted: body.wasConverted,
    fingerprint: body.fingerprint,
  });

  sendSuccess(res, result, result.message);
});

// GET /api/ads/history - user's ad view history
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string || '1');
  const limit = Math.min(50, parseInt(req.query.limit as string || '20'));

  const result = await adService.getUserAdHistory(req.user!.id, page, limit);
  sendSuccess(res, result);
});

export { router as adsRouter };
