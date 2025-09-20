#!/bin/bash

# Hive System Test Suite

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://localhost:9090/api"
RESULTS_FILE="/tmp/hive-test-results.json"

echo -e "${BLUE}=== Hive System Test Suite ===${NC}"
echo ""

# Initialize results
echo '{"tests": [], "summary": {}}' > $RESULTS_FILE

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local method=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing:${NC} $description"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "  ${GREEN}✓${NC} Success (HTTP $http_code)"
        return 0
    else
        echo -e "  ${RED}✗${NC} Failed (HTTP $http_code)"
        return 1
    fi
}

# Function to create task for agent
create_task() {
    local agent=$1
    local task_type=$2
    local params=$3
    
    response=$(curl -s -X POST "$API_URL/task" \
        -H "Content-Type: application/json" \
        -d "{\"type\": \"$task_type\", \"agent\": \"$agent\", \"params\": $params}")
    
    task_id=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('taskId', ''))" 2>/dev/null)
    
    if [ -n "$task_id" ]; then
        echo "$task_id"
        return 0
    else
        echo ""
        return 1
    fi
}

# Test 1: System Status
echo -e "\n${BLUE}1. System Status Tests${NC}"
test_api "/status" "GET" "" "Check system status"

# Test 2: Agent Availability
echo -e "\n${BLUE}2. Agent Tests${NC}"
test_api "/agents" "GET" "" "List all agents"

# Test 3: Integration Agent Task
echo -e "\n${BLUE}3. Integration Agent Test${NC}"
task_id=$(create_task "integration" "setup-oauth" '{"provider": "GitHub", "scopes": ["repo", "user"]}')
if [ -n "$task_id" ]; then
    echo -e "  ${GREEN}✓${NC} OAuth task created: $task_id"
    sleep 1
else
    echo -e "  ${RED}✗${NC} Failed to create OAuth task"
fi

# Test 4: Backend Agent Task
echo -e "\n${BLUE}4. Backend Agent Test${NC}"
task_id=$(create_task "backend" "create-service" '{"name": "UserService", "methods": ["create", "read", "update", "delete"]}')
if [ -n "$task_id" ]; then
    echo -e "  ${GREEN}✓${NC} Service task created: $task_id"
    sleep 1
else
    echo -e "  ${RED}✗${NC} Failed to create service task"
fi

# Test 5: Database Agent Task
echo -e "\n${BLUE}5. Database Agent Test${NC}"
task_id=$(create_task "database" "create-schema" '{"database": "test_db", "tables": [{"name": "users", "columns": [{"name": "id", "type": "UUID", "constraints": "PRIMARY KEY"}]}]}')
if [ -n "$task_id" ]; then
    echo -e "  ${GREEN}✓${NC} Schema task created: $task_id"
    sleep 1
else
    echo -e "  ${RED}✗${NC} Failed to create schema task"
fi

# Test 6: DevOps Agent Task
echo -e "\n${BLUE}6. DevOps Agent Test${NC}"
task_id=$(create_task "devops" "create-dockerfile" '{"service": "api", "baseImage": "node:18-alpine", "ports": [3000]}')
if [ -n "$task_id" ]; then
    echo -e "  ${GREEN}✓${NC} Dockerfile task created: $task_id"
    sleep 1
else
    echo -e "  ${RED}✗${NC} Failed to create Dockerfile task"
fi

# Test 7: Testing Agent Task
echo -e "\n${BLUE}7. Testing Agent Test${NC}"
task_id=$(create_task "testing" "create-unit-test" '{"component": "AuthService", "type": "services"}')
if [ -n "$task_id" ]; then
    echo -e "  ${GREEN}✓${NC} Unit test task created: $task_id"
    sleep 1
else
    echo -e "  ${RED}✗${NC} Failed to create unit test task"
fi

# Test 8: Check Created Files
echo -e "\n${BLUE}8. File Creation Verification${NC}"

FILES_TO_CHECK=(
    "/home/avi/projects/ultimate/integrations/oauth/github.oauth.js"
    "/home/avi/projects/ultimate/apps/api/src/services/userservice.service.js"
    "/home/avi/projects/ultimate/database/schemas/test_db.sql"
    "/home/avi/projects/ultimate/docker/Dockerfile.api"
    "/home/avi/projects/ultimate/tests/unit/AuthService.test.js"
)

created_count=0
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} Created: $(basename $file)"
        ((created_count++))
    else
        echo -e "  ${YELLOW}○${NC} Not found: $(basename $file)"
    fi
done

# Test 9: Check Logs
echo -e "\n${BLUE}9. Log Verification${NC}"
if [ -f "/home/avi/projects/ultimate/hive/logs/orchestrator.log" ]; then
    recent_logs=$(tail -5 /home/avi/projects/ultimate/hive/logs/orchestrator.log | grep -c "INFO")
    echo -e "  ${GREEN}✓${NC} Orchestrator logs active ($recent_logs recent INFO entries)"
else
    echo -e "  ${RED}✗${NC} Orchestrator log file not found"
fi

# Test 10: WebSocket Connection
echo -e "\n${BLUE}10. WebSocket Test${NC}"
timeout 2 bash -c 'echo "test" | nc -w 1 localhost 9092' &>/dev/null
if [ $? -eq 0 ] || [ $? -eq 124 ]; then
    echo -e "  ${GREEN}✓${NC} WebSocket port 9092 is listening"
else
    echo -e "  ${RED}✗${NC} WebSocket port 9092 not accessible"
fi

# Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "Files created: ${GREEN}$created_count/${#FILES_TO_CHECK[@]}${NC}"

# Check active agents
active_agents=$(curl -s "$API_URL/status" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('agents', [])))" 2>/dev/null)
echo -e "Active agents: ${GREEN}$active_agents${NC}"

# Check task count
task_count=$(curl -s "$API_URL/status" | python3 -c "import sys, json; print(json.load(sys.stdin).get('activeTasks', 0))" 2>/dev/null)
echo -e "Active tasks: ${YELLOW}$task_count${NC}"

echo ""
echo -e "${GREEN}Test suite completed!${NC}"
echo -e "Dashboard: ${BLUE}http://localhost:9090${NC}"