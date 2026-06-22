# AdHub — Deployment Guide

## Prerequisites
- Node.js 20+, npm 9+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (production)
- Domain: adhub.in (or your domain)

---

## Local Development Setup

### 1. Clone and configure
```bash
git clone https://github.com/your-org/adhub.git
cd adhub

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your DB credentials, JWT secrets, etc.

# Frontend
cp frontend/.env.example frontend/.env
```

### 2. Generate secrets
```bash
# Generate JWT secrets (run twice for access + refresh)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate encryption key (32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up database
```bash
# Create database
psql -U postgres -c "CREATE USER adhub_user WITH PASSWORD 'yourpass';"
psql -U postgres -c "CREATE DATABASE adhub OWNER adhub_user;"

# Run migrations
psql -U adhub_user -d adhub -f database/migrations/001_initial_schema.sql
psql -U adhub_user -d adhub -f database/seeds/001_seed_data.sql
```

### 4. Install and run
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

App runs at http://localhost:3000, API at http://localhost:8000

---

## Docker Compose (Production)

### 1. Prepare environment
```bash
cp backend/.env.example backend/.env
# Fill in all production values

# Create .env in root for docker-compose
cat > .env << EOF
DB_NAME=adhub
DB_USER=adhub_user
DB_PASSWORD=your_strong_password
REDIS_PASSWORD=your_redis_password
API_URL=https://api.adhub.in
EOF
```

### 2. SSL certificates
```bash
mkdir -p infrastructure/nginx/ssl
# Option A: Let's Encrypt (certbot)
certbot certonly --standalone -d adhub.in -d api.adhub.in
cp /etc/letsencrypt/live/adhub.in/fullchain.pem infrastructure/nginx/ssl/adhub.in.crt
cp /etc/letsencrypt/live/adhub.in/privkey.pem infrastructure/nginx/ssl/adhub.in.key

# Option B: Self-signed (dev/staging only)
openssl req -x509 -newkey rsa:4096 -keyout infrastructure/nginx/ssl/adhub.in.key \
  -out infrastructure/nginx/ssl/adhub.in.crt -days 365 -nodes \
  -subj "/CN=adhub.in"
```

### 3. Deploy
```bash
docker-compose build
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Scale backend
docker-compose up -d --scale backend=3
```

---

## AWS EC2 Deployment

### Recommended Instance Types
| Role | Instance | vCPU | RAM | Cost/mo (India) |
|------|----------|------|-----|-----------------|
| Backend (3x) | t3.medium | 2 | 4GB | ~$30 each |
| Database | db.t3.medium (RDS) | 2 | 4GB | ~$35 |
| Cache | cache.t3.micro (ElastiCache) | - | 1GB | ~$12 |
| Load Balancer | ALB | - | - | ~$16 |

### Setup script
```bash
#!/bin/bash
# On a fresh Ubuntu 22.04 EC2 instance

# Install Docker
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin awscli
usermod -aG docker ubuntu

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Clone app
git clone https://github.com/your-org/adhub.git /opt/adhub
cd /opt/adhub

# Configure and start
cp backend/.env.example backend/.env
# ... edit .env ...
docker compose up -d

# Setup systemd service
cat > /etc/systemd/system/adhub.service << 'EOF'
[Unit]
Description=AdHub Application
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/adhub
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=on-failure
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF

systemctl enable adhub
systemctl start adhub
```

---

## Database Backups

```bash
# Daily backup script (add to cron)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgres

mkdir -p $BACKUP_DIR
docker exec adhub_postgres pg_dump -U adhub_user adhub \
  | gzip > $BACKUP_DIR/adhub_$DATE.sql.gz

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to S3
aws s3 cp $BACKUP_DIR/adhub_$DATE.sql.gz s3://adhub-backups/postgres/

echo "Backup completed: adhub_$DATE.sql.gz"

# Crontab: 0 2 * * * /opt/adhub/scripts/backup.sh >> /var/log/adhub-backup.log 2>&1
```

---

## Scaling to 1M Users

### Architecture Evolution

```
Phase 1 (0-50K users): Single EC2 t3.large
  → Docker Compose, single node, minimal cost

Phase 2 (50K-200K): Multi-EC2 with Load Balancer
  → 2x backend (t3.medium) + RDS PostgreSQL + ElastiCache Redis
  → CloudFront CDN for static assets
  → Est. cost: ~$200/month

Phase 3 (200K-500K): Kubernetes (EKS)
  → Auto-scaling backend pods (3-20 replicas)
  → RDS Multi-AZ + Read replicas
  → ElastiCache cluster
  → Est. cost: ~$600/month

Phase 4 (500K-1M): Full cloud-native
  → EKS with spot instances (70% cost savings)
  → Aurora PostgreSQL (serverless v2)
  → ElastiCache Global Datastore
  → WAF + Shield for DDoS protection
  → CloudFront + S3 for all media
  → Est. cost: ~$1,500/month

Revenue at 1M users: ~$33,750/month (India traffic only)
Revenue at 1M with 20% global: ~$80,000/month
```

### Database Optimization for Scale
```sql
-- Partition ad_views by month for 1M+ users
CREATE TABLE ad_views_2024_01 PARTITION OF ad_views
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Read replica for analytics queries
-- Primary: writes, app reads
-- Replica: admin dashboard, reports, analytics

-- Index maintenance (run monthly)
REINDEX INDEX CONCURRENTLY idx_ad_views_user_id;
VACUUM ANALYZE ad_views;
```

---

## Monitoring

### Setup Prometheus + Grafana
```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infrastructure/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: secure_grafana_password
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

### Key Metrics to Monitor
- API response time (p50, p95, p99)
- Database query time
- Redis hit rate
- Ad view completion rate
- Fraud detection rate
- Daily active users
- Revenue per user
- Withdrawal queue depth
