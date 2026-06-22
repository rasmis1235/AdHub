import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8000'),

  // Database — Railway provides DATABASE_URL, fallback to individual vars
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432'),
  DB_NAME: z.string().default('adhub'),
  DB_USER: z.string().default('adhub_user'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.string().default('false'),
  DB_POOL_MIN: z.string().default('2'),
  DB_POOL_MAX: z.string().default('20'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().default('AdHub <noreply@adhub.in>'),

  // App
  APP_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:8000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),

  // IP Geolocation
  MAXMIND_DB_PATH: z.string().optional(),
  IPINFO_TOKEN: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),

  // File upload
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional(),

  // Feature flags
  WITHDRAWAL_ENABLED: z.string().default('true'),
  REFERRAL_ENABLED: z.string().default('true'),
  FRAUD_DETECTION_ENABLED: z.string().default('true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: parseInt(env.PORT),

  db: {
    connectionString: env.DATABASE_URL,   // Railway/Render provide this
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true' || !!env.DATABASE_URL,
    pool: {
      min: parseInt(env.DB_POOL_MIN),
      max: parseInt(env.DB_POOL_MAX),
    },
  },

  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },

  email: {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },

  app: {
    url: env.APP_URL,
    apiUrl: env.API_URL,
    allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  },

  encryptionKey: env.ENCRYPTION_KEY,

  geo: {
    maxmindDbPath: env.MAXMIND_DB_PATH,
    ipinfoToken: env.IPINFO_TOKEN,
  },

  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
    max: parseInt(env.RATE_LIMIT_MAX),
  },

  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    s3Bucket: env.AWS_S3_BUCKET,
  },

  features: {
    withdrawalEnabled: env.WITHDRAWAL_ENABLED === 'true',
    referralEnabled: env.REFERRAL_ENABLED === 'true',
    fraudDetectionEnabled: env.FRAUD_DETECTION_ENABLED === 'true',
  },
};
