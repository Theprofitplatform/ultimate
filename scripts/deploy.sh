#!/bin/bash

# Ultimate SEO Platform Deployment Script
# Usage: ./deploy.sh [--zero-downtime] [--rollback] [--environment staging|production]

set -euo pipefail

# Default values
ENVIRONMENT="${ENVIRONMENT:-staging}"
ZERO_DOWNTIME=false
ROLLBACK=false
VERSION="${VERSION:-latest}"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-theprofitplatform/ultimate}"
DEPLOY_TIMESTAMP="${DEPLOY_TIMESTAMP:-$(date +%Y%m%d-%H%M%S)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Ultimate SEO Platform Deployment Script

Usage: $0 [OPTIONS]

Options:
    --zero-downtime     Enable zero-downtime deployment
    --rollback          Rollback to previous version
    --environment ENV   Target environment (staging|production)
    --version VERSION   Version to deploy (default: latest)
    --help             Show this help message

Environment Variables:
    ENVIRONMENT         Target environment
    VERSION             Version to deploy
    REGISTRY            Container registry
    IMAGE_NAME          Image name
    DEPLOY_TIMESTAMP    Deployment timestamp

Examples:
    $0 --environment staging
    $0 --environment production --zero-downtime
    $0 --rollback --environment production
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --zero-downtime)
            ZERO_DOWNTIME=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
    exit 1
fi

# Configuration based on environment
case $ENVIRONMENT in
    staging)
        COMPOSE_FILE="docker-compose.staging.yml"
        BACKUP_DIR="/home/deploy/ultimate-staging/backups"
        DEPLOY_DIR="/home/deploy/ultimate-staging"
        ;;
    production)
        COMPOSE_FILE="docker-compose.production.yml"
        BACKUP_DIR="/home/deploy/ultimate-production/backups"
        DEPLOY_DIR="/home/deploy/ultimate-production"
        ;;
esac

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks for $ENVIRONMENT environment..."

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi

    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        log_error "docker-compose is not installed"
        exit 1
    fi

    # Check if required files exist
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    if [[ ! -f ".env" ]]; then
        log_error "Environment file not found: .env"
        exit 1
    fi

    # Check disk space (require at least 2GB free)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [[ $AVAILABLE_SPACE -lt 2097152 ]]; then
        log_error "Insufficient disk space. At least 2GB required."
        exit 1
    fi

    # Check if backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi

    log_success "Pre-flight checks completed"
}

# Create backup
create_backup() {
    log_info "Creating backup before deployment..."

    # Database backup
    if docker-compose ps postgres | grep -q "Up"; then
        log_info "Creating database backup..."
        docker-compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$BACKUP_DIR/db_backup_$DEPLOY_TIMESTAMP.sql"
        log_success "Database backup created: db_backup_$DEPLOY_TIMESTAMP.sql"
    fi

    # Application backup
    log_info "Creating application backup..."
    tar -czf "$BACKUP_DIR/app_backup_$DEPLOY_TIMESTAMP.tar.gz" \
        docker-compose.yml \
        .env \
        logs/ \
        uploads/ 2>/dev/null || true

    # Create rollback configuration
    if [[ -f "docker-compose.yml" ]]; then
        cp docker-compose.yml docker-compose.rollback.yml
        log_info "Rollback configuration created"
    fi

    # Cleanup old backups (keep last 10)
    cd "$BACKUP_DIR"
    ls -t db_backup_*.sql | tail -n +11 | xargs -r rm
    ls -t app_backup_*.tar.gz | tail -n +11 | xargs -r rm

    log_success "Backup creation completed"
}

# Pull new images
pull_images() {
    log_info "Pulling new images..."

    # Login to registry if needed
    if [[ -n "${GITHUB_TOKEN:-}" ]]; then
        echo "$GITHUB_TOKEN" | docker login "$REGISTRY" -u "$GITHUB_ACTOR" --password-stdin
    fi

    # Pull images
    docker pull "$REGISTRY/$IMAGE_NAME/api:$VERSION"
    docker pull "$REGISTRY/$IMAGE_NAME/web:$VERSION"

    log_success "Images pulled successfully"
}

# Update compose file with new version
update_compose_file() {
    log_info "Updating compose file with version $VERSION..."

    # Update image tags in compose file
    sed -i.bak "s|image: .*api:.*|image: $REGISTRY/$IMAGE_NAME/api:$VERSION|g" "$COMPOSE_FILE"
    sed -i "s|image: .*web:.*|image: $REGISTRY/$IMAGE_NAME/web:$VERSION|g" "$COMPOSE_FILE"

    log_success "Compose file updated"
}

# Standard deployment
standard_deploy() {
    log_info "Starting standard deployment..."

    # Stop services
    log_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down

    # Start services
    log_info "Starting services with new version..."
    docker-compose -f "$COMPOSE_FILE" up -d

    log_success "Standard deployment completed"
}

# Zero-downtime deployment
zero_downtime_deploy() {
    log_info "Starting zero-downtime deployment..."

    # Create temporary compose file for new version
    TEMP_COMPOSE="docker-compose.temp.yml"
    cp "$COMPOSE_FILE" "$TEMP_COMPOSE"

    # Update ports for temporary deployment
    sed -i "s|9090:9090|9091:9090|g" "$TEMP_COMPOSE"
    sed -i "s|3000:80|3001:80|g" "$TEMP_COMPOSE"

    # Start new version alongside old
    log_info "Starting new version alongside current..."
    docker-compose -f "$TEMP_COMPOSE" up -d

    # Wait for health checks
    log_info "Waiting for new version to be healthy..."
    sleep 30

    # Health check new version
    if curl -f http://localhost:9091/health > /dev/null 2>&1; then
        log_info "New version is healthy, switching traffic..."

        # Update load balancer to point to new version
        update_load_balancer_config "new"

        # Wait a bit
        sleep 10

        # Stop old version
        log_info "Stopping old version..."
        docker-compose -f "$COMPOSE_FILE" down

        # Update compose file to use standard ports
        sed -i "s|9091:9090|9090:9090|g" "$TEMP_COMPOSE"
        sed -i "s|3001:80|3000:80|g" "$TEMP_COMPOSE"

        # Restart with correct ports
        docker-compose -f "$TEMP_COMPOSE" down
        cp "$TEMP_COMPOSE" "$COMPOSE_FILE"
        docker-compose -f "$COMPOSE_FILE" up -d

        # Update load balancer back to standard config
        update_load_balancer_config "standard"

        # Cleanup
        rm -f "$TEMP_COMPOSE"

        log_success "Zero-downtime deployment completed"
    else
        log_error "New version failed health check, rolling back..."
        docker-compose -f "$TEMP_COMPOSE" down
        rm -f "$TEMP_COMPOSE"
        exit 1
    fi
}

# Update load balancer configuration
update_load_balancer_config() {
    local config_type="$1"

    log_info "Updating load balancer configuration: $config_type"

    case $config_type in
        "new")
            # Point to temporary ports
            sed -i.bak 's|proxy_pass http://localhost:9090|proxy_pass http://localhost:9091|g' /etc/nginx/sites-available/ultimate
            sed -i 's|proxy_pass http://localhost:3000|proxy_pass http://localhost:3001|g' /etc/nginx/sites-available/ultimate
            ;;
        "standard")
            # Point back to standard ports
            sed -i 's|proxy_pass http://localhost:9091|proxy_pass http://localhost:9090|g' /etc/nginx/sites-available/ultimate
            sed -i 's|proxy_pass http://localhost:3001|proxy_pass http://localhost:3000|g' /etc/nginx/sites-available/ultimate
            ;;
    esac

    # Test and reload Nginx
    sudo nginx -t && sudo systemctl reload nginx
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    # Wait for database to be ready
    sleep 10

    # Run migrations
    docker-compose -f "$COMPOSE_FILE" exec -T api npm run migrate

    log_success "Database migrations completed"
}

# Health checks
health_checks() {
    log_info "Running health checks..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts"

        # API health check
        if curl -f http://localhost:9090/health > /dev/null 2>&1; then
            log_success "API health check passed"
            break
        fi

        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Health checks failed after $max_attempts attempts"
            return 1
        fi

        attempt=$((attempt + 1))
        sleep 10
    done

    # Additional checks
    docker-compose -f "$COMPOSE_FILE" exec -T api npm run health:db || return 1
    docker-compose -f "$COMPOSE_FILE" exec -T api npm run health:redis || return 1

    log_success "All health checks passed"
}

# Rollback function
rollback() {
    log_warning "Starting rollback procedure..."

    if [[ ! -f "docker-compose.rollback.yml" ]]; then
        log_error "No rollback configuration found"
        exit 1
    fi

    # Stop current version
    docker-compose -f "$COMPOSE_FILE" down

    # Start previous version
    docker-compose -f docker-compose.rollback.yml up -d

    # Run health checks
    if health_checks; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed health checks"
        exit 1
    fi
}

# Cleanup old images
cleanup() {
    log_info "Cleaning up old Docker images..."

    # Remove dangling images
    docker image prune -f

    # Remove old versions (keep last 3)
    docker images "$REGISTRY/$IMAGE_NAME/api" --format "table {{.Tag}}\t{{.ID}}" | \
        tail -n +4 | head -n -3 | awk '{print $2}' | xargs -r docker rmi -f

    docker images "$REGISTRY/$IMAGE_NAME/web" --format "table {{.Tag}}\t{{.ID}}" | \
        tail -n +4 | head -n -3 | awk '{print $2}' | xargs -r docker rmi -f

    log_success "Cleanup completed"
}

# Post-deployment tasks
post_deployment() {
    log_info "Running post-deployment tasks..."

    # Update deployment record
    echo "$DEPLOY_TIMESTAMP,$VERSION,$ENVIRONMENT" >> deployments.log

    # Send notification (if configured)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Deployment completed: $ENVIRONMENT environment updated to version $VERSION\"}" \
            "$SLACK_WEBHOOK" || true
    fi

    log_success "Post-deployment tasks completed"
}

# Main deployment function
main() {
    log_info "Starting Ultimate SEO Platform deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $VERSION"
    log_info "Zero-downtime: $ZERO_DOWNTIME"
    log_info "Rollback: $ROLLBACK"

    # Change to deployment directory
    cd "$DEPLOY_DIR"

    if [[ "$ROLLBACK" == "true" ]]; then
        rollback
        exit 0
    fi

    # Run deployment steps
    preflight_checks
    create_backup
    pull_images
    update_compose_file

    if [[ "$ZERO_DOWNTIME" == "true" ]]; then
        zero_downtime_deploy
    else
        standard_deploy
    fi

    run_migrations
    health_checks
    cleanup
    post_deployment

    log_success "Deployment completed successfully!"
    log_info "Version $VERSION is now live on $ENVIRONMENT"
}

# Error handling
trap 'log_error "Deployment failed at line $LINENO. Check logs for details."' ERR

# Run main function
main "$@"