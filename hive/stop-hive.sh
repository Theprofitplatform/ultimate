#!/bin/bash

# Hive System Shutdown Script
# Ultimate SEO Management Platform

HIVE_DIR="/home/avi/projects/ultimate/hive"
PID_DIR="$HIVE_DIR/pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Hive System...${NC}"

# Function to stop a component
stop_component() {
    local name=$1
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "Stopping ${name} (PID: $pid)..."
            kill -SIGTERM "$pid"
            sleep 1
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -SIGKILL "$pid"
            fi
            
            rm -f "$pid_file"
            echo -e "${GREEN}${name} stopped${NC}"
        else
            echo -e "${YELLOW}${name} is not running${NC}"
            rm -f "$pid_file"
        fi
    else
        echo -e "${YELLOW}No PID file found for ${name}${NC}"
    fi
}

# Stop all agents first
for pid_file in "$PID_DIR"/agent-*.pid; do
    if [ -f "$pid_file" ]; then
        component_name=$(basename "$pid_file" .pid)
        stop_component "$component_name"
    fi
done

# Stop Task Distributor
stop_component "task-distributor"

# Stop Orchestrator
stop_component "orchestrator"

echo -e "${GREEN}Hive System stopped successfully!${NC}"