#!/bin/bash

# Hive System Backup and Recovery Script
# Version: 1.0.0

set -euo pipefail

# Configuration
HIVE_DIR="/home/avi/projects/ultimate/hive"
PROJECT_DIR="/home/avi/projects/ultimate"
BACKUP_DIR="/home/avi/projects/ultimate/hive/backups"
BACKUP_RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Operation mode
OPERATION=${1:-"help"}
BACKUP_FILE=${2:-""}

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Create backup
create_backup() {
    log "Starting Hive system backup..."
    
    # Create backup directory if not exists
    mkdir -p "$BACKUP_DIR"
    
    # Define backup file name
    local backup_name="hive-backup-${TIMESTAMP}"
    local backup_file="${BACKUP_DIR}/${backup_name}.tar.gz"
    local backup_manifest="${BACKUP_DIR}/${backup_name}.manifest"
    
    # Stop Hive system for consistent backup
    info "Stopping Hive system for backup..."
    if command -v pm2 &> /dev/null && pm2 list | grep -q "hive"; then
        pm2 stop all 2>/dev/null || true
        local pm2_running=true
    else
        pkill -f "orchestrator.*\.js" 2>/dev/null || true
        pkill -f "agent.*\.js" 2>/dev/null || true
    fi
    
    # Wait for processes to stop
    sleep 3
    
    # Create backup manifest
    cat > "$backup_manifest" << EOF
Backup Date: $(date)
Backup Type: Full System Backup
Hive Version: 1.0.0
Node Version: $(node -v)
Redis Version: $(redis-cli --version | awk '{print $2}')
System: $(uname -a)

Included Components:
- Configuration files
- Agent scripts
- Dashboard files
- Orchestrator
- Task distributor
- Test suites
- Documentation
- Environment settings

Excluded:
- Log files (*.log)
- PID files (*.pid)
- Node modules
- Previous backups
EOF
    
    # Export Redis data
    info "Exporting Redis data..."
    redis-cli --rdb "$BACKUP_DIR/${backup_name}-redis.rdb" 2>/dev/null || warning "Could not export Redis data"
    
    # Create environment backup
    info "Backing up environment..."
    if [ -f "$PROJECT_DIR/.env" ]; then
        cp "$PROJECT_DIR/.env" "$BACKUP_DIR/${backup_name}.env"
    fi
    
    # Create main backup
    info "Creating backup archive..."
    tar -czf "$backup_file" \
        --exclude="$HIVE_DIR/logs/*.log" \
        --exclude="$HIVE_DIR/backups/*" \
        --exclude="$HIVE_DIR/pids/*.pid" \
        --exclude="node_modules" \
        -C "$PROJECT_DIR" \
        hive/ \
        package.json \
        package-lock.json 2>/dev/null || true
    
    # Calculate backup size
    local backup_size=$(du -h "$backup_file" | cut -f1)
    
    # Restart Hive system if it was running
    if [ "${pm2_running:-false}" = true ]; then
        info "Restarting Hive system with PM2..."
        pm2 restart all
    else
        info "Restarting Hive system..."
        cd "$HIVE_DIR"
        nohup node orchestrator-logged.js > /dev/null 2>&1 &
    fi
    
    # Clean old backups
    clean_old_backups
    
    # Success message
    echo ""
    echo -e "${GREEN}✅ Backup completed successfully!${NC}"
    echo -e "Backup file: ${BLUE}$backup_file${NC}"
    echo -e "Backup size: ${YELLOW}$backup_size${NC}"
    echo -e "Manifest: ${BLUE}$backup_manifest${NC}"
    
    # Verify backup
    verify_backup "$backup_file"
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    log "Starting Hive system restore from: $backup_file"
    
    # Confirm restore
    echo -e "${YELLOW}⚠️  WARNING: This will replace the current Hive system${NC}"
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r confirmation
    
    if [ "$confirmation" != "yes" ]; then
        info "Restore cancelled"
        exit 0
    fi
    
    # Create restore directory
    local restore_dir="${BACKUP_DIR}/restore-${TIMESTAMP}"
    mkdir -p "$restore_dir"
    
    # Stop current system
    info "Stopping current Hive system..."
    if command -v pm2 &> /dev/null && pm2 list | grep -q "hive"; then
        pm2 delete all 2>/dev/null || true
    fi
    pkill -f "orchestrator.*\.js" 2>/dev/null || true
    pkill -f "agent.*\.js" 2>/dev/null || true
    
    # Backup current system before restore
    info "Creating safety backup of current system..."
    tar -czf "${restore_dir}/pre-restore-backup.tar.gz" \
        -C "$PROJECT_DIR" \
        hive/ 2>/dev/null || true
    
    # Extract backup
    info "Extracting backup..."
    tar -xzf "$backup_file" -C "$PROJECT_DIR"
    
    # Restore Redis data if available
    local backup_name=$(basename "$backup_file" .tar.gz)
    local redis_backup="${BACKUP_DIR}/${backup_name}-redis.rdb"
    
    if [ -f "$redis_backup" ]; then
        info "Restoring Redis data..."
        sudo systemctl stop redis-server
        sudo cp "$redis_backup" /var/lib/redis/dump.rdb
        sudo chown redis:redis /var/lib/redis/dump.rdb
        sudo systemctl start redis-server
    fi
    
    # Restore environment file
    local env_backup="${BACKUP_DIR}/${backup_name}.env"
    if [ -f "$env_backup" ]; then
        info "Restoring environment configuration..."
        cp "$env_backup" "$PROJECT_DIR/.env"
        chmod 600 "$PROJECT_DIR/.env"
    fi
    
    # Install dependencies
    info "Installing dependencies..."
    cd "$PROJECT_DIR"
    npm install
    
    # Set permissions
    info "Setting permissions..."
    chmod +x "$HIVE_DIR"/*.sh 2>/dev/null || true
    chmod +x "$HIVE_DIR"/agents/*.js 2>/dev/null || true
    
    # Start restored system
    info "Starting restored Hive system..."
    cd "$HIVE_DIR"
    if [ -f "ecosystem.config.js" ] && command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js
    else
        nohup node orchestrator-logged.js > logs/orchestrator.out 2>&1 &
    fi
    
    # Verify restoration
    sleep 5
    if curl -s "http://localhost:9090/api/status" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Restore completed successfully!${NC}"
        echo -e "System is running at: ${BLUE}http://localhost:9090${NC}"
    else
        warning "System may still be starting up. Check status with: $HIVE_DIR/hive-status.sh"
    fi
}

# List available backups
list_backups() {
    log "Available Hive backups:"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR"/*.tar.gz 2>/dev/null)" ]; then
        info "No backups found"
        return
    fi
    
    printf "%-40s %-10s %-20s\n" "Backup File" "Size" "Date"
    printf "%-40s %-10s %-20s\n" "----------------------------------------" "----------" "--------------------"
    
    for backup in "$BACKUP_DIR"/*.tar.gz; do
        if [ -f "$backup" ]; then
            local filename=$(basename "$backup")
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -c %y "$backup" | cut -d' ' -f1,2 | cut -d'.' -f1)
            printf "%-40s %-10s %-20s\n" "$filename" "$size" "$date"
        fi
    done
    
    echo ""
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    echo -e "Total backup size: ${YELLOW}$total_size${NC}"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    info "Verifying backup integrity..."
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    # Test archive integrity
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Archive integrity verified${NC}"
    else
        error "Backup archive is corrupted"
    fi
    
    # Check essential files in backup
    local essential_files=(
        "hive/orchestrator.js"
        "hive/orchestrator-logged.js"
        "hive/hive.config.json"
        "hive/agents/backend.agent.js"
    )
    
    for file in "${essential_files[@]}"; do
        if tar -tzf "$backup_file" | grep -q "$file"; then
            echo -e "${GREEN}✓ Found: $file${NC}"
        else
            warning "Missing: $file"
        fi
    done
}

# Clean old backups
clean_old_backups() {
    info "Cleaning old backups (older than $BACKUP_RETENTION_DAYS days)..."
    
    find "$BACKUP_DIR" -name "hive-backup-*.tar.gz" -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "hive-backup-*.manifest" -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "hive-backup-*.env" -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*-redis.rdb" -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    
    local removed_count=$(find "$BACKUP_DIR" -name "hive-backup-*" -mtime +$BACKUP_RETENTION_DAYS 2>/dev/null | wc -l)
    if [ "$removed_count" -gt 0 ]; then
        log "Removed $removed_count old backup files"
    fi
}

# Schedule automated backups
schedule_backups() {
    log "Setting up automated daily backups..."
    
    # Create cron entry
    local cron_entry="0 2 * * * $HIVE_DIR/backup-restore.sh backup >> $HIVE_DIR/logs/backup.log 2>&1"
    
    # Check if already scheduled
    if crontab -l 2>/dev/null | grep -q "backup-restore.sh"; then
        warning "Automated backups already scheduled"
    else
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        echo -e "${GREEN}✅ Automated daily backups scheduled at 2:00 AM${NC}"
    fi
    
    # Show current schedule
    echo ""
    info "Current backup schedule:"
    crontab -l | grep "backup-restore.sh" || echo "No backups scheduled"
}

# Remove scheduled backups
unschedule_backups() {
    log "Removing automated backup schedule..."
    
    crontab -l 2>/dev/null | grep -v "backup-restore.sh" | crontab -
    echo -e "${GREEN}✅ Automated backups unscheduled${NC}"
}

# Show help
show_help() {
    echo -e "${BLUE}Hive System Backup and Recovery Tool${NC}"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  backup              Create a full system backup"
    echo "  restore <file>      Restore from a backup file"
    echo "  list                List available backups"
    echo "  verify <file>       Verify backup integrity"
    echo "  clean               Remove old backups"
    echo "  schedule            Set up automated daily backups"
    echo "  unschedule          Remove automated backups"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore /path/to/backup.tar.gz"
    echo "  $0 list"
    echo "  $0 verify hive-backup-20250908-120000.tar.gz"
    echo ""
    echo "Backup location: $BACKUP_DIR"
    echo "Retention period: $BACKUP_RETENTION_DAYS days"
}

# Main execution
case "$OPERATION" in
    backup)
        create_backup
        ;;
    restore)
        if [ -z "$BACKUP_FILE" ]; then
            error "Please specify a backup file to restore"
        fi
        restore_backup "$BACKUP_FILE"
        ;;
    list)
        list_backups
        ;;
    verify)
        if [ -z "$BACKUP_FILE" ]; then
            error "Please specify a backup file to verify"
        fi
        verify_backup "$BACKUP_FILE"
        ;;
    clean)
        clean_old_backups
        echo -e "${GREEN}✅ Old backups cleaned${NC}"
        ;;
    schedule)
        schedule_backups
        ;;
    unschedule)
        unschedule_backups
        ;;
    help|*)
        show_help
        ;;
esac