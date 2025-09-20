#!/bin/bash

# Ultimate SEO Platform - Full Stack Deployment Script
# Deploys the complete platform: Database, API, Frontend, and Hive System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_BASE="/home/avi/production/ultimate"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Check if running as root (for certain operations)
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Use sudo for specific commands."
    fi
}

# Check all prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing=()
    
    # Check required commands
    command -v node >/dev/null 2>&1 || missing+=("Node.js")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    command -v pm2 >/dev/null 2>&1 || missing+=("PM2")
    command -v nginx >/dev/null 2>&1 || missing+=("Nginx")
    command -v psql >/dev/null 2>&1 || missing+=("PostgreSQL client")
    command -v redis-cli >/dev/null 2>&1 || missing+=("Redis client")
    
    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing prerequisites: ${missing[*]}"
    fi
    
    # Check services
    if ! redis-cli ping >/dev/null 2>&1; then
        warn "Redis is not running. Starting Redis..."
        sudo systemctl start redis-server || error "Failed to start Redis"
    fi
    
    if ! pg_isready >/dev/null 2>&1; then
        warn "PostgreSQL is not running. Starting PostgreSQL..."
        sudo systemctl start postgresql || error "Failed to start PostgreSQL"
    fi
    
    success "All prerequisites met"
}

# Initialize PostgreSQL database
setup_database() {
    log "Setting up PostgreSQL database..."
    
    # Check if database exists
    if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw ultimate_seo; then
        info "Database 'ultimate_seo' already exists"
    else
        log "Creating database 'ultimate_seo'..."
        sudo -u postgres createdb ultimate_seo || error "Failed to create database"
        
        log "Applying database schema..."
        sudo -u postgres psql ultimate_seo < "$SCRIPT_DIR/database/schema.sql" || error "Failed to apply schema"
        
        success "Database created and schema applied"
    fi
    
    # Create application user if not exists
    if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ultimate_user'" | grep -q 1; then
        log "Creating database user 'ultimate_user'..."
        sudo -u postgres psql << EOF
CREATE USER ultimate_user WITH PASSWORD 'ultimate_secure_pass_2025';
GRANT CONNECT ON DATABASE ultimate_seo TO ultimate_user;
GRANT USAGE ON SCHEMA auth, core, seo, analytics, hive TO ultimate_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, core, seo, analytics, hive TO ultimate_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth, core, seo, analytics, hive TO ultimate_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, core, seo, analytics, hive GRANT ALL ON TABLES TO ultimate_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, core, seo, analytics, hive GRANT ALL ON SEQUENCES TO ultimate_user;
EOF
        success "Database user created"
    fi
}

# Setup production directories
setup_directories() {
    log "Setting up production directories..."
    
    mkdir -p "$PRODUCTION_BASE"/{api,web,hive,configs,logs,backups}
    
    # Copy source files
    log "Copying application files..."
    
    # API
    if [ -d "$SCRIPT_DIR/apps/api" ]; then
        cp -r "$SCRIPT_DIR/apps/api/"* "$PRODUCTION_BASE/api/" 2>/dev/null || true
    fi
    
    # Web
    if [ -d "$SCRIPT_DIR/apps/web" ]; then
        cp -r "$SCRIPT_DIR/apps/web/"* "$PRODUCTION_BASE/web/" 2>/dev/null || true
    fi
    
    # Hive
    if [ -d "$SCRIPT_DIR/hive" ]; then
        cp -r "$SCRIPT_DIR/hive/"* "$PRODUCTION_BASE/hive/" 2>/dev/null || true
    fi
    
    success "Production directories configured"
}

# Setup environment variables
setup_environment() {
    log "Configuring environment variables..."
    
    # API environment
    cat > "$PRODUCTION_BASE/api/.env" << EOF
NODE_ENV=production
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ultimate_seo
DB_USER=ultimate_user
DB_PASSWORD=ultimate_secure_pass_2025

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# API
API_URL=https://api.theprofitplatform.com.au
FRONTEND_URL=https://seo.theprofitplatform.com.au

# Email (configure with your SMTP)
EMAIL_FROM=noreply@theprofitplatform.com.au
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Google OAuth (configure with your credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.theprofitplatform.com.au/auth/google/callback
EOF
    
    # Web environment
    cat > "$PRODUCTION_BASE/web/.env.production" << EOF
NEXT_PUBLIC_API_URL=https://api.theprofitplatform.com.au
NEXT_PUBLIC_APP_URL=https://seo.theprofitplatform.com.au
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
EOF
    
    # Hive environment
    cat > "$PRODUCTION_BASE/hive/.env" << EOF
NODE_ENV=production
REDIS_HOST=localhost
REDIS_PORT=6379
ORCHESTRATOR_PORT=8080
WS_PORT=8081
EOF
    
    success "Environment variables configured"
}

# Install dependencies
install_dependencies() {
    log "Installing production dependencies..."
    
    # API dependencies
    if [ -d "$PRODUCTION_BASE/api" ]; then
        cd "$PRODUCTION_BASE/api"
        npm ci --production || npm install --production
    fi
    
    # Web dependencies and build
    if [ -d "$PRODUCTION_BASE/web" ]; then
        cd "$PRODUCTION_BASE/web"
        npm ci || npm install
        npm run build
    fi
    
    # Hive dependencies
    if [ -d "$PRODUCTION_BASE/hive" ]; then
        cd "$PRODUCTION_BASE/hive"
        npm ci --production || npm install --production
    fi
    
    success "Dependencies installed"
}

# Configure PM2 ecosystem
setup_pm2() {
    log "Configuring PM2 ecosystem..."
    
    cat > "$PRODUCTION_BASE/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    // API Server
    {
      name: 'ultimate-api',
      script: './api/server.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      time: true
    },
    
    // Next.js Frontend
    {
      name: 'ultimate-web',
      script: 'npm',
      args: 'start',
      cwd: './web',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '../logs/web-error.log',
      out_file: '../logs/web-out.log',
      time: true
    },
    
    // Hive Orchestrator
    {
      name: 'hive-orchestrator',
      script: './hive/orchestrator-logged.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/hive-error.log',
      out_file: './logs/hive-out.log',
      time: true
    }
  ]
};
EOF
    
    success "PM2 ecosystem configured"
}

# Configure Nginx
setup_nginx() {
    log "Configuring Nginx..."
    
    # API domain
    sudo tee /etc/nginx/sites-available/api.theprofitplatform.com.au > /dev/null << 'EOF'
server {
    listen 80;
    server_name api.theprofitplatform.com.au;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.theprofitplatform.com.au;
    
    # SSL configuration (will be updated by certbot)
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "https://seo.theprofitplatform.com.au" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Allow-Credentials true always;
    }
}
EOF
    
    # Frontend domain
    sudo tee /etc/nginx/sites-available/seo.theprofitplatform.com.au > /dev/null << 'EOF'
server {
    listen 80;
    server_name seo.theprofitplatform.com.au;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seo.theprofitplatform.com.au;
    
    # SSL configuration (will be updated by certbot)
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable sites
    sudo ln -sf /etc/nginx/sites-available/api.theprofitplatform.com.au /etc/nginx/sites-enabled/
    sudo ln -sf /etc/nginx/sites-available/seo.theprofitplatform.com.au /etc/nginx/sites-enabled/
    
    # Test configuration
    sudo nginx -t || error "Nginx configuration test failed"
    
    # Reload Nginx
    sudo systemctl reload nginx
    
    success "Nginx configured"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    # Check if certbot is installed
    if ! command -v certbot >/dev/null 2>&1; then
        log "Installing certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Get certificates for API
    if [ ! -d "/etc/letsencrypt/live/api.theprofitplatform.com.au" ]; then
        sudo certbot --nginx -d api.theprofitplatform.com.au \
            --non-interactive --agree-tos \
            --email admin@theprofitplatform.com.au || warn "Failed to get SSL for API"
    fi
    
    # Get certificates for Frontend
    if [ ! -d "/etc/letsencrypt/live/seo.theprofitplatform.com.au" ]; then
        sudo certbot --nginx -d seo.theprofitplatform.com.au \
            --non-interactive --agree-tos \
            --email admin@theprofitplatform.com.au || warn "Failed to get SSL for Frontend"
    fi
    
    success "SSL certificates configured"
}

# Deploy with PM2
deploy_pm2() {
    log "Deploying applications with PM2..."
    
    cd "$PRODUCTION_BASE"
    
    # Stop existing processes
    pm2 stop ecosystem.config.js 2>/dev/null || true
    pm2 delete ecosystem.config.js 2>/dev/null || true
    
    # Start applications
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup startup script
    pm2 startup systemd -u $USER --hp /home/$USER
    
    success "Applications deployed with PM2"
}

# Setup monitoring and backups
setup_monitoring() {
    log "Setting up monitoring and backups..."
    
    # Create backup script
    cat > "$PRODUCTION_BASE/backup.sh" << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/avi/production/ultimate/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
pg_dump -U ultimate_user -h localhost ultimate_seo | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF
    
    chmod +x "$PRODUCTION_BASE/backup.sh"
    
    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * $PRODUCTION_BASE/backup.sh") | crontab -
    
    success "Monitoring and backups configured"
}

# Show deployment status
show_status() {
    echo
    log "=== Deployment Status ==="
    echo
    
    # PM2 status
    pm2 list
    
    echo
    log "Service URLs:"
    echo "  API:       https://api.theprofitplatform.com.au"
    echo "  Frontend:  https://seo.theprofitplatform.com.au"
    echo "  Hive:      http://localhost:8080"
    echo
    
    log "Database:"
    echo "  Name: ultimate_seo"
    echo "  User: ultimate_user"
    echo
    
    log "Logs:"
    echo "  PM2 logs:  pm2 logs"
    echo "  Log files: $PRODUCTION_BASE/logs/"
    echo
    
    # Check services
    local api_status="❌"
    local web_status="❌"
    local hive_status="❌"
    
    curl -s http://localhost:3001/health >/dev/null 2>&1 && api_status="✅"
    curl -s http://localhost:3000 >/dev/null 2>&1 && web_status="✅"
    curl -s http://localhost:8080/health >/dev/null 2>&1 && hive_status="✅"
    
    log "Health Checks:"
    echo "  API:  $api_status"
    echo "  Web:  $web_status"
    echo "  Hive: $hive_status"
}

# Main deployment flow
main() {
    echo
    echo "========================================="
    echo "  Ultimate SEO Platform - Full Stack"
    echo "        Production Deployment"
    echo "========================================="
    echo
    
    check_permissions
    check_prerequisites
    echo
    
    setup_database
    echo
    
    setup_directories
    echo
    
    setup_environment
    echo
    
    install_dependencies
    echo
    
    setup_pm2
    echo
    
    setup_nginx
    echo
    
    # Skip SSL in development/testing
    if [ "${1:-}" != "--skip-ssl" ]; then
        setup_ssl
        echo
    fi
    
    deploy_pm2
    echo
    
    setup_monitoring
    echo
    
    show_status
    echo
    
    success "🚀 Full stack deployment completed!"
    echo
    log "Next steps:"
    echo "  1. Configure environment variables in $PRODUCTION_BASE/{api,web,hive}/.env"
    echo "  2. Set up Google OAuth credentials"
    echo "  3. Configure SMTP for emails"
    echo "  4. Monitor logs: pm2 logs"
    echo "  5. Access dashboard: https://seo.theprofitplatform.com.au"
}

# Run main function
main "$@"