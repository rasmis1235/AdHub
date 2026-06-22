-- Demo ads seed — run this to populate ads for testing
-- Points reflect 20% user share (platform earns 80%)
-- E.g. if platform earns ₹0.50 per view, user gets ₹0.10 = 10 points

INSERT INTO ads (
  title, description, ad_type, media_url, thumbnail_url, click_url,
  points_per_view, points_per_click, points_per_completion,
  duration_seconds, min_watch_percent,
  status, target_countries, target_devices,
  cpm_rate, daily_cap, total_cap, cooldown_hours
)
VALUES
  (
    'Shop Amazing Deals This Season',
    'Discover the best shopping deals and earn while you watch.',
    'video', NULL,
    'https://picsum.photos/seed/ad1/640/360',
    'https://example.com/shop',
    5, 3, 12,
    30, 80,
    'active', '["IN","US","GB","CA"]', '["desktop","mobile","tablet"]',
    1.50, 200, 5000, 4
  ),
  (
    'Earn More with Our Finance App',
    'Invest your earnings directly — zero fees for AdHub users.',
    'video', NULL,
    'https://picsum.photos/seed/ad2/640/360',
    'https://example.com/finance',
    8, 5, 15,
    45, 70,
    'active', '["IN"]', '["desktop","mobile","tablet"]',
    2.00, 150, 3000, 6
  ),
  (
    'New Gaming App — Play for Free',
    'Download the #1 mobile game and get 500 in-game coins free.',
    'rewarded', NULL,
    'https://picsum.photos/seed/ad3/640/360',
    'https://example.com/game',
    6, 4, 10,
    30, 80,
    'active', '["IN","US","GB","CA","AU"]', '["mobile","tablet"]',
    1.20, 300, 8000, 3
  ),
  (
    'Try Premium Streaming — First Month Free',
    'Watch movies, shows, and more. No credit card required.',
    'video', NULL,
    'https://picsum.photos/seed/ad4/640/360',
    'https://example.com/stream',
    7, 4, 13,
    60, 75,
    'active', '["IN","US","GB"]', '["desktop","mobile","tablet"]',
    1.80, 100, 2000, 8
  ),
  (
    'Fast Food App — Order & Save',
    'Get 50% off your first order with our app. Delivery in 30 mins.',
    'native', NULL,
    'https://picsum.photos/seed/ad5/640/360',
    'https://example.com/food',
    4, 3, 8,
    20, 80,
    'active', '["IN"]', '["mobile"]',
    0.90, 400, 10000, 2
  ),
  (
    'Online Course — Learn Coding Free',
    'Start your tech career today. 500+ hours of content, free.',
    'banner', NULL,
    'https://picsum.photos/seed/ad6/640/360',
    'https://example.com/learn',
    3, 2, 6,
    15, 100,
    'active', '["IN","US","GB","CA","AU","PK","BD"]', '["desktop","mobile","tablet"]',
    0.70, 500, 15000, 1
  ),
  (
    'Cashback on UPI Payments',
    'Use our UPI and earn 5% cashback on every payment.',
    'video', NULL,
    'https://picsum.photos/seed/ad7/640/360',
    'https://example.com/upi',
    6, 4, 11,
    30, 80,
    'active', '["IN"]', '["desktop","mobile","tablet"]',
    1.40, 200, 4000, 4
  ),
  (
    'Travel Deals — Flights from ₹1499',
    'Book now and save up to 70% on domestic flights.',
    'interstitial', NULL,
    'https://picsum.photos/seed/ad8/640/360',
    'https://example.com/travel',
    5, 4, 10,
    20, 80,
    'active', '["IN"]', '["desktop","mobile","tablet"]',
    1.10, 150, 3000, 3
  ),
  (
    'Crypto Wallet — Earn on Every Trade',
    'Get $10 in Bitcoin when you sign up and verify.',
    'video', NULL,
    'https://picsum.photos/seed/ad9/640/360',
    'https://example.com/crypto',
    10, 6, 18,
    60, 70,
    'active', '["IN","US","GB","CA"]', '["desktop","mobile"]',
    2.50, 80, 1500, 12
  ),
  (
    'Health Insurance — Compare Plans',
    'Get the best health coverage for you and your family.',
    'native', NULL,
    'https://picsum.photos/seed/ad10/640/360',
    'https://example.com/insurance',
    5, 3, 9,
    25, 80,
    'active', '["IN"]', '["desktop","mobile","tablet"]',
    1.30, 120, 2500, 6
  )
ON CONFLICT DO NOTHING;
