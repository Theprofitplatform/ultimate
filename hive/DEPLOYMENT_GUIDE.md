# Hive System Deployment Guide

## Quick Deployment Steps

### 1. System Requirements
- Node.js 18+
- Redis Server
- PostgreSQL (for production)
- 2GB RAM minimum
- 10GB storage

### 2. Initial Setup
```bash
# Clone repository
cd /home/avi/projects/ultimate

# Install dependencies
npm install

# Start Redis
sudo systemctl start redis-server

# Start Hive
npm run hive:start
```

### 3. Verify Deployment
```bash
# Check status
./hive/hive-status.sh

# Run tests
./hive/test-suite.sh

# View logs
tail -f hive/logs/*.log
```

### 4. Access Points
- Dashboard: http://localhost:9090
- API: http://localhost:9090/api
- WebSocket: ws://localhost:9092

## Production Deployment

### 1. Environment Setup
```bash
# Create .env file
cat > .env << EOF
NODE_ENV=production
REDIS_HOST=localhost
REDIS_PORT=6379
DB_HOST=localhost
DB_NAME=seo_platform
DB_USER=seo_admin
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
ENCRYPTION_KEY=your_32_char_encryption_key
EOF
```

### 2. Database Setup
```sql
-- Create database
CREATE DATABASE seo_platform;
CREATE USER seo_admin WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE seo_platform TO seo_admin;

-- Run migrations
cd apps/api
npm run migrate
```

### 3. Nginx Configuration
```nginx
server {
    listen 80;
    server_name seo.theprofitplatform.com.au;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seo.theprofitplatform.com.au;
    
    ssl_certificate /etc/letsencrypt/live/seo.theprofitplatform.com.au/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seo.theprofitplatform.com.au/privkey.pem;
    
    location / {
        proxy_pass http://localhost:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:9092;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. Process Management (PM2)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'hive-orchestrator',
      script: './hive/orchestrator-logged.js',
      cwd: '/home/avi/projects/ultimate',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'hive-agent-backend',
      script: './hive/agents/backend.agent.js',
      cwd: '/home/avi/projects/ultimate',
      instances: 1,
      autorestart: true
    },
    {
      name: 'hive-agent-database',
      script: './hive/agents/database.agent.js',
      cwd: '/home/avi/projects/ultimate',
      instances: 1,
      autorestart: true
    },
    {
      name: 'hive-agent-integration',
      script: './hive/agents/integration.agent.js',
      cwd: '/home/avi/projects/ultimate',
      instances: 1,
      autorestart: true
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Monitoring Setup
```bash
# Create monitoring script
cat > /root/automation/scripts/hourly/hive-monitor.sh << 'EOF'
#!/bin/bash
source /root/automation/scripts/common/utils.sh

SCRIPT_NAME="hive-monitor"
LOG_CATEGORY="hourly"

check_hive_health() {
    local status=$(curl -s http://localhost:9090/api/status)
    if [ $? -eq 0 ]; then
        log_message "INFO" "Hive system healthy" "$SCRIPT_NAME" "$LOG_CATEGORY"
    else
        log_message "ERROR" "Hive system down" "$SCRIPT_NAME" "$LOG_CATEGORY"
        send_notification "Hive Alert" "Hive system is not responding"
    fi
}

main() {
    log_message "INFO" "Starting Hive health check" "$SCRIPT_NAME" "$LOG_CATEGORY"
    check_hive_health
}

main "$@"
EOF

chmod +x /root/automation/scripts/hourly/hive-monitor.sh
```

### 6. Backup Strategy
```bash
# Daily backup script
cat > /root/automation/scripts/daily/hive-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups/hive"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup Hive configuration
tar -czf "$BACKUP_DIR/hive_config_$TIMESTAMP.tar.gz" \
    /home/avi/projects/ultimate/hive/*.json \
    /home/avi/projects/ultimate/hive/*.js \
    /home/avi/projects/ultimate/hive/agents/

# Backup database
pg_dump -h localhost -U seo_admin seo_platform | \
    gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /root/automation/scripts/daily/hive-backup.sh
```

## Security Hardening

### 1. Firewall Rules
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 9090/tcp  # Hive API (internal only)
sudo ufw allow 9092/tcp  # WebSocket (internal only)
sudo ufw enable
```

### 2. Environment Variables
```bash
# Secure sensitive data
chmod 600 .env
chown avi:avi .env

# Use secrets management
# Consider using HashiCorp Vault or AWS Secrets Manager
```

### 3. SSL Certificate
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d seo.theprofitplatform.com.au \
    --non-interactive --agree-tos \
    --email admin@theprofitplatform.com.au

# Auto-renewal
sudo certbot renew --dry-run
```

## Scaling Considerations

### 1. Horizontal Scaling
- Deploy multiple agent instances
- Use Redis Cluster for distributed queuing
- Implement load balancer for API endpoints

### 2. Database Optimization
- Enable connection pooling
- Implement read replicas
- Use partitioning for time-series data

### 3. Performance Tuning
```bash
# Increase Node.js memory
node --max-old-space-size=4096 orchestrator.js

# Redis optimization
echo "vm.overcommit_memory = 1" >> /etc/sysctl.conf
sysctl vm.overcommit_memory=1
```

## Troubleshooting

### Common Issues

1. **Agents not connecting**
```bash
# Check Redis
redis-cli ping

# Restart Redis
sudo systemctl restart redis-server
```

2. **High memory usage**
```bash
# Check process memory
ps aux | grep node | awk '{print $6/1024 " MB " $11}'

# Restart specific agent
pm2 restart hive-agent-backend
```

3. **Dashboard not loading**
```bash
# Check orchestrator
pm2 logs hive-orchestrator

# Restart orchestrator
pm2 restart hive-orchestrator
```

## Maintenance

### Daily Tasks
- Check system status: `./hive/hive-status.sh`
- Review logs for errors
- Monitor task queue length

### Weekly Tasks
- Run full test suite
- Check disk usage
- Review performance metrics

### Monthly Tasks
- Update dependencies
- Security patches
- Performance optimization
- Backup verification

## Support Resources

- Documentation: `/home/avi/projects/ultimate/hive/`
- Logs: `/home/avi/projects/ultimate/hive/logs/`
- Health Check: `./hive/hive-status.sh`
- Test Suite: `./hive/test-suite.sh`

## Quick Commands Reference

```bash
# Start system
npm run hive:start

# Stop system
npm run hive:stop

# Check status
npm run hive:status

# View logs
npm run hive:logs

# Run tests
./hive/test-suite.sh

# Health check
./hive/hive-status.sh
```

---

**Version**: 1.0.0  
**Last Updated**: 2025-09-08  
**Maintained by**: The Profit Platform