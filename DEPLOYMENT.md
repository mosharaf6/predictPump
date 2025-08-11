# PredictionPump Deployment Guide

## Overview

This guide covers the complete deployment setup for PredictionPump, including production deployment, monitoring, and maintenance procedures.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: Minimum 8GB, Recommended 16GB+
- **Storage**: Minimum 100GB SSD
- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **Network**: Static IP address, Domain name configured

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl
- jq (for monitoring scripts)
- bc (for calculations)

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/prediction-pump.git
cd prediction-pump
```

### 2. Configure Environment
```bash
# Copy and configure production environment
cp .env.production.example .env.production
nano .env.production

# Set secure passwords and API keys
# Configure domain names and SSL settings
# Set monitoring credentials
```

### 3. Configure DNS
Point your domain to the server IP:
```
A    predictionpump.com        -> YOUR_SERVER_IP
A    api.predictionpump.com    -> YOUR_SERVER_IP
A    ws.predictionpump.com     -> YOUR_SERVER_IP
A    cdn.predictionpump.com    -> YOUR_SERVER_IP
```

## Production Deployment

### Automated Deployment
```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy to production
./scripts/deploy.sh production deploy
```

### Manual Deployment Steps

#### 1. Build and Start Services
```bash
# Load environment variables
export $(cat .env.production | xargs)

# Build production images
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. Run Database Migrations
```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Seed initial data (if needed)
docker-compose -f docker-compose.prod.yml exec backend npm run seed
```

#### 3. Verify Deployment
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Run health checks
./scripts/monitor.sh status

# Check application endpoints
curl -f http://localhost:3000/api/health
curl -f http://localhost:8000/health
```

## Service Architecture

### Frontend (Next.js)
- **Port**: 3000
- **Health Check**: `/api/health`
- **Metrics**: `/api/metrics`
- **Features**: PWA, SSR, Static optimization

### Backend (Node.js)
- **Port**: 8000
- **Health Check**: `/health`
- **Metrics**: `/metrics`
- **Features**: REST API, WebSocket, Real-time data

### Database (PostgreSQL)
- **Port**: 5432
- **Backup**: Automated daily backups
- **Monitoring**: Connection count, query performance

### Cache (Redis)
- **Port**: 6379
- **Usage**: Session storage, real-time data cache
- **Persistence**: AOF enabled

### Reverse Proxy (Traefik)
- **Ports**: 80 (HTTP), 443 (HTTPS), 8080 (Dashboard)
- **Features**: Automatic SSL, Load balancing
- **SSL**: Let's Encrypt automatic certificates

## Monitoring Stack

### Prometheus (Metrics Collection)
- **Port**: 9090
- **Retention**: 200 hours
- **Scrape Interval**: 15 seconds
- **Targets**: All application services

### Grafana (Visualization)
- **Port**: 3001
- **Default Login**: admin / (configured password)
- **Dashboards**: Pre-configured application dashboard
- **Alerts**: Email and webhook notifications

### Loki (Log Aggregation)
- **Port**: 3100
- **Storage**: Local filesystem
- **Retention**: Configurable
- **Sources**: Application logs, system logs

### Promtail (Log Collection)
- **Configuration**: `/monitoring/promtail.yml`
- **Sources**: Docker containers, system logs
- **Processing**: JSON parsing, labeling

## Monitoring and Alerting

### Health Checks
```bash
# Check all services
./scripts/monitor.sh status

# Check metrics
./scripts/monitor.sh metrics

# Check resource usage
./scripts/monitor.sh resources

# Full monitoring report
./scripts/monitor.sh full
```

### Alert Rules
Configured alerts for:
- Service downtime
- High error rates (>10%)
- High response times (>1s)
- Database connection issues
- High memory usage (>90%)
- High disk usage (>90%)
- WebSocket connection anomalies
- Trading volume anomalies

### Alert Channels
- **Slack**: Configure webhook URL in environment
- **Email**: Configure SMTP settings in Grafana
- **PagerDuty**: Configure integration key

## Backup and Recovery

### Automated Backups
```bash
# Daily backup cron job
0 2 * * * /path/to/prediction-pump/scripts/backup.sh

# Backup includes:
# - PostgreSQL database dump
# - Redis data
# - Application logs
# - Configuration files
```

### Manual Backup
```bash
# Create backup
./scripts/deploy.sh production backup

# Backup location: /backups/YYYYMMDD_HHMMSS/
```

### Recovery Procedure
```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
./scripts/deploy.sh production restore /backups/20240101_120000

# Verify restoration
./scripts/monitor.sh health
```

## Scaling

### Horizontal Scaling
```bash
# Scale frontend instances
docker-compose -f docker-compose.prod.yml up -d --scale frontend=3

# Scale backend instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=2
```

### Database Scaling
- **Read Replicas**: Configure PostgreSQL streaming replication
- **Connection Pooling**: Use PgBouncer for connection management
- **Partitioning**: Implement table partitioning for large datasets

### CDN Setup
- Configure CloudFlare or AWS CloudFront
- Cache static assets and API responses
- Enable compression and optimization

## Security

### SSL/TLS
- Automatic SSL certificates via Let's Encrypt
- HSTS headers enabled
- TLS 1.2+ only

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: restrictive

### Network Security
- Firewall rules for required ports only
- Internal network for service communication
- Regular security updates

### Application Security
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting

## Maintenance

### Regular Tasks
- **Daily**: Check monitoring dashboards
- **Weekly**: Review logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Capacity planning and performance review

### Update Procedure
```bash
# 1. Create backup
./scripts/deploy.sh production backup

# 2. Pull latest changes
git pull origin main

# 3. Deploy updates
./scripts/deploy.sh production deploy

# 4. Verify deployment
./scripts/monitor.sh health
```

### Rollback Procedure
```bash
# Rollback to previous version
./scripts/deploy.sh production rollback

# Or rollback to specific backup
./scripts/deploy.sh production restore /backups/20240101_120000
```

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Check resource usage
docker stats

# Check disk space
df -h
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check logs
docker-compose -f docker-compose.prod.yml logs postgres
```

#### High Memory Usage
```bash
# Check memory usage by service
docker stats --no-stream

# Check system memory
free -h

# Restart services if needed
docker-compose -f docker-compose.prod.yml restart [service_name]
```

#### SSL Certificate Issues
```bash
# Check certificate status
docker-compose -f docker-compose.prod.yml logs traefik

# Force certificate renewal
docker-compose -f docker-compose.prod.yml exec traefik traefik --certificatesresolvers.letsencrypt.acme.caserver=https://acme-v02.api.letsencrypt.org/directory
```

### Performance Optimization

#### Database Optimization
- Regular VACUUM and ANALYZE
- Index optimization
- Query performance monitoring
- Connection pooling

#### Application Optimization
- Bundle size optimization
- Image optimization
- Caching strategies
- CDN utilization

#### Infrastructure Optimization
- Resource allocation tuning
- Load balancer configuration
- Network optimization
- Storage optimization

## Support and Documentation

### Monitoring Dashboards
- **Grafana**: http://your-domain:3001
- **Prometheus**: http://your-domain:9090
- **Traefik**: http://your-domain:8080

### Log Access
```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f [service_name]

# System logs
journalctl -u docker -f
```

### Performance Metrics
- Response times and throughput
- Error rates and availability
- Resource utilization
- Business metrics (trading volume, user activity)

### Contact Information
- **DevOps Team**: devops@predictionpump.com
- **Emergency**: +1-XXX-XXX-XXXX
- **Documentation**: https://docs.predictionpump.com

This deployment guide ensures a robust, scalable, and maintainable production environment for PredictionPump.