export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status: UserStatus;
  role: UserRole;
  email_verified: boolean;
  referral_code: string;
  total_points: number;
  available_points: number;
  lifetime_earnings: number;
  total_withdrawn: number;
  risk_score: number;
  country: string;
  timezone: string;
  streak_days?: number;
  created_at: string;
  last_login_at?: string;
}

export interface Ad {
  id: string;
  title: string;
  description?: string;
  ad_type: 'video' | 'banner' | 'interstitial' | 'rewarded' | 'native';
  media_url?: string;
  thumbnail_url?: string;
  click_url?: string;
  duration_seconds?: number;
  points_per_view: number;
  points_per_click: number;
  points_per_completion: number;
  min_watch_percent: number;
}

export interface AdView {
  id: string;
  ad_id: string;
  ad_title: string;
  points_earned: number;
  watch_percent?: number;
  was_clicked: boolean;
  created_at: string;
  completed_at?: string;
}

export interface Transaction {
  id: string;
  type: string;
  points: number;
  balance_after: number;
  description?: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  points_requested: number;
  points_net: number;
  amount_inr?: number;
  method: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  payment_reference?: string;
  requested_at: string;
  paid_at?: string;
}

export interface DashboardData {
  earnings: {
    total_points: number;
    available_points: number;
    lifetime_earnings: number;
    total_withdrawn: number;
  };
  recentAds: AdView[];
  recentTransactions: Transaction[];
  referralStats: {
    total_referrals: number;
    active_referrals: number;
    total_bonus: number;
  };
  referralCode: string;
  referralUrl: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
