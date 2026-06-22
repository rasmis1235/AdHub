import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

const isTLS = config.redis.url.startsWith('rediss://');

const redisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 1000, 3000);
  },
};

export const redis = new Redis(config.redis.url, redisOptions);

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

// Typed helpers
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const val = await redis.get(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return val as unknown as T;
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  if (keys.length > 0) await redis.del(...keys);
};

export const cacheIncr = async (key: string, ttlSeconds?: number): Promise<number> => {
  const val = await redis.incr(key);
  if (ttlSeconds && val === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return val;
};

// Cache key builders
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  userSession: (token: string) => `session:${token}`,
  rateLimitAuth: (ip: string) => `rl:auth:${ip}`,
  rateLimitApi: (userId: string) => `rl:api:${userId}`,
  adCooldown: (userId: string, adId: string) => `cooldown:${userId}:${adId}`,
  dailyAdCount: (userId: string, date: string) => `daily_ads:${userId}:${date}`,
  fraudScore: (userId: string) => `fraud:${userId}`,
  referralCode: (code: string) => `ref:${code}`,
  pendingWithdrawals: () => 'admin:pending_withdrawals',
  platformSettings: () => 'platform:settings',
  leaderboard: () => 'leaderboard:referrals',
  ipReputation: (ip: string) => `ip:rep:${ip}`,
} as const;
