#!/bin/bash

# Production Hive Deployment Script
# Deploys the multi-agent orchestration system to production

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCTION_DIR="/home/avi/production/ultimate-hive"
PM2_APP_NAME="ultimate-hive"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2 globally..."
        sudo npm install -g pm2
    fi
    
    # Check Redis
    if ! redis-cli ping > /dev/null 2>&1; then
        error "Redis is not running. Please start Redis first."
    fi
    
    # Check PostgreSQL
    if ! pg_isready > /dev/null 2>&1; then
        warn "PostgreSQL is not running. Database features will be unavailable."
    fi
    
    success "All prerequisites met"
}

# Create production directory structure
setup_production_dir() {
    log "Setting up production directory..."
    
    # Create main production directory
    mkdir -p "$PRODUCTION_DIR"
    
    # Create subdirectories
    mkdir -p "$PRODUCTION_DIR"/{logs,configs,backups,data}
    
    # Copy hive system files
    log "Copying hive system files..."
    cp -r "$SCRIPT_DIR/hive/"* "$PRODUCTION_DIR/" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/hive-test-spawn/claude-flow.js" "$PRODUCTION_DIR/" 2>/dev/null || true
    
    # Copy production configs
    if [ -f "$SCRIPT_DIR/hive/hive.config.json" ]; then
        cp "$SCRIPT_DIR/hive/hive.config.json" "$PRODUCTION_DIR/configs/hive.config.production.json"
    fi
    
    success "Production directory configured"
}

# Install dependencies
install_dependencies() {
    log "Installing production dependencies..."
    
    cd "$PRODUCTION_DIR"
    
    # Create package.json if it doesn't exist
    if [ ! -f "package.json" ]; then
        cat > package.json << 'EOF'
{
  "name": "ultimate-hive-production",
  "version": "1.0.0",
  "description": "Production deployment of Ultimate Hive orchestration system",
  "main": "orchestrator.js",
  "scripts": {
    "start": "node orchestrator.js",
    "start:logged": "node orchestrator-logged.js",
    "status": "./hive-status.sh",
    "test": "./test-suite.sh"
  },
  "dependencies": {
    "redis": "^4.6.5",
    "uuid": "^9.0.0",
    "express": "^4.18.2",
    "ws": "^8.13.0",
    "dotenv": "^16.0.3",
    "pg": "^8.11.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  }
}
EOF
    fi
    
    # Install production dependencies only
    npm install --production
    
    success "Dependencies installed"
}

# Create PM2 ecosystem config
create_pm2_config() {
    log "Creating PM2 ecosystem configuration..."
    
    cat > "$PRODUCTION_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'hive-orchestrator',
      script: './orchestrator-logged.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      },
      error_file: './logs/orchestrator-error.log',
      out_file: './logs/orchestrator-out.log',
      log_file: './logs/orchestrator-combined.log',
      time: true,
      restart_delay: 5000,
      autorestart: true,
      max_restarts: 10
    },
    {
      name: 'hive-distributor',
      script: './task-distributor.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/distributor-error.log',
      out_file: './logs/distributor-out.log',
      time: true,
      autorestart: true
    },
    {
      name: 'hive-scheduler',
      script: './task-scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      time: true,
      autorestart: true
    },
    {
      name: 'hive-scaler',
      script: './agent-scaler.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scaler-error.log',
      out_file: './logs/scaler-out.log',
      time: true,
      autorestart: true
    },
    {
      name: 'hive-cache',
      script: './task-cache.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/cache-error.log',
      out_file: './logs/cache-out.log',
      time: true,
      autorestart: true
    },
    {
      name: 'hive-analytics',
      script: './performance-analytics.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/analytics-error.log',
      out_file: './logs/analytics-out.log',
      time: true,
      autorestart: true
    }
  ]
};
EOF
    
    success "PM2 configuration created"
}

# Setup systemd service
setup_systemd() {
    log "Setting up systemd service..."
    
    # Create systemd service file
    sudo tee /etc/systemd/system/ultimate-hive.service > /dev/null << EOF
[Unit]
Description=Ultimate Hive Orchestration System
After=network.target redis.service postgresql.service

[Service]
Type=forking
User=avi
Group=avi
WorkingDirectory=$PRODUCTION_DIR
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable service
    sudo systemctl enable ultimate-hive.service
    
    success "Systemd service configured"
}

# Setup Nginx reverse proxy
setup_nginx() {
    log "Setting up Nginx reverse proxy..."
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/hive.theprofitplatform.com.au > /dev/null << 'EOF'
server {
    listen 80;
    server_name hive.theprofitplatform.com.au;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hive.theprofitplatform.com.au;
    
    # SSL configuration will be added by certbot
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/hive.theprofitplatform.com.au /etc/nginx/sites-enabled/
    
    # Test Nginx configuration
    sudo nginx -t
    
    # Reload Nginx
    sudo systemctl reload nginx
    
    success "Nginx configured"
}

# Deploy application
deploy() {
    log "Starting production deployment..."
    
    # Stop existing PM2 processes
    pm2 stop ecosystem.config.js 2>/dev/null || true
    pm2 delete ecosystem.config.js 2>/dev/null || true
    
    # Start with PM2
    cd "$PRODUCTION_DIR"
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup
    pm2 startup systemd -u avi --hp /home/avi
    
    success "Application deployed with PM2"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo
    
    # PM2 status
    pm2 list
    
    echo
    log "Service endpoints:"
    echo "  Main API: http://localhost:8080"
    echo "  WebSocket: ws://localhost:8081"
    echo "  Public URL: https://hive.theprofitplatform.com.au"
    
    echo
    log "Logs location: $PRODUCTION_DIR/logs/"
    
    echo
    # Check service health
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        success "Service is healthy"
    else
        warn "Service health check failed"
    fi
}

# Main deployment flow
main() {
    log "Ultimate Hive Production Deployment"
    log "===================================="
    echo
    
    check_prerequisites
    echo
    
    setup_production_dir
    echo
    
    install_dependencies
    echo
    
    create_pm2_config
    echo
    
    # Only setup systemd and nginx if not already configured
    if [ ! -f "/etc/systemd/system/ultimate-hive.service" ]; then
        setup_systemd
        echo
    fi
    
    if [ ! -f "/etc/nginx/sites-available/hive.theprofitplatform.com.au" ]; then
        setup_nginx
        echo
    fi
    
    deploy
    echo
    
    show_status
    echo
    
    success "Production deployment completed!"
    echo
    log "Next steps:"
    echo "  1. Configure SSL: sudo certbot --nginx -d hive.theprofitplatform.com.au"
    echo "  2. Setup database: psql -c 'CREATE DATABASE ultimate_hive;'"
    echo "  3. Run migrations: cd $PRODUCTION_DIR && npm run migrate"
    echo "  4. Monitor logs: pm2 logs"
}

# Run main function
main "$@"