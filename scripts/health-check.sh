#!/bin/bash

# Health Check Script for Ultimate SEO Platform
# This script performs comprehensive health checks on all services

set -euo pipefail

# Configuration
API_PORT="${API_PORT:-9090}"
WS_PORT="${WS_PORT:-9092}"
TIMEOUT="${TIMEOUT:-10}"
RETRIES="${RETRIES:-3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Health check result
HEALTH_STATUS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    HEALTH_STATUS=1
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Make HTTP request with retries
http_check() {
    local url="$1"
    local description="$2"
    local expected_status="${3:-200}"

    log_info "Checking $description..."

    for i in $(seq 1 $RETRIES); do
        if command_exists curl; then
            if response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null); then
                status_code="${response: -3}"
                if [[ "$status_code" == "$expected_status" ]]; then
                    log_success "$description is healthy (HTTP $status_code)"
                    return 0
                fi
            fi
        elif command_exists wget; then
            if wget --timeout=$TIMEOUT --tries=1 -qO- "$url" >/dev/null 2>&1; then
                log_success "$description is healthy"
                return 0
            fi
        fi

        if [[ $i -lt $RETRIES ]]; then
            log_warning "$description check failed (attempt $i/$RETRIES), retrying..."
            sleep 2
        fi
    done

    log_error "$description is not responding"
    return 1
}

# Check TCP connection
tcp_check() {
    local host="$1"
    local port="$2"
    local description="$3"

    log_info "Checking $description connectivity..."

    for i in $(seq 1 $RETRIES); do
        if command_exists nc; then
            if nc -z -w$TIMEOUT "$host" "$port" 2>/dev/null; then
                log_success "$description is reachable"
                return 0
            fi
        elif command_exists telnet; then
            if timeout $TIMEOUT telnet "$host" "$port" </dev/null >/dev/null 2>&1; then
                log_success "$description is reachable"
                return 0
            fi
        elif [[ -e /dev/tcp/$host/$port ]]; then
            log_success "$description is reachable"
            return 0
        fi

        if [[ $i -lt $RETRIES ]]; then
            log_warning "$description check failed (attempt $i/$RETRIES), retrying..."
            sleep 2
        fi
    done

    log_error "$description is not reachable"
    return 1
}

# Check Docker service
check_docker_service() {
    local service_name="$1"
    local description="$2"

    log_info "Checking Docker service: $description..."

    if command_exists docker-compose; then
        if docker-compose ps "$service_name" | grep -q "Up"; then
            log_success "$description container is running"
            return 0
        fi
    elif command_exists docker; then
        if docker ps --filter "name=$service_name" --filter "status=running" | grep -q "$service_name"; then
            log_success "$description container is running"
            return 0
        fi
    fi

    log_error "$description container is not running"
    return 1
}

# Check disk space
check_disk_space() {
    log_info "Checking disk space..."

    local threshold=90
    local usage=$(df / | awk 'NR==2 {print int($5)}')

    if [[ $usage -lt $threshold ]]; then
        log_success "Disk usage is healthy ($usage%)"
    else
        log_error "Disk usage is high ($usage%, threshold: $threshold%)"
    fi
}

# Check memory usage
check_memory() {
    log_info "Checking memory usage..."

    if command_exists free; then
        local mem_info=$(free | grep '^Mem:')
        local total=$(echo $mem_info | awk '{print $2}')
        local used=$(echo $mem_info | awk '{print $3}')
        local usage=$((used * 100 / total))

        if [[ $usage -lt 90 ]]; then
            log_success "Memory usage is healthy ($usage%)"
        else
            log_warning "Memory usage is high ($usage%)"
        fi
    else
        log_warning "Cannot check memory usage (free command not available)"
    fi
}

# Check API endpoints
check_api_endpoints() {
    log_info "Checking API endpoints..."

    # Basic health check
    http_check "http://localhost:$API_PORT/health" "API Health Endpoint"

    # Database connectivity
    http_check "http://localhost:$API_PORT/health/db" "Database Connectivity"

    # Redis connectivity
    http_check "http://localhost:$API_PORT/health/redis" "Redis Connectivity"

    # API version endpoint
    http_check "http://localhost:$API_PORT/api/version" "API Version Endpoint"
}

# Check WebSocket connection
check_websocket() {
    log_info "Checking WebSocket connection..."

    # Basic TCP connectivity check for WebSocket port
    tcp_check "localhost" "$WS_PORT" "WebSocket Port"
}

# Check database
check_database() {
    log_info "Checking database..."

    # Check if PostgreSQL container is running
    check_docker_service "postgres" "PostgreSQL Database"

    # Check database connectivity via TCP
    tcp_check "localhost" "5432" "PostgreSQL Port"

    # Check database via API if available
    http_check "http://localhost:$API_PORT/health/db" "Database via API" || true
}

# Check Redis
check_redis() {
    log_info "Checking Redis..."

    # Check if Redis container is running
    check_docker_service "redis" "Redis Cache"

    # Check Redis connectivity via TCP
    tcp_check "localhost" "6379" "Redis Port"

    # Check Redis via API if available
    http_check "http://localhost:$API_PORT/health/redis" "Redis via API" || true
}

# Check web application
check_web_app() {
    log_info "Checking web application..."

    # Check if web container is running
    check_docker_service "web" "Web Application"

    # Check web app accessibility
    http_check "http://localhost:3000" "Web Application"

    # Check web app health endpoint if available
    http_check "http://localhost:3000/health" "Web App Health" || true
}

# Check external dependencies
check_external_deps() {
    log_info "Checking external dependencies..."

    # Check Google APIs connectivity
    http_check "https://www.googleapis.com" "Google APIs" || log_warning "Google APIs check failed"

    # Check DNS resolution
    if command_exists nslookup; then
        if nslookup google.com >/dev/null 2>&1; then
            log_success "DNS resolution is working"
        else
            log_error "DNS resolution failed"
        fi
    fi
}

# Check SSL certificates (for production)
check_ssl_certificates() {
    if [[ "${NODE_ENV:-}" == "production" ]]; then
        log_info "Checking SSL certificates..."

        local domain="theprofitplatform.com.au"
        local expiry_threshold=30 # days

        if command_exists openssl; then
            if cert_info=$(echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null); then
                local expiry_date=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
                local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
                local current_epoch=$(date +%s)
                local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))

                if [[ $days_until_expiry -gt $expiry_threshold ]]; then
                    log_success "SSL certificate is valid ($days_until_expiry days remaining)"
                else
                    log_warning "SSL certificate expires soon ($days_until_expiry days remaining)"
                fi
            else
                log_error "Could not check SSL certificate"
            fi
        fi
    fi
}

# Check log files
check_logs() {
    log_info "Checking log files..."

    local log_dir="./logs"
    local max_log_size=100 # MB

    if [[ -d "$log_dir" ]]; then
        # Check for recent errors in logs
        if find "$log_dir" -name "*.log" -mtime -1 -exec grep -l "ERROR\|FATAL" {} \; | head -1 >/dev/null 2>&1; then
            log_warning "Recent errors found in log files"
        else
            log_success "No recent errors in log files"
        fi

        # Check log file sizes
        while IFS= read -r -d '' log_file; do
            local size_mb=$(du -m "$log_file" | cut -f1)
            if [[ $size_mb -gt $max_log_size ]]; then
                log_warning "Large log file: $(basename "$log_file") (${size_mb}MB)"
            fi
        done < <(find "$log_dir" -name "*.log" -print0)
    fi
}

# Performance checks
check_performance() {
    log_info "Checking performance metrics..."

    # Check API response time
    if command_exists curl; then
        local response_time=$(curl -w "%{time_total}" -s -o /dev/null "http://localhost:$API_PORT/health" 2>/dev/null || echo "0")
        local response_time_ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "0")

        if (( $(echo "$response_time < 1.0" | bc -l 2>/dev/null || echo "0") )); then
            log_success "API response time is good (${response_time_ms}ms)"
        else
            log_warning "API response time is slow (${response_time_ms}ms)"
        fi
    fi
}

# Main health check function
main() {
    log_info "Starting Ultimate SEO Platform health check..."
    log_info "Timestamp: $(date)"

    # System checks
    check_disk_space
    check_memory

    # Service checks
    check_database
    check_redis
    check_api_endpoints
    check_websocket
    check_web_app

    # External checks
    check_external_deps
    check_ssl_certificates

    # Log and performance checks
    check_logs
    check_performance

    # Summary
    echo
    if [[ $HEALTH_STATUS -eq 0 ]]; then
        log_success "All health checks passed!"
        echo "System is healthy and ready to serve traffic."
    else
        log_error "Some health checks failed!"
        echo "Please review the failures above and take corrective action."
    fi

    exit $HEALTH_STATUS
}

# Run health check
main "$@"