-- AdHub Initial Schema Migration
-- Version: 001
-- PostgreSQL 15+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE ad_status AS ENUM ('draft', 'active', 'paused', 'completed', 'rejected');
CREATE TYPE ad_type AS ENUM ('video', 'banner', 'interstitial', 'rewarded', 'native');
CREATE TYPE ad_provider AS ENUM ('google_adsense', 'google_ad_manager', 'monetag', 'propellerads', 'adsterra', 'media_net', 'exoclick', 'hilltopads', 'custom');
CREATE TYPE transaction_type AS ENUM ('ad_view', 'ad_click', 'ad_completion', 'referral_bonus', 'withdrawal', 'bonus', 'penalty', 'refund');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'reversed');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'rejected');
CREATE TYPE withdrawal_method AS ENUM ('upi', 'bank_transfer', 'paypal', 'paytm', 'amazon_pay', 'crypto');
CREATE TYPE fraud_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE device_type AS ENUM ('desktop', 'mobile', 'tablet');
CREATE TYPE os_type AS ENUM ('android', 'ios', 'windows', 'macos', 'linux', 'other');
CREATE TYPE referral_status AS ENUM ('pending', 'active', 'expired', 'fraudulent');

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 VARCHAR(255) UNIQUE NOT NULL,
  phone                 VARCHAR(20) UNIQUE,
  username              VARCHAR(50) UNIQUE NOT NULL,
  password_hash         VARCHAR(255),
  full_name             VARCHAR(100) NOT NULL,
  avatar_url            VARCHAR(500),

  -- Status and roles
  status                user_status NOT NULL DEFAULT 'pending',
  role                  user_role NOT NULL DEFAULT 'user',
  email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified        BOOLEAN NOT NULL DEFAULT FALSE,

  -- OAuth
  google_id             VARCHAR(100) UNIQUE,
  google_email          VARCHAR(255),

  -- Referral system
  referral_code         VARCHAR(20) UNIQUE NOT NULL,
  referred_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_level        INTEGER NOT NULL DEFAULT 0,

  -- Points/Earnings
  total_points          BIGINT NOT NULL DEFAULT 0,
  available_points      BIGINT NOT NULL DEFAULT 0,
  lifetime_earnings     BIGINT NOT NULL DEFAULT 0,
  total_withdrawn       BIGINT NOT NULL DEFAULT 0,

  -- Anti-fraud
  risk_score            SMALLINT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  is_flagged            BOOLEAN NOT NULL DEFAULT FALSE,
  last_ip               INET,
  last_country          VARCHAR(2),

  -- Metadata
  timezone              VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  language              VARCHAR(10) NOT NULL DEFAULT 'en',
  country               VARCHAR(2) NOT NULL DEFAULT 'IN',

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at         TIMESTAMPTZ,
  email_verified_at     TIMESTAMPTZ,
  suspended_at          TIMESTAMPTZ,
  suspended_reason      TEXT,
  deleted_at            TIMESTAMPTZ
);

-- ============================================================
-- USER SESSIONS
-- ============================================================
CREATE TABLE user_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token     VARCHAR(500) UNIQUE NOT NULL,
  device_id         VARCHAR(255),
  device_type       device_type,
  device_name       VARCHAR(100),
  os                os_type,
  browser           VARCHAR(50),
  ip_address        INET NOT NULL,
  country           VARCHAR(2),
  city              VARCHAR(100),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EMAIL VERIFICATION TOKENS
-- ============================================================
CREATE TABLE verification_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(100) UNIQUE NOT NULL,
  type        VARCHAR(50) NOT NULL, -- 'email_verify', 'password_reset', 'phone_verify'
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AD PROVIDERS (CONFIGURATION)
-- ============================================================
CREATE TABLE ad_provider_configs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider          ad_provider NOT NULL,
  name              VARCHAR(100) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  config            JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"publisher_id": "xxx", "ad_unit_id": "yyy", "api_key": "zzz"}
  revenue_share     DECIMAL(5,4) NOT NULL DEFAULT 0.7000, -- platform keeps 30%
  min_payout        DECIMAL(10,2),
  payment_terms     VARCHAR(50), -- 'net30', 'net60', 'weekly'
  supported_regions JSONB NOT NULL DEFAULT '["IN","US","GB","CA","AU"]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADS TABLE
-- ============================================================
CREATE TABLE ads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id       UUID REFERENCES ad_provider_configs(id) ON DELETE SET NULL,
  external_ad_id    VARCHAR(255),
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  ad_type           ad_type NOT NULL,
  status            ad_status NOT NULL DEFAULT 'active',

  -- Media
  media_url         VARCHAR(500),
  thumbnail_url     VARCHAR(500),
  click_url         VARCHAR(500),
  duration_seconds  SMALLINT, -- for video ads

  -- Targeting
  target_countries  JSONB NOT NULL DEFAULT '["IN"]',
  target_devices    JSONB NOT NULL DEFAULT '["mobile","desktop","tablet"]',
  target_os         JSONB NOT NULL DEFAULT '[]',
  min_age           SMALLINT,
  max_age           SMALLINT,

  -- Rewards
  points_per_view   INTEGER NOT NULL DEFAULT 0,
  points_per_click  INTEGER NOT NULL DEFAULT 0,
  points_per_completion INTEGER NOT NULL DEFAULT 0,

  -- Revenue tracking
  cpm_rate          DECIMAL(10,4), -- cost per thousand impressions
  cpc_rate          DECIMAL(10,4), -- cost per click
  cpv_rate          DECIMAL(10,4), -- cost per view/completion

  -- Limits
  daily_cap         INTEGER, -- max views per day
  total_cap         INTEGER, -- max total views
  views_today       INTEGER NOT NULL DEFAULT 0,
  total_views       INTEGER NOT NULL DEFAULT 0,

  -- Anti-fraud
  min_watch_percent SMALLINT NOT NULL DEFAULT 80, -- % of video to watch
  cooldown_hours    SMALLINT NOT NULL DEFAULT 24, -- hours between views per user

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);

-- ============================================================
-- AD VIEWS (IMPRESSIONS/INTERACTIONS)
-- ============================================================
CREATE TABLE ad_views (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_id             UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  session_id        UUID REFERENCES user_sessions(id) ON DELETE SET NULL,

  -- Interaction tracking
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  watch_duration    INTEGER, -- seconds watched
  watch_percent     SMALLINT, -- 0-100
  was_clicked       BOOLEAN NOT NULL DEFAULT FALSE,
  clicked_at        TIMESTAMPTZ,
  was_converted     BOOLEAN NOT NULL DEFAULT FALSE,
  converted_at      TIMESTAMPTZ,

  -- Points awarded
  points_earned     INTEGER NOT NULL DEFAULT 0,
  points_awarded_at TIMESTAMPTZ,

  -- Device/Context
  device_type       device_type,
  os                os_type,
  browser           VARCHAR(50),
  ip_address        INET NOT NULL,
  country           VARCHAR(2),
  city              VARCHAR(100),
  user_agent        TEXT,

  -- Anti-fraud signals
  is_fraud          BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_reason      VARCHAR(255),
  fraud_score       SMALLINT NOT NULL DEFAULT 0,

  -- Revenue
  revenue_earned    DECIMAL(10,6) NOT NULL DEFAULT 0, -- in USD

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE referrals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code     VARCHAR(20) NOT NULL,
  status            referral_status NOT NULL DEFAULT 'pending',

  -- Attribution
  ip_address        INET,
  user_agent        TEXT,
  utm_source        VARCHAR(100),
  utm_medium        VARCHAR(100),
  utm_campaign      VARCHAR(100),

  -- Rewards
  bonus_points      INTEGER NOT NULL DEFAULT 0,
  bonus_paid_at     TIMESTAMPTZ,

  -- Lifecycle
  activated_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(referrer_id, referred_id)
);

-- ============================================================
-- POINT TRANSACTIONS (LEDGER)
-- ============================================================
CREATE TABLE point_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              transaction_type NOT NULL,
  status            transaction_status NOT NULL DEFAULT 'completed',

  -- Amount (positive = credit, negative = debit)
  points            BIGINT NOT NULL,
  balance_before    BIGINT NOT NULL,
  balance_after     BIGINT NOT NULL,

  -- References
  ad_view_id        UUID REFERENCES ad_views(id) ON DELETE SET NULL,
  referral_id       UUID REFERENCES referrals(id) ON DELETE SET NULL,
  withdrawal_id     UUID, -- FK added later

  -- Metadata
  description       TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',

  -- Revenue correlation
  revenue_usd       DECIMAL(10,6),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WITHDRAWALS
-- ============================================================
CREATE TABLE withdrawals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Amount
  points_requested  BIGINT NOT NULL,
  points_fee        BIGINT NOT NULL DEFAULT 0,
  points_net        BIGINT NOT NULL,
  amount_inr        DECIMAL(10,2),
  amount_usd        DECIMAL(10,2),

  -- Method
  method            withdrawal_method NOT NULL,
  account_details   JSONB NOT NULL, -- encrypted UPI/bank details

  -- Status
  status            withdrawal_status NOT NULL DEFAULT 'pending',
  admin_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_note        TEXT,

  -- Payment tracking
  payment_reference VARCHAR(255),
  paid_at           TIMESTAMPTZ,

  -- Anti-fraud
  risk_score        SMALLINT NOT NULL DEFAULT 0,
  ip_address        INET,

  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK after table creation
ALTER TABLE point_transactions
  ADD CONSTRAINT fk_pt_withdrawal
  FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id) ON DELETE SET NULL;

-- ============================================================
-- DEVICE FINGERPRINTS (ANTI-FRAUD)
-- ============================================================
CREATE TABLE device_fingerprints (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash  VARCHAR(64) NOT NULL,

  -- Device details
  device_type       device_type,
  os                os_type,
  os_version        VARCHAR(50),
  browser           VARCHAR(50),
  browser_version   VARCHAR(50),
  screen_resolution VARCHAR(20),
  timezone          VARCHAR(50),
  language          VARCHAR(10),

  -- Network
  ip_address        INET NOT NULL,
  ip_country        VARCHAR(2),
  ip_city           VARCHAR(100),
  isp               VARCHAR(100),
  is_vpn            BOOLEAN NOT NULL DEFAULT FALSE,
  is_proxy          BOOLEAN NOT NULL DEFAULT FALSE,
  is_datacenter     BOOLEAN NOT NULL DEFAULT FALSE,
  is_tor            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Risk
  risk_score        SMALLINT NOT NULL DEFAULT 0,

  first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count        INTEGER NOT NULL DEFAULT 0,

  UNIQUE(user_id, fingerprint_hash)
);

-- ============================================================
-- FRAUD EVENTS
-- ============================================================
CREATE TABLE fraud_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type        VARCHAR(100) NOT NULL,
  severity          fraud_severity NOT NULL DEFAULT 'low',
  description       TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  ip_address        INET,
  fingerprint_hash  VARCHAR(64),
  auto_action       VARCHAR(100), -- 'blocked', 'flagged', 'warning_sent'
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  resolved          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER WITHDRAWAL ACCOUNTS
-- ============================================================
CREATE TABLE withdrawal_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method          withdrawal_method NOT NULL,
  account_name    VARCHAR(100) NOT NULL,
  account_details JSONB NOT NULL, -- encrypted
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================
CREATE TABLE platform_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVENUE SNAPSHOTS (ANALYTICS)
-- ============================================================
CREATE TABLE revenue_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   DATE NOT NULL UNIQUE,
  total_revenue   DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_payouts   DECIMAL(12,4) NOT NULL DEFAULT 0,
  net_revenue     DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_views     INTEGER NOT NULL DEFAULT 0,
  unique_users    INTEGER NOT NULL DEFAULT 0,
  new_referrals   INTEGER NOT NULL DEFAULT 0,
  breakdown       JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_risk_score ON users(risk_score) WHERE risk_score > 50;
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Sessions
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- Ads
CREATE INDEX idx_ads_status ON ads(status);
CREATE INDEX idx_ads_type ON ads(ad_type);
CREATE INDEX idx_ads_provider ON ads(provider_id);
CREATE INDEX idx_ads_expires_at ON ads(expires_at) WHERE expires_at IS NOT NULL;

-- Ad Views
CREATE INDEX idx_ad_views_user_id ON ad_views(user_id);
CREATE INDEX idx_ad_views_ad_id ON ad_views(ad_id);
CREATE INDEX idx_ad_views_created_at ON ad_views(created_at DESC);
CREATE INDEX idx_ad_views_user_ad ON ad_views(user_id, ad_id);
CREATE INDEX idx_ad_views_fraud ON ad_views(user_id) WHERE is_fraud = TRUE;

-- Referrals
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Transactions
CREATE INDEX idx_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_transactions_type ON point_transactions(type);
CREATE INDEX idx_transactions_created_at ON point_transactions(created_at DESC);

-- Withdrawals
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- Device Fingerprints
CREATE INDEX idx_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_fingerprints_ip ON device_fingerprints(ip_address);

-- Fraud Events
CREATE INDEX idx_fraud_user_id ON fraud_events(user_id);
CREATE INDEX idx_fraud_severity ON fraud_events(severity);
CREATE INDEX idx_fraud_resolved ON fraud_events(resolved) WHERE resolved = FALSE;

-- Audit Logs
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ads_updated_at BEFORE UPDATE ON ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_provider_configs_updated_at BEFORE UPDATE ON ad_provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DEFAULT PLATFORM SETTINGS
-- ============================================================
INSERT INTO platform_settings (key, value, description) VALUES
  ('points_to_inr_rate', '{"rate": 0.01}', 'Conversion: 1 point = 0.01 INR'),
  ('min_withdrawal_points', '{"amount": 5000}', 'Minimum points to withdraw (50 INR)'),
  ('referral_bonus_points', '{"l1": 100, "l2": 50}', 'Points for L1 and L2 referrals'),
  ('ad_cooldown_hours', '{"default": 24}', 'Default hours between same ad views'),
  ('max_ads_per_day', '{"default": 20}', 'Max ads a user can watch per day'),
  ('withdrawal_fee_percent', '{"fee": 2}', 'Withdrawal processing fee %'),
  ('fraud_auto_ban_score', '{"threshold": 90}', 'Risk score to auto-suspend account'),
  ('withdrawal_enabled', '{"enabled": true}', 'Global withdrawal toggle'),
  ('new_user_bonus_points', '{"amount": 50}', 'Welcome bonus for new registrations');
