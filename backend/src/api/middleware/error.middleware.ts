import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join('.');
      errors[key] = [...(errors[key] || []), e.message];
    });
    res.status(400).json({ success: false, error: 'Validation failed', errors });
    return;
  }

  // App errors (operational)
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(`Unexpected AppError: ${err.message} ${req.method} ${req.path}`);
    }
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  // PostgreSQL errors
  if ((err as NodeJS.ErrnoException).code === '23505') {
    res.status(409).json({ success: false, error: 'Resource already exists' });
    return;
  }

  // Unknown errors
  logger.error(`Unhandled error: ${(err as Error).message} ${req.method} ${req.path}`);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
