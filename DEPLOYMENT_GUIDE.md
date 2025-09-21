# Ultimate SEO Platform - CI/CD Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Ultimate SEO Platform using the automated CI/CD pipeline with GitHub Actions, Docker, and robust infrastructure management.

## Architecture

### Components
- **GitHub Actions**: Automated CI/CD workflows
- **Docker**: Multi-stage containerization
- **Docker Compose**: Multi-environment orchestration
- **Nginx**: Reverse proxy and load balancing
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Monitoring**: Prometheus, Grafana, Loki

### Environments
- **Development**: Local development environment
- **Staging**: Pre-production testing (test.theprofitplatform.com.au)
- **Production**: Live environment (theprofitplatform.com.au)

## Prerequisites

### Server Requirements
- Ubuntu 20.04 LTS or newer
- Docker 20.10+
- Docker Compose 2.0+
- Nginx 1.18+
- Minimum 4GB RAM, 20GB storage
- SSL certificates for HTTPS

### GitHub Repository Setup
1. **Secrets Configuration** (GitHub Settings > Secrets and variables > Actions):

   ```bash
   # Production Environment
   PRODUCTION_HOST=31.97.222.218
   PRODUCTION_USER=deploy
   PRODUCTION_SSH_KEY=<private-ssh-key>
   PRODUCTION_DATABASE_URL=postgresql://user:pass@localhost:5432/ultimate_prod
   PRODUCTION_REDIS_URL=redis://localhost:6379

   # Staging Environment
   STAGING_HOST=31.97.222.218
   STAGING_USER=deploy
   STAGING_SSH_KEY=<private-ssh-key>
   STAGING_DATABASE_URL=postgresql://user:pass@localhost:5432/ultimate_staging
   STAGING_REDIS_URL=redis://localhost:6379

   # Application Secrets
   JWT_SECRET=<64-char-random-string>
   ENCRYPTION_KEY=<32-char-random-string>
   GOOGLE_CLIENT_ID=<google-oauth-client-id>
   GOOGLE_CLIENT_SECRET=<google-oauth-secret>

   # Monitoring & Notifications
   SLACK_WEBHOOK=<slack-webhook-url>
   SECURITY_SLACK_WEBHOOK=<security-slack-webhook>
   SENTRY_DSN=<sentry-dsn>
   NEW_RELIC_LICENSE_KEY=<new-relic-key>

   # Security Scanning
   SNYK_TOKEN=<snyk-api-token>
   SEMGREP_APP_TOKEN=<semgrep-token>

   # Backup & Storage
   AWS_ACCESS_KEY_ID=<aws-access-key>
   AWS_SECRET_ACCESS_KEY=<aws-secret-key>
   BACKUP_S3_BUCKET=ultimate-production-backups
   ```

2. **Environment Protection Rules**:
   - Production: Require approvals from team leads
   - Staging: Auto-deploy from main branch
   - Enable deployment branch restrictions

### Server Setup

1. **Create deployment user**:
   ```bash
   sudo useradd -m -s /bin/bash deploy
   sudo usermod -aG docker deploy
   sudo mkdir -p /home/deploy/.ssh
   # Add your public SSH key to /home/deploy/.ssh/authorized_keys
   ```

2. **Create deployment directories**:
   ```bash
   sudo mkdir -p /home/deploy/ultimate-production
   sudo mkdir -p /home/deploy/ultimate-staging
   sudo mkdir -p /var/lib/ultimate-production/{postgres,redis,prometheus}
   sudo mkdir -p /var/lib/ultimate-staging/{postgres,redis}
   sudo chown -R deploy:deploy /home/deploy/
   sudo chown -R deploy:deploy /var/lib/ultimate-*
   ```

3. **Install required packages**:
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
   sudo systemctl enable docker nginx
   ```

## Deployment Workflows

### 1. Continuous Integration (.github/workflows/ci.yml)

**Triggers**: Push to main/develop, Pull Requests
**Duration**: ~15-20 minutes

**Stages**:
1. **Lint & Code Quality**: ESLint, Prettier, TypeScript checks
2. **Security Scanning**: npm audit, CodeQL, vulnerability scanning
3. **Testing**: Unit tests, integration tests with PostgreSQL/Redis
4. **Build**: Application builds with artifact storage
5. **Docker**: Multi-stage image builds and registry push
6. **E2E Testing**: End-to-end tests in staging environment
7. **Performance**: Load testing with k6

**Key Features**:
- Parallel job execution for speed
- Comprehensive test matrix (Node.js 18, 20)
- Automated Docker image building and caching
- Security vulnerability scanning
- Code coverage reporting

### 2. Deployment Pipeline (.github/workflows/deploy.yml)

**Triggers**:
- Staging: Push to main branch
- Production: Tagged releases (v*.*.*) or manual dispatch

**Deployment Process**:
1. **Pre-deployment**: Health checks, backup creation
2. **Image Pull**: Latest verified images from registry
3. **Zero-downtime Deployment**: Rolling updates with health checks
4. **Database Migrations**: Automated schema updates
5. **Health Verification**: Comprehensive post-deployment checks
6. **Rollback**: Automatic rollback on failure

**Safety Features**:
- Database backups before deployment
- Health check validation
- Automatic rollback on failure
- Deployment status tracking
- Slack notifications

### 3. Security Scanning (.github/workflows/security.yml)

**Triggers**: Daily scheduled scans, Push events, Manual dispatch

**Security Checks**:
- **Dependency Scanning**: npm audit, Snyk vulnerability scanning
- **SAST**: CodeQL, Semgrep static analysis
- **Secret Scanning**: TruffleHog, GitLeaks
- **Container Security**: Trivy, Grype container scanning
- **IaC Security**: Checkov, Terrascan infrastructure scanning
- **License Compliance**: License compatibility checking
- **DAST**: OWASP ZAP dynamic security testing

## Docker Configuration

### Multi-stage Dockerfile

```dockerfile
# Optimized for production with security and performance
FROM node:18-alpine AS base
# ... (development, build, production stages)
```

**Key Features**:
- Multi-stage builds for optimized images
- Non-root user execution
- Health checks for all services
- Security hardening with read-only filesystems
- Resource limits and reservations

### Environment-specific Compose Files

1. **docker-compose.yml**: Development environment
2. **docker-compose.staging.yml**: Staging with monitoring
3. **docker-compose.production.yml**: Production with HA and security
4. **docker-compose.test.yml**: Testing with E2E and performance

## Environment Configuration

### Development (.env.example)
- Full feature flags enabled
- Debug logging
- Local service URLs
- Development database credentials

### Staging (.env.staging.example)
- Production-like configuration
- Staging domain (test.theprofitplatform.com.au)
- Enhanced logging for debugging
- Limited feature flags

### Production (.env.production.example)
- Maximum security settings
- Production domain (theprofitplatform.com.au)
- Minimal logging
- Performance optimizations
- All security features enabled

## Deployment Script (scripts/deploy.sh)

### Features
- **Zero-downtime deployment**: Rolling updates with health checks
- **Automatic rollback**: Failure detection and automatic recovery
- **Backup management**: Database and application backups
- **Health verification**: Comprehensive service health checks
- **Environment flexibility**: Support for staging and production

### Usage Examples
```bash
# Standard staging deployment
./scripts/deploy.sh --environment staging

# Zero-downtime production deployment
./scripts/deploy.sh --environment production --zero-downtime

# Rollback to previous version
./scripts/deploy.sh --environment production --rollback
```

## Monitoring and Health Checks

### Health Check Script (scripts/health-check.sh)
- **System Health**: Disk space, memory usage
- **Service Health**: Database, Redis, API, Web application
- **External Dependencies**: Google APIs, DNS resolution
- **Security**: SSL certificate validation
- **Performance**: Response time monitoring

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation and analysis
- **Node Exporter**: System metrics

## Database Management

### Backup Strategy (scripts/backup-production.sh)
- **Automated Backups**: Daily production backups
- **S3 Storage**: Secure cloud backup storage
- **Retention Policy**: 30-day retention with lifecycle management
- **Integrity Verification**: Backup validation
- **Notifications**: Slack/email alerts

### Migration Automation
- **GitHub Actions**: Automated migration deployment
- **Rollback Support**: Migration rollback capabilities
- **Validation**: Schema validation and testing

## SSL and Security

### Nginx Configuration (nginx/production.conf)
- **SSL Termination**: TLS 1.2/1.3 with strong ciphers
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: API and authentication protection
- **Load Balancing**: High availability with health checks
- **Caching**: Static asset and API response caching

### Security Features
- **Regular Scanning**: Daily vulnerability scans
- **Container Security**: Image vulnerability scanning
- **Secret Management**: GitHub secrets integration
- **Compliance**: Security policy enforcement

## Scaling and High Availability

### Production Features
- **API Replicas**: Multiple API instances with load balancing
- **Worker Scaling**: Background worker replication
- **Database HA**: PostgreSQL with backup/restore
- **Cache Replication**: Redis clustering support
- **Health Monitoring**: Comprehensive health checks

### Performance Optimization
- **Resource Limits**: Memory and CPU constraints
- **Caching**: Multi-layer caching strategy
- **Compression**: Gzip and image optimization
- **CDN Ready**: Static asset delivery optimization

## Troubleshooting

### Common Issues
1. **Deployment Failures**: Check health endpoints and logs
2. **Database Issues**: Verify connection strings and migrations
3. **SSL Problems**: Validate certificate renewal and configuration
4. **Performance**: Monitor resource usage and scaling needs

### Diagnostic Commands
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs -f api

# Health check
./scripts/health-check.sh

# Manual rollback
./scripts/deploy.sh --rollback --environment production
```

### Log Locations
- Application logs: `./logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `journalctl -u docker`

## Best Practices

### Development
1. Use feature branches for development
2. Run tests locally before pushing
3. Follow conventional commit messages
4. Keep environment files updated

### Deployment
1. Test in staging before production
2. Monitor deployments closely
3. Validate health checks post-deployment
4. Document any manual interventions

### Security
1. Rotate secrets regularly
2. Monitor security scan results
3. Keep dependencies updated
4. Review access permissions quarterly

### Monitoring
1. Set up alerts for critical metrics
2. Review performance regularly
3. Analyze logs for patterns
4. Plan capacity based on growth

## Support and Maintenance

### Regular Tasks
- **Weekly**: Review security scan results
- **Monthly**: Update dependencies and review metrics
- **Quarterly**: Security audit and access review
- **Annually**: Infrastructure review and optimization

### Emergency Procedures
- **Rollback**: Use deployment script rollback feature
- **Scaling**: Update Docker Compose resource limits
- **Incident Response**: Follow monitoring alerts and logs

For additional support, refer to the individual component documentation or contact the development team.