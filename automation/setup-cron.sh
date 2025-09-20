#!/bin/bash

# Setup Cron Jobs for Code Automation

AUTOMATION_DIR="$HOME/projects/ultimate/automation"
SCRIPT_PATH="$AUTOMATION_DIR/code-upgrade-automation.sh"

echo "Setting up automated code upgrade cron jobs..."

# Function to add cron job
add_cron_job() {
    local schedule=$1
    local command=$2
    local description=$3
    
    (crontab -l 2>/dev/null | grep -F "$command") && {
        echo "⚠️  Cron job already exists: $description"
        return
    }
    
    (crontab -l 2>/dev/null; echo "# $description"; echo "$schedule $command") | crontab -
    echo "✅ Added: $description"
}

# Make script executable
chmod +x "$SCRIPT_PATH"

# Daily upgrade at 3 AM
add_cron_job \
    "0 3 * * *" \
    "PROJECT_DIR=$HOME/projects/ultimate $SCRIPT_PATH --auto >> $AUTOMATION_DIR/logs/cron.log 2>&1" \
    "Daily code upgrade and test (3 AM)"

# Every 6 hours quick test
add_cron_job \
    "0 */6 * * *" \
    "PROJECT_DIR=$HOME/projects/ultimate $SCRIPT_PATH --test-only >> $AUTOMATION_DIR/logs/cron.log 2>&1" \
    "Test run every 6 hours"

echo -e "\n📋 Current cron jobs:"
crontab -l | grep -E "automation|code-upgrade"

echo -e "\n✅ Automation setup complete!"
