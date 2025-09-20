#!/bin/bash

echo "╔══════════════════════════════════════════╗"
echo "║  🚀 CODE AUTOMATION SYSTEM QUICK START   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

AUTOMATION_DIR="$HOME/projects/ultimate/automation"

echo "📁 Automation Directory: $AUTOMATION_DIR"
echo ""

echo "Available Commands:"
echo "──────────────────────────────────────────"
echo ""

echo "1️⃣  Manual Code Upgrade & Test:"
echo "   bash $AUTOMATION_DIR/code-upgrade-automation.sh"
echo ""

echo "2️⃣  Setup Cron Jobs:"
echo "   bash $AUTOMATION_DIR/setup-cron.sh"
echo ""

echo "3️⃣  View Logs:"
echo "   tail -f $AUTOMATION_DIR/logs/*.log"
echo ""

echo "4️⃣  Check Cron Jobs:"
echo "   crontab -l"
echo ""

echo "══════════════════════════════════════════"
echo "Quick Examples:"
echo "──────────────────────────────────────────"
echo ""

echo "# Test the ultimate project:"
echo "PROJECT_DIR=~/projects/ultimate bash $AUTOMATION_DIR/code-upgrade-automation.sh"
echo ""

echo "# Monitor automation logs:"
echo "tail -f $AUTOMATION_DIR/logs/*.log"
echo ""
