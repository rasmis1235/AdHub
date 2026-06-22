import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { sendError } from '../../utils/response';

const handler = (_req: Request, res: Response) =>
  sendError(res, 'Too many requests. Please try again later.', 429);

// General API rate limit
export const apiRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skip: (req) => req.ip === '127.0.0.1' && config.env === 'development',
});

// Strict auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  handler,
  keyGenerator: (req) => req.ip || 'unknown',
});

// Ad view rate limit - per user
export const adViewRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  handler,
  keyGenerator: (req) => {
    const authReq = req as Request & { user?: { id: string } };
    return authReq.user?.id || req.ip || 'unknown';
  },
});

// Withdrawal rate limit
export const withdrawalRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3,
  handler,
  keyGenerator: (req) => {
    const authReq = req as Request & { user?: { id: string } };
    return `withdrawal:${authReq.user?.id || req.ip}`;
  },
});

// Custom Redis-backed sliding window rate limiter
export async function checkSlidingWindowRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, '-inf', windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, windowSeconds);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetAt: now + windowSeconds * 1000,
  };
}
