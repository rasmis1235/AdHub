# AdHub REST API Documentation

Base URL: `https://api.adhub.in`  
All responses: `Content-Type: application/json`  
Auth: `Authorization: Bearer <access_token>`

---

## Authentication

### POST /api/auth/register
```json
// Request
{
  "email": "user@example.com",
  "username": "rahul_k",
  "full_name": "Rahul Kumar",
  "password": "MyPass@123",
  "referral_code": "AHAB1234"  // optional
}

// Response 201
{
  "success": true,
  "data": { "userId": "uuid" },
  "message": "Registration successful! Please verify your email."
}
```

### POST /api/auth/login
```json
// Request
{ "email": "user@example.com", "password": "MyPass@123" }

// Response 200
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "available_points": 50, ... },
    "accessToken": "eyJ..."
  }
}
// refresh token set as httpOnly cookie
```

### POST /api/auth/refresh
```json
// Request (body OR cookie)
{ "refreshToken": "..." }

// Response 200
{ "success": true, "data": { "accessToken": "eyJ..." } }
```

### POST /api/auth/logout
```
Authorization: Bearer <token>
// Response 200: { "success": true, "message": "Logged out" }
```

### GET /api/auth/verify-email?token=xxx
```
// Response 200: { "success": true, "message": "Email verified!" }
```

### POST /api/auth/forgot-password
```json
{ "email": "user@example.com" }
// Response 200 (always, even if email doesn't exist)
```

### POST /api/auth/reset-password
```json
{ "token": "...", "password": "NewPass@123" }
```

---

## User Dashboard

### GET /api/user/dashboard
```json
// Response 200
{
  "success": true,
  "data": {
    "earnings": {
      "total_points": 1250,
      "available_points": 1100,
      "lifetime_earnings": 1250,
      "total_withdrawn": 150
    },
    "recentAds": [...],
    "recentTransactions": [...],
    "referralStats": {
      "total_referrals": 5,
      "active_referrals": 3,
      "total_bonus": 300
    },
    "referralCode": "AHAB1234",
    "referralUrl": "https://adhub.in/register?ref=AHAB1234"
  }
}
```

### GET /api/user/transactions?page=1&limit=20&type=ad_completion
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "ad_completion",
        "points": 10,
        "balance_after": 1250,
        "description": "Ad completed: earned 10 points",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20
  }
}
```

### POST /api/user/withdraw
```json
// Request
{
  "points": 5000,
  "method": "upi",
  "accountDetails": {
    "upi_id": "user@upi",
    "account_name": "Rahul Kumar"
  }
}

// Response 201
{ "success": true, "data": { "withdrawalId": "uuid" }, "message": "Withdrawal submitted!" }
```

---

## Ads

### GET /api/ads
```json
// Response 200
{
  "success": true,
  "data": {
    "ads": [
      {
        "id": "uuid",
        "title": "Survey App - Earn from Home",
        "ad_type": "video",
        "duration_seconds": 30,
        "thumbnail_url": "...",
        "points_per_view": 2,
        "points_per_click": 5,
        "points_per_completion": 10,
        "min_watch_percent": 80
      }
    ],
    "count": 8
  }
}
```

### POST /api/ads/:adId/start
```json
// Response 201
{ "success": true, "data": { "viewId": "uuid" }, "message": "Ad view started" }
```

### POST /api/ads/complete
```json
// Request
{
  "viewId": "uuid",
  "watchDuration": 28,
  "watchPercent": 93,
  "wasClicked": false,
  "wasConverted": false,
  "fingerprint": "abc123def456..."
}

// Response 200
{ "success": true, "data": { "pointsEarned": 10, "message": "You earned 10 points!" } }
```

---

## Admin Endpoints (requires admin role)

### GET /api/admin/stats
```json
{
  "users": { "total": "12450", "active": "10200", "new_today": "45" },
  "revenue": { "total_views": "89000", "today_revenue": "26.50" },
  "withdrawals": { "pending_count": "12", "pending_amount": "4500.00" },
  "fraud": { "flagged_users": "23", "open_events": "8" }
}
```

### GET /api/admin/users?search=rahul&status=active&page=1
### PATCH /api/admin/users/:id/status
```json
{ "status": "suspended", "reason": "Suspicious activity" }
```

### GET /api/admin/withdrawals?status=pending
### POST /api/admin/withdrawals/:id/process
```json
{ "action": "approve", "paymentReference": "UTR123456789", "note": "Processed via UPI" }
```

### GET /api/admin/fraud/events
### PATCH /api/admin/fraud/events/:id/resolve

---

## Error Responses

```json
// 400 Validation
{
  "success": false,
  "error": "Validation failed",
  "errors": { "email": ["Invalid email format"] }
}

// 401 Unauthorized
{ "success": false, "error": "Authentication required" }

// 403 Forbidden
{ "success": false, "error": "Insufficient permissions" }

// 429 Rate Limited
{ "success": false, "error": "Too many requests. Please try again later." }

// 500 Server Error
{ "success": false, "error": "Internal server error" }
```

---

## Webhook Events (Future)

AdHub can POST to your URL on these events:
- `user.registered`
- `ad.completed`
- `withdrawal.processed`
- `fraud.detected`
