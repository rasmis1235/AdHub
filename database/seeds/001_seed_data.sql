-- AdHub Seed Data
-- Creates admin user and sample ad provider configs

-- Super Admin (password: Admin@123456 - change in production!)
INSERT INTO users (
  email, username, password_hash, full_name,
  status, role, email_verified, referral_code,
  total_points, available_points
) VALUES (
  'admin@adhub.in',
  'superadmin',
  '$2b$12$placeholder_bcrypt_hash_here',
  'AdHub Admin',
  'active', 'super_admin', TRUE,
  'ADHUB-ADMIN',
  0, 0
);

-- Ad Provider Configs
INSERT INTO ad_provider_configs (provider, name, is_active, config, revenue_share, payment_terms, supported_regions)
VALUES
  (
    'google_adsense', 'Google AdSense', FALSE,
    '{"publisher_id": "", "ad_client": ""}',
    0.68, 'net30',
    '["IN","US","GB","CA","AU","DE","FR","SG","AE","SA"]'
  ),
  (
    'monetag', 'Monetag', TRUE,
    '{"zone_id": "", "website_id": ""}',
    0.70, 'weekly',
    '["IN","US","BR","ID","PH","VN","PK","BD","NG","KE"]'
  ),
  (
    'propellerads', 'PropellerAds', TRUE,
    '{"zone_id": "", "publisher_id": ""}',
    0.70, 'weekly',
    '["IN","US","BR","MX","RU","TR","ID","PH","UA","DE"]'
  ),
  (
    'adsterra', 'Adsterra', TRUE,
    '{"zone_id": "", "publisher_key": ""}',
    0.75, 'net15',
    '["IN","US","GB","CA","AU","DE","FR","IT","ES","NL"]'
  );

-- Sample active ads
INSERT INTO ads (
  title, description, ad_type, status,
  media_url, click_url, duration_seconds,
  target_countries, target_devices,
  points_per_view, points_per_click, points_per_completion,
  cpm_rate, daily_cap, cooldown_hours, min_watch_percent
) VALUES
  (
    'Earn from Home - Survey App',
    'Complete simple surveys and earn real cash daily!',
    'video', 'active',
    'https://cdn.adhub.in/ads/sample1.mp4',
    'https://example.com/survey-app',
    30, '["IN"]', '["mobile","desktop","tablet"]',
    2, 5, 10,
    0.85, 1000, 24, 80
  ),
  (
    'Online Shopping - Flat 50% Off',
    'Shop from 10,000+ brands with exclusive discounts.',
    'banner', 'active',
    'https://cdn.adhub.in/ads/sample2.jpg',
    'https://example.com/shop',
    NULL, '["IN","US"]', '["mobile","desktop"]',
    1, 2, 0,
    0.45, 5000, 12, 100
  );
