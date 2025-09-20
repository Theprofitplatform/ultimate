#!/bin/bash

# Hive System Startup Script
# Ultimate SEO Management Platform

set -e

HIVE_DIR="/home/avi/projects/ultimate/hive"
LOG_DIR="$HIVE_DIR/logs"
PID_DIR="$HIVE_DIR/pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

echo -e "${GREEN}Starting Hive System...${NC}"

# Check Redis dependency
if ! pgrep -x "redis-server" > /dev/null; then
    echo -e "${YELLOW}Redis is not running. Starting Redis...${NC}"
    sudo systemctl start redis-server
    sleep 2
fi

# Function to start a component
start_component() {
    local name=$1
    local script=$2
    local log_file="$LOG_DIR/${name}.log"
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ] && kill -0 $(cat "$pid_file") 2>/dev/null; then
        echo -e "${YELLOW}${name} is already running (PID: $(cat $pid_file))${NC}"
    else
        echo -e "Starting ${name}..."
        nohup node "$script" > "$log_file" 2>&1 &
        echo $! > "$pid_file"
        echo -e "${GREEN}${name} started (PID: $!)${NC}"
    fi
}

# Start Orchestrator
start_component "orchestrator" "$HIVE_DIR/orchestrator.js"
sleep 2

# Start Task Distributor
start_component "task-distributor" "$HIVE_DIR/task-distributor.js"
sleep 1

# Start Agents
for agent in "$HIVE_DIR/agents"/*.agent.js; do
    if [ -f "$agent" ]; then
        agent_name=$(basename "$agent" .agent.js)
        start_component "agent-${agent_name}" "$agent"
        sleep 1
    fi
done

echo -e "${GREEN}Hive System started successfully!${NC}"
echo ""
echo "Dashboard available at: http://localhost:9090"
echo "WebSocket endpoint: ws://localhost:9092"
echo ""
echo "To view logs: tail -f $LOG_DIR/*.log"
echo "To stop Hive: $HIVE_DIR/stop-hive.sh"