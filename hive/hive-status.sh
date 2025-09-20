#!/bin/bash

# Hive System Status Monitor

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Hive System Status ===${NC}"
echo ""

# Check orchestrator
if pgrep -f "orchestrator-logged.js" > /dev/null; then
    echo -e "${GREEN}✓${NC} Orchestrator: Running"
else
    echo -e "${RED}✗${NC} Orchestrator: Not running"
fi

# Check agents
AGENTS=("backend" "database" "devops" "testing" "integration" "frontend")
RUNNING=0

for agent in "${AGENTS[@]}"; do
    if pgrep -f "${agent}.agent.js" > /dev/null; then
        echo -e "${GREEN}✓${NC} Agent-${agent}: Running"
        ((RUNNING++))
    else
        echo -e "${YELLOW}○${NC} Agent-${agent}: Not running"
    fi
done

echo ""
echo -e "Active Agents: ${GREEN}${RUNNING}/${#AGENTS[@]}${NC}"

# Check API status
echo ""
echo -e "${YELLOW}API Status:${NC}"
STATUS=$(curl -s http://localhost:9090/api/status 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'  Status: {data[\"status\"]}\\n  Agents: {len(data[\"agents\"])}\\n  Tasks: {data[\"activeTasks\"]}')" 2>/dev/null || echo "  Unable to parse status"
else
    echo -e "  ${RED}API not accessible${NC}"
fi

# Check recent logs
echo ""
echo -e "${YELLOW}Recent Activity:${NC}"
if [ -f "/home/avi/projects/ultimate/hive/logs/orchestrator.log" ]; then
    tail -3 /home/avi/projects/ultimate/hive/logs/orchestrator.log | while read line; do
        echo "  $line"
    done
fi

echo ""
echo -e "${GREEN}Dashboard:${NC} http://localhost:9090"
echo -e "${GREEN}WebSocket:${NC} ws://localhost:9092"