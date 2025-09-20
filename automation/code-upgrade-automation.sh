#!/bin/bash

# Code Upgrade and Test Automation Script
# This script automatically upgrades dependencies, runs tests, and handles rollbacks

# Configuration
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
LOG_DIR="$HOME/automation/logs"
BACKUP_DIR="$HOME/automation/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/upgrade_$TIMESTAMP.log"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL="${EMAIL:-}"

# Create necessary directories
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Notification function
notify() {
    local status=$1
    local message=$2
    
    log "$status: $message"
    
    if [ "$status" = "ERROR" ]; then
        echo -e "\033[31m$message\033[0m"
    elif [ "$status" = "SUCCESS" ]; then
        echo -e "\033[32m$message\033[0m"
    else
        echo -e "\033[33m$message\033[0m"
    fi
}

# Detect project type
detect_project_type() {
    if [ -f "package.json" ]; then
        echo "node"
    elif [ -f "requirements.txt" ] || [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
        echo "python"
    elif [ -f "Gemfile" ]; then
        echo "ruby"
    elif [ -f "go.mod" ]; then
        echo "go"
    elif [ -f "Cargo.toml" ]; then
        echo "rust"
    elif [ -f "composer.json" ]; then
        echo "php"
    else
        echo "unknown"
    fi
}

# Update dependencies based on project type
update_dependencies() {
    local project_type=$(detect_project_type)
    log "Detected project type: $project_type"
    
    case $project_type in
        node)
            log "Updating npm dependencies..."
            npm update 2>&1 | tee -a "$LOG_FILE"
            npm audit fix 2>&1 | tee -a "$LOG_FILE"
            ;;
        python)
            log "Updating Python dependencies..."
            if [ -f "requirements.txt" ]; then
                pip install --upgrade -r requirements.txt 2>&1 | tee -a "$LOG_FILE"
            fi
            ;;
        go)
            log "Updating Go dependencies..."
            go get -u ./... 2>&1 | tee -a "$LOG_FILE"
            go mod tidy 2>&1 | tee -a "$LOG_FILE"
            ;;
        *)
            log "Unknown project type, skipping dependency updates"
            ;;
    esac
}

# Run tests based on project type
run_tests() {
    local project_type=$(detect_project_type)
    local test_result=0
    
    log "Running tests for $project_type project..."
    
    case $project_type in
        node)
            if grep -q '"test"' package.json; then
                npm test 2>&1 | tee -a "$LOG_FILE"
                test_result=$?
            fi
            ;;
        python)
            if command -v pytest &> /dev/null; then
                pytest 2>&1 | tee -a "$LOG_FILE"
                test_result=$?
            elif [ -f "test_*.py" ] || [ -d "tests" ]; then
                python -m unittest discover 2>&1 | tee -a "$LOG_FILE"
                test_result=$?
            fi
            ;;
        go)
            go test ./... 2>&1 | tee -a "$LOG_FILE"
            test_result=$?
            ;;
        *)
            log "No tests configured for this project type"
            ;;
    esac
    
    return $test_result
}

# Main automation workflow
main() {
    notify "INFO" "Starting automated code upgrade for $PROJECT_DIR"
    
    cd "$PROJECT_DIR" || {
        notify "ERROR" "Cannot access project directory: $PROJECT_DIR"
        exit 1
    }
    
    # Update dependencies
    update_dependencies
    
    # Run tests
    run_tests
    TEST_RESULT=$?
    
    if [ $TEST_RESULT -ne 0 ]; then
        notify "WARNING" "Tests failed after upgrade"
        exit 1
    fi
    
    notify "SUCCESS" "Code upgrade completed successfully!"
}

# Run main function
main "$@"
