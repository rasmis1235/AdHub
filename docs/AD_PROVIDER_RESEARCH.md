# AdHub — Ad Provider Research & Strategy

## Provider Comparison Matrix

### 1. Google AdSense
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPM + CPC (revenue share ~68%) |
| CPM (India) | $0.20–$0.80 |
| CPM (US/UK) | $2–$8 |
| Requirements | Website with original content; no incentivized/paid-to-click traffic |
| Rewarded Traffic | **PROHIBITED** — policy explicitly bans incentivized ad views |
| Referral Traffic | Allowed if organic; incentivized referrals are banned |
| Risk Level | **CRITICAL** — will ban account immediately for incentivized clicks |
| Pros | Highest brand advertisers, best fill rates globally |
| Cons | Completely incompatible with our "earn per watch" model |
| **Verdict** | ❌ **DO NOT USE** for rewarded model |

---

### 2. Google Ad Manager (GAM)
| Attribute | Details |
|-----------|---------|
| Revenue Model | Direct + Programmatic (keeps ~20% for Open Bidding) |
| CPM (India) | $0.30–$1.50 |
| CPM (US/UK) | $3–$15 |
| Requirements | 90M+ monthly impressions minimum; invite only |
| Rewarded Traffic | Allowed for rewarded video units with policy compliance |
| Risk Level | **Medium-High** — requires separate review for rewarded inventory |
| Pros | Highest CPMs if approved; header bidding; rewarded video support |
| Cons | Very hard to get approved; complex setup |
| **Verdict** | ⚠️ Target for Phase 2 (after 10M+ monthly impressions) |

---

### 3. Monetag (formerly PropellerAds Media)
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPM (Push, Interstitial, Pop) |
| CPM (India) | $0.05–$0.30 |
| CPM (US) | $1–$4 |
| Min Payout | $5 (weekly) |
| Requirements | 1 website, basic traffic |
| Rewarded Traffic | Allowed; popular with reward apps |
| Referral Traffic | Allowed |
| Payment | PayPal, Payoneer, Wire, Crypto, USDT |
| Risk Level | **Low** |
| Pros | Easy approval, weekly payout, good India CPMs, push notification ads |
| Cons | Lower CPMs than premium networks |
| **Verdict** | ✅ **RECOMMENDED for India launch** — best risk/reward |

---

### 4. PropellerAds
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPM (Push, Onclick, Interstitial, Native) |
| CPM (India) | $0.04–$0.25 |
| CPM (US) | $0.80–$3.50 |
| Min Payout | $5 (weekly) |
| Requirements | Any website; quick auto-approval |
| Rewarded Traffic | Compatible; no explicit ban |
| Referral Traffic | Allowed |
| Risk Level | **Low** |
| Pros | Largest push ad network, auto-approval, SmartCPM bidding |
| Cons | Low India CPMs, some intrusive ad formats |
| **Verdict** | ✅ **Good for push notification monetization** |

---

### 5. Adsterra
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPM + CPA + CPS |
| CPM (India) | $0.10–$0.60 |
| CPM (US/UK) | $1.50–$6 |
| Min Payout | $5 (Net-15) |
| Requirements | 5K visits/month |
| Rewarded Traffic | Allowed; has rewarded ad solutions |
| Referral Traffic | 5% lifetime referral commission for publishers |
| Risk Level | **Low-Medium** |
| Pros | Rewarded ads supported, good US/EU CPMs, referral program, Native ads |
| Cons | Moderate India CPMs |
| **Verdict** | ✅ **RECOMMENDED — has referral bonus for publisher referrals** |

---

### 6. Media.net (Yahoo/Bing contextual)
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPC (contextual, search-intent) |
| CPM Equivalent (India) | $0.05–$0.20 |
| CPM Equivalent (US) | $1–$5 |
| Requirements | English content, US/UK/CA traffic preferred |
| Rewarded Traffic | **NOT suitable** — contextual only |
| Risk Level | **Medium** |
| Pros | Good US/UK performance |
| Cons | Very poor India monetization; no rewarded support |
| **Verdict** | ❌ Not suitable for our model |

---

### 7. ExoClick
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPM + CPC + CPA |
| CPM (India) | $0.08–$0.50 |
| CPM (US) | $1–$5 |
| Requirements | Adult content allowed; mainstream too |
| Rewarded Traffic | Compatible |
| Risk Level | **Medium** (associated with adult content) |
| Pros | High CPMs in certain geos, video ad support |
| Cons | Reputation risk (adult association); Indian banks may block payments |
| **Verdict** | ⚠️ Phase 2 if needed; check payment compatibility in India |

---

### 8. HilltopAds
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPM (Pop, Banner, Video, Native) |
| CPM (India) | $0.10–$0.80 |
| CPM (US) | $1–$6 |
| Min Payout | $50 (Net-7) |
| Requirements | Traffic >1K/day |
| Rewarded Traffic | Allowed; growing rewarded segment |
| Risk Level | **Low-Medium** |
| Pros | Good India CPMs, fast payouts, video rewarded support |
| Cons | Smaller advertiser base than Monetag/PropellerAds |
| **Verdict** | ✅ **Test alongside Monetag for India traffic** |

---

### 9. Offerwall Providers (Tapjoy/IronSource/Fyber/AdGem)
| Attribute | Details |
|-----------|---------|
| Revenue Model | CPA (user completes action = high payout) |
| eCPM Range | $5–$50 (extremely high for completed actions) |
| Requirements | Mobile app (Tapjoy/IronSource require app; AdGem has web SDK) |
| Rewarded Traffic | **Purpose-built for rewarded users** |
| Risk Level | **Low** (industry standard) |
| Pros | Highest revenue per engaged user; $1–$10 per completed survey/install |
| Cons | Most require mobile app; quality control needed |
| **Verdict** | ✅ **HIGHEST PRIORITY for mobile app phase** — target AdGem for web |

---

### 10. Rewarded Ad Providers (Rewarded.com / Lootably / AdGate)
| Attribute | Details |
|-----------|---------|
| Revenue Model | Revenue share on CPA/CPL completions |
| eCPM Range | $8–$60 |
| Requirements | Engaged userbase; application required |
| Rewarded Traffic | **Purpose-built** |
| Risk Level | **Low** |
| Pros | Highest eCPMs possible; surveys, app installs, video completions |
| Cons | Limited to engaged, verified users |
| **Verdict** | ✅ **Highest revenue potential after user verification** |

---

## Recommended Provider Stack by Phase

### Phase 1: Launch (0–50K users)
```
Primary:    Monetag (India traffic, quick setup)
Secondary:  Adsterra (US/EU traffic + publisher referral bonus)
Backup:     HilltopAds (India video ads)
```

### Phase 2: Growth (50K–500K users)
```
Primary:    Monetag + PropellerAds (A/B test)
Secondary:  Adsterra + HilltopAds
Add:        AdGate Media (offerwall for web)
Target:     Google Ad Manager (application when 90M impressions/month)
```

### Phase 3: Scale (500K–1M+ users)
```
Primary:    Google Ad Manager (direct deals, highest CPMs)
Secondary:  IronSource/Tapjoy (mobile app offerwalls)
Add:        Lootably / Rewarded.com (rewarded surveys)
Direct:     Negotiate direct advertiser deals (>$15 CPM)
```

---

## CPM Benchmarks by Geography (2024)

| Country | Tier | Monetag CPM | Adsterra CPM | Target eCPM |
|---------|------|------------|--------------|-------------|
| IN | T3 | $0.10–0.30 | $0.15–0.60 | $0.30 |
| US | T1 | $1.20–3.50 | $2–6 | $4.00 |
| GB | T1 | $0.80–2.50 | $1.5–5 | $3.00 |
| CA | T1 | $0.80–2.00 | $1.2–4 | $2.50 |
| AU | T1 | $0.70–1.80 | $1–3.5 | $2.00 |
| SG | T2 | $0.40–1.20 | $0.6–2 | $1.50 |
| AE | T2 | $0.50–1.50 | $0.8–2.5 | $1.80 |

---

## Revenue Model

### Points Economy
```
1 point = ₹0.01 (1 INR per 100 points)

User earns per ad:
  - Video view:       2 points (cost to platform: ₹0.02)
  - Video completion: 10 points (cost to platform: ₹0.10)
  - Click bonus:      5 points (cost to platform: ₹0.05)

Platform revenue per Indian video view: ~$0.0003 (0.03 paise)
User payout per Indian video view: ₹0.02 (~$0.0002)
Platform margin: ~33%

For US traffic:
Platform revenue per video view: ~$0.004
User payout per video view: ₹0.02 ($0.0002)
Platform margin: ~95%
```

### Revenue Projections (India-focused)

| Users | Daily Active | Daily Views/User | Daily Views | Revenue/Day | Monthly |
|-------|-------------|------------------|-------------|-------------|---------|
| 10K   | 2,000       | 10               | 20,000      | $6          | $180    |
| 100K  | 20,000      | 10               | 200,000     | $60         | $1,800  |
| 500K  | 100,000     | 12               | 1,200,000   | $360        | $10,800 |
| 1M    | 250,000     | 15               | 3,750,000   | $1,125      | $33,750 |

*Note: Above uses $0.0003 India CPM. Mixed global traffic will yield 3–10x higher.*

---

## Anti-Fraud Policy Compliance

| Network | Self-Referral | Incentivized | Bots |
|---------|--------------|--------------|------|
| Monetag | Allowed | Allowed | Prohibited |
| Adsterra | Allowed | Allowed | Prohibited |
| HilltopAds | Allowed | Allowed | Prohibited |
| Google AdSense | Prohibited | **Prohibited** | Prohibited |

**Conclusion**: Never integrate Google AdSense with incentivized views. Use AdSense only for non-incentivized pages (blog/landing pages) if needed.
