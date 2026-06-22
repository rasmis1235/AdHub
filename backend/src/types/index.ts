import { Request } from 'express';

export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'banned';
export type AdType = 'video' | 'banner' | 'interstitial' | 'rewarded' | 'native';
export type AdStatus = 'draft' | 'active' | 'paused' | 'completed' | 'rejected';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';
export type WithdrawalMethod = 'upi' | 'bank_transfer' | 'paypal' | 'paytm' | 'amazon_pay' | 'crypto';
export type TransactionType = 'ad_view' | 'ad_click' | 'ad_completion' | 'referral_bonus' | 'withdrawal' | 'bonus' | 'penalty' | 'refund';
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  email: string;
  phone?: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status: UserStatus;
  role: UserRole;
  email_verified: boolean;
  phone_verified: boolean;
  google_id?: string;
  referral_code: string;
  referred_by?: string;
  total_points: number;
  available_points: number;
  lifetime_earnings: number;
  total_withdrawn: number;
  risk_score: number;
  is_flagged: boolean;
  country: string;
  timezone: string;
  language: string;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface Ad {
  id: string;
  provider_id?: string;
  title: string;
  description?: string;
  ad_type: AdType;
  status: AdStatus;
  media_url?: string;
  thumbnail_url?: string;
  click_url?: string;
  duration_seconds?: number;
  target_countries: string[];
  target_devices: string[];
  points_per_view: number;
  points_per_click: number;
  points_per_completion: number;
  cpm_rate?: number;
  daily_cap?: number;
  total_cap?: number;
  views_today: number;
  total_views: number;
  min_watch_percent: number;
  cooldown_hours: number;
  created_at: Date;
  expires_at?: Date;
}

export interface AdView {
  id: string;
  user_id: string;
  ad_id: string;
  session_id?: string;
  started_at: Date;
  completed_at?: Date;
  watch_duration?: number;
  watch_percent?: number;
  was_clicked: boolean;
  was_converted: boolean;
  points_earned: number;
  device_type?: string;
  ip_address: string;
  country?: string;
  is_fraud: boolean;
  fraud_score: number;
  revenue_earned: number;
  created_at: Date;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  status: 'pending' | 'active' | 'expired' | 'fraudulent';
  bonus_points: number;
  activated_at?: Date;
  created_at: Date;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  status: string;
  points: number;
  balance_before: number;
  balance_after: number;
  ad_view_id?: string;
  referral_id?: string;
  withdrawal_id?: string;
  description?: string;
  metadata: Record<string, unknown>;
  revenue_usd?: number;
  created_at: Date;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  points_requested: number;
  points_fee: number;
  points_net: number;
  amount_inr?: number;
  amount_usd?: number;
  method: WithdrawalMethod;
  account_details: Record<string, string>;
  status: WithdrawalStatus;
  payment_reference?: string;
  paid_at?: Date;
  requested_at: Date;
  created_at: Date;
}

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
  deviceFingerprint?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface GeoInfo {
  country: string;
  country_name: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  is_vpn?: boolean;
  is_proxy?: boolean;
  is_datacenter?: boolean;
  is_tor?: boolean;
  isp?: string;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  os_version?: string;
  browser: string;
  browser_version?: string;
  is_bot: boolean;
}
