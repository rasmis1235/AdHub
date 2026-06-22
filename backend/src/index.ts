import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { testConnection } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { apiRateLimit } from './api/middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './api/middleware/error.middleware';
import { authRouter } from './api/routes/auth.routes';
import { adsRouter } from './api/routes/ads.routes';
import { userRouter } from './api/routes/user.routes';
import { adminRouter } from './api/routes/admin.routes';

const app = express();

// Trust proxy (behind Nginx/Load Balancer)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'pagead2.googlesyndication.com'],
      frameSrc: ['*.googlesyndication.com', '*.doubleclick.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.app.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Rate limiting
app.use('/api/', apiRateLimit);

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/ads', adsRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);

// 404 & Error handling
app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  try {
    await testConnection();
    await redis.ping();
    logger.info('Redis connected');

    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`AdHub API running on port ${config.port} [${config.env}]`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redis.quit();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

bootstrap();

export default app;
