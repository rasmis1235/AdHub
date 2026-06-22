import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { query } from '../../config/database';
import { CacheKeys, cacheGet } from '../../config/redis';
import { AuthenticatedRequest, JwtPayload, User } from '../../types';
import { sendError } from '../../utils/response';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;

    try {
      payload = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        sendError(res, 'Token expired', 401);
      } else {
        sendError(res, 'Invalid token', 401);
      }
      return;
    }

    // Check cache first — timeout after 1s so Redis issues don't block auth
    const cachedUser = await Promise.race([
      cacheGet<User>(CacheKeys.user(payload.sub)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
    ]);
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    // Fetch from DB
    const { rows } = await query<User>(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub]
    );

    if (!rows[0]) {
      sendError(res, 'User not found', 401);
      return;
    }

    const user = rows[0];

    if (user.status === 'banned' || user.status === 'suspended') {
      sendError(res, `Account ${user.status}. Contact support.`, 403);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
}

export function requireEmailVerified(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.email_verified) {
    sendError(res, 'Email verification required', 403);
    return;
  }
  next();
}

export const requireAdmin = requireRole('admin', 'super_admin');
export const requireSuperAdmin = requireRole('super_admin');
