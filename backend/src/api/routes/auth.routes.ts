import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService, RegisterPayload } from '../../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rateLimit.middleware';
import { attachDeviceInfo } from '../middleware/fraud.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscore only'),
  full_name: z.string().min(2).max(100),
  password: z.string().min(8).max(128).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Must contain uppercase, lowercase, and number'
  ),
  referral_code: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Must contain uppercase, lowercase, and number'
  ),
});

// POST /api/auth/register
router.post('/register', authRateLimit, attachDeviceInfo, async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body) as RegisterPayload;
  const result = await authService.register(body, req.ip || '');
  sendSuccess(
    res,
    { userId: result.userId },
    'Registration successful! Please check your email to verify your account.',
    201
  );
});

// POST /api/auth/login
router.post('/login', authRateLimit, attachDeviceInfo, async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const deviceInfo = {
    type: (req as Request & { deviceInfo?: { type: string; os: string; browser: string } }).deviceInfo?.type || 'desktop',
    os: (req as Request & { deviceInfo?: { type: string; os: string; browser: string } }).deviceInfo?.os || 'other',
    browser: (req as Request & { deviceInfo?: { type: string; os: string; browser: string } }).deviceInfo?.browser || 'unknown',
  };
  const result = await authService.login(email, password, req.ip || '', deviceInfo);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken,
  }, 'Login successful');
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    sendError(res, 'Refresh token required', 401);
    return;
  }
  const tokens = await authService.refreshToken(refreshToken, req.ip || '');
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
  sendSuccess(res, { accessToken: tokens.accessToken }, 'Token refreshed');
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  sendSuccess(res, null, 'Logged out successfully');
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    sendError(res, 'Token required', 400);
    return;
  }
  await authService.verifyEmail(token);
  sendSuccess(res, null, 'Email verified successfully! Your account is now active.');
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authRateLimit, async (req: Request, res: Response) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email);
  sendSuccess(res, null, 'If the email exists, a reset link has been sent.');
});

// POST /api/auth/reset-password
router.post('/reset-password', authRateLimit, async (req: Request, res: Response) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, password);
  sendSuccess(res, null, 'Password reset successfully. Please login.');
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { ...user } = req.user as NonNullable<AuthenticatedRequest['user']>;
  sendSuccess(res, user);
});

export { router as authRouter };
