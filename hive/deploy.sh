#!/bin/bash

# Hive System Automated Deployment Script
# Version: 1.0.0
# Purpose: Automated deployment and setup of Hive distributed development system

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
HIVE_DIR="/home/avi/projects/ultimate/hive"
PROJECT_DIR="/home/avi/projects/ultimate"
LOG_FILE="$HIVE_DIR/logs/deployment-$(date +%Y%m%d-%H%M%S).log"
REDIS_PORT=6379
API_PORT=9090
WS_PORT=9092

# Deployment modes
MODE=${1:-"development"}  # development | production | update

# Functions
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log "Checking prerequisites..." "$BLUE"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js version 18+ required (current: $(node -v))"
    fi
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        error "Redis is not installed"
    fi
    
    # Check Redis connection
    if ! redis-cli ping &> /dev/null; then
        warning "Redis is not running. Starting Redis..."
        sudo systemctl start redis-server || error "Failed to start Redis"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check PM2 for production
    if [ "$MODE" = "production" ]; then
        if ! command -v pm2 &> /dev/null; then
            info "Installing PM2 globally..."
            sudo npm install -g pm2
        fi
    fi
    
    log "✓ All prerequisites met" "$GREEN"
}

create_directories() {
    log "Creating directory structure..." "$BLUE"
    
    mkdir -p "$HIVE_DIR"/{logs,dashboard,agents,configs,backups,pids}
    mkdir -p "$PROJECT_DIR"/{apps/api/src,integrations,database,docker,tests}
    
    log "✓ Directories created" "$GREEN"
}

install_dependencies() {
    log "Installing dependencies..." "$BLUE"
    
    cd "$PROJECT_DIR"
    
    # Create package.json if not exists
    if [ ! -f "package.json" ]; then
        cat > package.json << 'EOF'
{
  "name": "ultimate-seo-platform",
  "version": "1.0.0",
  "description": "Ultimate SEO Platform with Hive System",
  "main": "index.js",
  "scripts": {
    "hive:start": "cd hive && npm run start",
    "hive:stop": "cd hive && npm run stop",
    "hive:status": "cd hive && ./hive-status.sh",
    "hive:logs": "tail -f hive/logs/*.log",
    "test": "cd hive && ./test-suite.sh"
  },
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.5",
    "ws": "^8.13.0",
    "uuid": "^9.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOF
    fi
    
    npm install
    
    log "✓ Dependencies installed" "$GREEN"
}

setup_environment() {
    log "Setting up environment..." "$BLUE"
    
    # Create .env file
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        cat > "$PROJECT_DIR/.env" << EOF
NODE_ENV=$MODE
REDIS_HOST=localhost
REDIS_PORT=$REDIS_PORT
API_PORT=$API_PORT
WS_PORT=$WS_PORT
LOG_LEVEL=info
EOF
        chmod 600 "$PROJECT_DIR/.env"
    fi
    
    log "✓ Environment configured" "$GREEN"
}

stop_existing_hive() {
    log "Stopping existing Hive processes..." "$YELLOW"
    
    # Kill existing orchestrator
    pkill -f "orchestrator.*\.js" 2>/dev/null || true
    
    # Kill existing agents
    pkill -f "agent.*\.js" 2>/dev/null || true
    
    # Clear PID files
    rm -f "$HIVE_DIR/pids/*.pid" 2>/dev/null || true
    
    sleep 2
    log "✓ Existing processes stopped" "$GREEN"
}

start_development() {
    log "Starting Hive in development mode..." "$BLUE"
    
    cd "$HIVE_DIR"
    
    # Start orchestrator with logging
    nohup node orchestrator-logged.js > logs/orchestrator.out 2>&1 &
    echo $! > pids/orchestrator.pid
    
    sleep 3
    
    # Start agents
    for agent in agents/*.agent.js; do
        agent_name=$(basename "$agent" .agent.js)
        nohup node "$agent" > "logs/$agent_name.out" 2>&1 &
        echo $! > "pids/$agent_name.pid"
        log "Started $agent_name agent (PID: $!)"
    done
    
    log "✓ Development environment started" "$GREEN"
}

start_production() {
    log "Starting Hive in production mode..." "$BLUE"
    
    # Create PM2 ecosystem file
    cat > "$HIVE_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'hive-orchestrator',
      script: './orchestrator-logged.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/orchestrator-error.log',
      out_file: './logs/orchestrator-out.log',
      log_file: './logs/orchestrator-combined.log',
      time: true
    },
    {
      name: 'hive-agent-backend',
      script: './agents/backend.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-database',
      script: './agents/database.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-frontend',
      script: './agents/frontend.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-devops',
      script: './agents/devops.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-testing',
      script: './agents/testing.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-integration',
      script: './agents/integration.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
EOF
    
    cd "$HIVE_DIR"
    
    # Start with PM2
    pm2 delete ecosystem.config.js 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1 | bash
    
    log "✓ Production environment started with PM2" "$GREEN"
}

verify_deployment() {
    log "Verifying deployment..." "$BLUE"
    
    sleep 5
    
    # Check API
    if curl -s "http://localhost:$API_PORT/api/status" > /dev/null 2>&1; then
        log "✓ API is responding" "$GREEN"
    else
        warning "API is not responding yet"
    fi
    
    # Check WebSocket
    if timeout 2 bash -c "echo 'test' | nc -w 1 localhost $WS_PORT" &>/dev/null; then
        log "✓ WebSocket is listening" "$GREEN"
    else
        warning "WebSocket is not accessible yet"
    fi
    
    # Check agents
    AGENT_COUNT=$(curl -s "http://localhost:$API_PORT/api/agents" 2>/dev/null | grep -o '"id"' | wc -l)
    log "✓ $AGENT_COUNT agents registered" "$GREEN"
    
    # Check Redis
    if redis-cli ping > /dev/null 2>&1; then
        log "✓ Redis is connected" "$GREEN"
    else
        error "Redis connection failed"
    fi
}

setup_monitoring() {
    log "Setting up monitoring..." "$BLUE"
    
    # Create monitoring script
    cat > "$HIVE_DIR/monitor.sh" << 'EOF'
#!/bin/bash
source /root/automation/scripts/common/utils.sh 2>/dev/null || true

check_component() {
    local name=$1
    local check_cmd=$2
    
    if eval "$check_cmd" > /dev/null 2>&1; then
        echo "✓ $name: OK"
        return 0
    else
        echo "✗ $name: FAILED"
        return 1
    fi
}

echo "=== Hive System Monitor ==="
echo "Time: $(date)"
echo ""

check_component "Redis" "redis-cli ping"
check_component "API" "curl -s http://localhost:9090/api/status"
check_component "WebSocket" "timeout 1 nc -z localhost 9092"
check_component "Dashboard" "curl -s http://localhost:9090"

echo ""
echo "Agent Status:"
curl -s http://localhost:9090/api/agents 2>/dev/null | python3 -c "
import sys, json
try:
    agents = json.load(sys.stdin)
    for agent in agents:
        print(f\"  - {agent.get('name', 'Unknown')}: {agent.get('status', 'Unknown')}\")
except:
    print('  Unable to fetch agent status')
"

echo ""
echo "Recent Logs:"
tail -5 /home/avi/projects/ultimate/hive/logs/orchestrator.log 2>/dev/null | grep -E "INFO|WARN|ERROR" || echo "No recent logs"
EOF
    
    chmod +x "$HIVE_DIR/monitor.sh"
    
    # Add to cron for hourly monitoring
    if [ "$MODE" = "production" ]; then
        (crontab -l 2>/dev/null | grep -v "hive/monitor.sh"; echo "0 * * * * $HIVE_DIR/monitor.sh >> $HIVE_DIR/logs/monitor.log 2>&1") | crontab -
        log "✓ Hourly monitoring configured" "$GREEN"
    fi
    
    log "✓ Monitoring setup complete" "$GREEN"
}

create_backup() {
    log "Creating deployment backup..." "$BLUE"
    
    BACKUP_DIR="$HIVE_DIR/backups"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/hive-backup-$TIMESTAMP.tar.gz"
    
    tar -czf "$BACKUP_FILE" \
        --exclude="$HIVE_DIR/logs/*" \
        --exclude="$HIVE_DIR/backups/*" \
        --exclude="$HIVE_DIR/pids/*" \
        "$HIVE_DIR" 2>/dev/null
    
    log "✓ Backup created: $BACKUP_FILE" "$GREEN"
}

show_status() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}  Hive Deployment Complete!${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Access Points:${NC}"
    echo -e "  Dashboard: ${BLUE}http://localhost:$API_PORT${NC}"
    echo -e "  API:       ${BLUE}http://localhost:$API_PORT/api${NC}"
    echo -e "  WebSocket: ${BLUE}ws://localhost:$WS_PORT${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  Status:  ${GREEN}$HIVE_DIR/hive-status.sh${NC}"
    echo -e "  Monitor: ${GREEN}$HIVE_DIR/monitor.sh${NC}"
    echo -e "  Test:    ${GREEN}$HIVE_DIR/test-suite.sh${NC}"
    echo -e "  Logs:    ${GREEN}tail -f $HIVE_DIR/logs/*.log${NC}"
    echo ""
    
    if [ "$MODE" = "production" ]; then
        echo -e "${YELLOW}PM2 Commands:${NC}"
        echo -e "  List:    ${GREEN}pm2 list${NC}"
        echo -e "  Logs:    ${GREEN}pm2 logs${NC}"
        echo -e "  Restart: ${GREEN}pm2 restart all${NC}"
        echo -e "  Stop:    ${GREEN}pm2 stop all${NC}"
        echo ""
    fi
    
    echo -e "${BLUE}========================================${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}=== Hive System Deployment ===${NC}"
    echo -e "Mode: ${YELLOW}$MODE${NC}"
    echo ""
    
    # Ensure log directory exists
    mkdir -p "$HIVE_DIR/logs"
    
    check_prerequisites
    
    if [ "$MODE" != "update" ]; then
        stop_existing_hive
    fi
    
    create_directories
    install_dependencies
    setup_environment
    
    case "$MODE" in
        "development")
            start_development
            ;;
        "production")
            start_production
            ;;
        "update")
            info "Update mode - only updating configuration"
            ;;
        *)
            error "Invalid mode: $MODE (use: development|production|update)"
            ;;
    esac
    
    verify_deployment
    setup_monitoring
    create_backup
    show_status
    
    log "Deployment completed successfully!" "$GREEN"
    log "Full log: $LOG_FILE"
}

# Handle errors
trap 'error "Deployment failed at line $LINENO"' ERR

# Run main function
main