#!/bin/bash

# Hive Test Spawn Launcher
# Launches the test spawn instance with all agents

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$SCRIPT_DIR/pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p "$LOG_DIR" "$PID_DIR"

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if Redis is running
check_redis() {
    if ! redis-cli ping > /dev/null 2>&1; then
        error "Redis is not running. Please start Redis first:"
        echo "  sudo systemctl start redis-server"
        echo "  # or"
        echo "  redis-server"
        exit 1
    fi
    success "Redis is running"
}

# Function to check if Node.js dependencies are installed
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        log "Installing Node.js dependencies..."
        npm install
    fi
    success "Dependencies are ready"
}

# Function to start a single agent
start_agent() {
    local agent_name=$1
    local script_path=$2
    local pid_file="$PID_DIR/$agent_name.pid"
    local log_file="$LOG_DIR/$agent_name.log"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            warn "$agent_name is already running (PID: $pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    log "Starting $agent_name..."
    
    # Start the agent in the background
    nohup node "$script_path" > "$log_file" 2>&1 &
    local pid=$!
    
    # Save PID
    echo "$pid" > "$pid_file"
    
    # Give it a moment to start
    sleep 2
    
    # Check if it's still running
    if kill -0 "$pid" 2>/dev/null; then
        success "$agent_name started successfully (PID: $pid)"
    else
        error "$agent_name failed to start"
        cat "$log_file"
        return 1
    fi
}

# Function to stop all agents
stop_agents() {
    log "Stopping all test spawn agents..."
    
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            local agent_name=$(basename "$pid_file" .pid)
            local pid=$(cat "$pid_file")
            
            if kill -0 "$pid" 2>/dev/null; then
                log "Stopping $agent_name (PID: $pid)..."
                kill "$pid"
                
                # Wait for graceful shutdown
                for i in {1..10}; do
                    if ! kill -0 "$pid" 2>/dev/null; then
                        break
                    fi
                    sleep 1
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    warn "Force killing $agent_name..."
                    kill -9 "$pid" 2>/dev/null || true
                fi
                
                success "$agent_name stopped"
            fi
            
            rm -f "$pid_file"
        fi
    done
}

# Function to show status of all agents
show_status() {
    log "Test Spawn Status:"
    echo
    
    local agents=("test-coordinator" "test-analyst" "test-executor" "test-validator")
    local running_count=0
    
    for agent in "${agents[@]}"; do
        local pid_file="$PID_DIR/$agent.pid"
        
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "  ${GREEN}●${NC} $agent (PID: $pid)"
                ((running_count++))
            else
                echo -e "  ${RED}●${NC} $agent (dead)"
                rm -f "$pid_file"
            fi
        else
            echo -e "  ${RED}●${NC} $agent (stopped)"
        fi
    done
    
    echo
    echo "Running: $running_count/4 agents"
    
    if [ $running_count -eq 4 ]; then
        success "Test spawn is fully operational"
        echo
        echo "Access points:"
        echo "  HTTP API: http://localhost:9093/api/spawn/status"
        echo "  WebSocket: ws://localhost:9094"
        echo "  Logs: $LOG_DIR/"
    elif [ $running_count -gt 0 ]; then
        warn "Test spawn is partially running"
    else
        warn "Test spawn is not running"
    fi
}

# Function to run test workflows
run_tests() {
    log "Running test workflows..."
    
    # Check if coordinator is running
    local coordinator_pid_file="$PID_DIR/test-coordinator.pid"
    if [ ! -f "$coordinator_pid_file" ] || ! kill -0 "$(cat "$coordinator_pid_file")" 2>/dev/null; then
        error "Test coordinator is not running. Start the spawn first."
        exit 1
    fi
    
    # Wait for all agents to be ready
    log "Waiting for agents to initialize..."
    sleep 5
    
    # Run coordination test
    log "Starting coordination test workflow..."
    curl -s -X POST http://localhost:9093/api/workflow/start \
        -H "Content-Type: application/json" \
        -d '{"workflowType": "coordination-test"}' | jq '.'
    
    echo
    
    # Run consensus test
    log "Starting consensus test workflow..."
    curl -s -X POST http://localhost:9093/api/workflow/start \
        -H "Content-Type: application/json" \
        -d '{"workflowType": "consensus-test"}' | jq '.'
    
    echo
    success "Test workflows initiated. Check logs for results."
}

# Function to show logs
show_logs() {
    local agent=${1:-all}
    
    if [ "$agent" = "all" ]; then
        log "Showing logs for all agents (press Ctrl+C to stop)..."
        tail -f "$LOG_DIR"/*.log
    else
        local log_file="$LOG_DIR/$agent.log"
        if [ -f "$log_file" ]; then
            log "Showing logs for $agent (press Ctrl+C to stop)..."
            tail -f "$log_file"
        else
            error "Log file not found: $log_file"
            exit 1
        fi
    fi
}

# Function to cleanup
cleanup() {
    log "Cleaning up test spawn..."
    stop_agents
    
    # Remove PID files
    rm -f "$PID_DIR"/*.pid
    
    # Optionally remove logs
    if [ "${1:-}" = "--clean-logs" ]; then
        rm -f "$LOG_DIR"/*.log
        log "Logs cleaned"
    fi
    
    success "Cleanup completed"
}

# Main script logic
case "${1:-start}" in
    start)
        log "Starting Hive Test Spawn..."
        echo
        
        # Prerequisites check
        check_redis
        check_dependencies
        
        echo
        
        # Start agents in order
        start_agent "test-coordinator" "$SCRIPT_DIR/test-coordinator.js"
        sleep 2
        
        start_agent "test-analyst" "$SCRIPT_DIR/agents/test-analyst.js"
        start_agent "test-executor" "$SCRIPT_DIR/agents/test-executor.js"
        start_agent "test-validator" "$SCRIPT_DIR/agents/test-validator.js"
        
        echo
        show_status
        
        if [ "${2:-}" = "--activate" ]; then
            log "Activating spawn..."
            sleep 3
            curl -s -X POST http://localhost:9093/api/spawn/activate | jq '.'
        fi
        ;;
    
    stop)
        stop_agents
        success "Test spawn stopped"
        ;;
    
    restart)
        stop_agents
        sleep 2
        "$0" start
        ;;
    
    status)
        show_status
        ;;
    
    test)
        run_tests
        ;;
    
    logs)
        show_logs "${2:-all}"
        ;;
    
    cleanup)
        cleanup "${2:-}"
        ;;
    
    activate)
        log "Activating spawn..."
        curl -s -X POST http://localhost:9093/api/spawn/activate | jq '.'
        ;;
    
    deactivate)
        log "Deactivating spawn..."
        curl -s -X POST http://localhost:9093/api/spawn/deactivate | jq '.'
        ;;
    
    report)
        log "Generating spawn report..."
        curl -s http://localhost:9093/api/spawn/status | jq '.'
        echo
        curl -s http://localhost:9093/api/test/results | jq '.'
        ;;
    
    *)
        echo "Hive Test Spawn Manager"
        echo
        echo "Usage: $0 <command> [options]"
        echo
        echo "Commands:"
        echo "  start [--activate]  Start all agents (optionally activate spawn)"
        echo "  stop               Stop all agents"
        echo "  restart            Restart all agents"
        echo "  status             Show agent status"
        echo "  test               Run test workflows"
        echo "  logs [agent]       Show logs (all agents or specific agent)"
        echo "  cleanup [--clean-logs]  Stop agents and cleanup (optionally remove logs)"
        echo "  activate           Activate spawn"
        echo "  deactivate         Deactivate spawn"
        echo "  report             Generate status report"
        echo
        echo "Examples:"
        echo "  $0 start --activate    # Start and activate spawn"
        echo "  $0 logs test-coordinator  # Show coordinator logs"
        echo "  $0 test               # Run test workflows"
        echo "  $0 cleanup --clean-logs  # Full cleanup"
        ;;
esac