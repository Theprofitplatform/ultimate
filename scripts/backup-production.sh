#!/bin/bash

# Production Database Backup Script for Ultimate SEO Platform
# Automated backup with S3 upload and retention management

set -euo pipefail

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-ultimate_user}"
POSTGRES_DB="${POSTGRES_DB:-ultimate_production}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ultimate_prod_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# AWS S3 Configuration
S3_BUCKET="${S3_BUCKET:-ultimate-production-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} INFO: $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} SUCCESS: $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} WARNING: $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ERROR: $1"
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."

    # Check if PostgreSQL is available
    if ! pg_isready -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
        log_error "PostgreSQL is not available"
        exit 1
    fi

    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi

    # Check disk space (require at least 5GB free)
    AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    if [[ $AVAILABLE_SPACE -lt 5242880 ]]; then
        log_error "Insufficient disk space. At least 5GB required."
        exit 1
    fi

    # Check AWS CLI if S3 backup is enabled
    if [[ -n "$S3_BUCKET" ]]; then
        if ! command -v aws > /dev/null 2>&1; then
            log_warning "AWS CLI not found. S3 backup will be skipped."
            S3_BUCKET=""
        else
            # Test AWS credentials
            if ! aws s3 ls "s3://$S3_BUCKET" > /dev/null 2>&1; then
                log_warning "Cannot access S3 bucket: $S3_BUCKET"
                S3_BUCKET=""
            fi
        fi
    fi

    log_success "Pre-flight checks completed"
}

# Create database backup
create_backup() {
    log_info "Creating database backup..."

    # Create backup with compression
    if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --no-password \
        --verbose \
        --format=custom \
        --compress=9 \
        --file="$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then

        log_success "Database backup created: $BACKUP_FILE"

        # Get backup file size
        BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log_info "Backup size: $BACKUP_SIZE"

        return 0
    else
        log_error "Failed to create database backup"
        return 1
    fi
}

# Compress backup
compress_backup() {
    log_info "Compressing backup..."

    if gzip -9 "$BACKUP_DIR/$BACKUP_FILE"; then
        log_success "Backup compressed: $COMPRESSED_FILE"

        # Get compressed file size
        COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)
        log_info "Compressed size: $COMPRESSED_SIZE"

        return 0
    else
        log_error "Failed to compress backup"
        return 1
    fi
}

# Upload to S3
upload_to_s3() {
    if [[ -z "$S3_BUCKET" ]]; then
        log_info "S3 upload skipped (no bucket configured)"
        return 0
    fi

    log_info "Uploading backup to S3..."

    local s3_key="database/production/$(date +%Y/%m/%d)/$COMPRESSED_FILE"

    if aws s3 cp "$BACKUP_DIR/$COMPRESSED_FILE" "s3://$S3_BUCKET/$s3_key" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA \
        --metadata "backup-type=database,environment=production,timestamp=$TIMESTAMP"; then

        log_success "Backup uploaded to S3: s3://$S3_BUCKET/$s3_key"

        # Set lifecycle policy for automatic deletion
        if aws s3api put-object-tagging \
            --bucket "$S3_BUCKET" \
            --key "$s3_key" \
            --tagging "TagSet=[{Key=backup-type,Value=database},{Key=environment,Value=production},{Key=auto-delete,Value=true}]" \
            --region "$AWS_REGION" > /dev/null 2>&1; then
            log_info "S3 lifecycle tags applied"
        fi

        return 0
    else
        log_error "Failed to upload backup to S3"
        return 1
    fi
}

# Clean up old local backups
cleanup_local_backups() {
    log_info "Cleaning up old local backups..."

    # Find and delete backups older than retention period
    local deleted_count=0

    while IFS= read -r -d '' old_backup; do
        rm -f "$old_backup"
        deleted_count=$((deleted_count + 1))
        log_info "Deleted old backup: $(basename "$old_backup")"
    done < <(find "$BACKUP_DIR" -name "ultimate_prod_backup_*.sql.gz" -mtime +$RETENTION_DAYS -print0 2>/dev/null)

    if [[ $deleted_count -gt 0 ]]; then
        log_success "Cleaned up $deleted_count old backup(s)"
    else
        log_info "No old backups to clean up"
    fi
}

# Clean up old S3 backups
cleanup_s3_backups() {
    if [[ -z "$S3_BUCKET" ]]; then
        return 0
    fi

    log_info "Cleaning up old S3 backups..."

    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)

    # List and delete old S3 objects
    local deleted_count=0

    while IFS= read -r s3_key; do
        if [[ -n "$s3_key" ]]; then
            if aws s3 rm "s3://$S3_BUCKET/$s3_key" --region "$AWS_REGION" > /dev/null 2>&1; then
                deleted_count=$((deleted_count + 1))
                log_info "Deleted old S3 backup: $s3_key"
            fi
        fi
    done < <(aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "database/production/" \
        --query "Contents[?LastModified<='$cutoff_date'].Key" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null)

    if [[ $deleted_count -gt 0 ]]; then
        log_success "Cleaned up $deleted_count old S3 backup(s)"
    else
        log_info "No old S3 backups to clean up"
    fi
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."

    # Test if the backup can be read
    if pg_restore --list "$BACKUP_DIR/$COMPRESSED_FILE" > /dev/null 2>&1; then
        log_success "Backup integrity verified"
        return 0
    else
        log_error "Backup integrity check failed"
        return 1
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"

    # Slack notification
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        local color="good"
        local emoji="✅"

        if [[ "$status" != "success" ]]; then
            color="danger"
            emoji="❌"
        fi

        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"text\": \"$emoji Production Database Backup\",
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"fields\": [{
                        \"title\": \"Status\",
                        \"value\": \"$status\",
                        \"short\": true
                    }, {
                        \"title\": \"Message\",
                        \"value\": \"$message\",
                        \"short\": false
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date)\",
                        \"short\": true
                    }, {
                        \"title\": \"Database\",
                        \"value\": \"$POSTGRES_DB\",
                        \"short\": true
                    }]
                }]
            }" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || true
    fi

    # Email notification (if configured)
    if [[ -n "${EMAIL_RECIPIENTS:-}" ]] && command -v mail > /dev/null 2>&1; then
        echo "$message" | mail -s "Production Database Backup - $status" "$EMAIL_RECIPIENTS" || true
    fi
}

# Main backup function
main() {
    log_info "Starting production database backup"
    log_info "Database: $POSTGRES_DB"
    log_info "Timestamp: $TIMESTAMP"

    local backup_status="success"
    local error_message=""

    # Run backup process
    if preflight_checks && \
       create_backup && \
       verify_backup && \
       compress_backup && \
       upload_to_s3; then

        # Cleanup after successful backup
        cleanup_local_backups
        cleanup_s3_backups

        log_success "Production database backup completed successfully"
        send_notification "success" "Database backup completed successfully. File: $COMPRESSED_FILE"

    else
        backup_status="failed"
        error_message="One or more backup steps failed. Check logs for details."

        log_error "Production database backup failed"
        send_notification "failed" "$error_message"

        exit 1
    fi
}

# Error handling
trap 'log_error "Backup script failed at line $LINENO"' ERR

# Set PostgreSQL password if provided
if [[ -n "${PGPASSWORD:-}" ]]; then
    export PGPASSWORD
fi

# Run main function
main "$@"