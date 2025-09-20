#!/bin/bash

# Setup Hive 2.0 on VPS with proper domain configuration

set -e

echo "================================"
echo "  Hive 2.0 VPS Setup"
echo "================================"

# Check if running as root for nginx setup
if [ "$EUID" -ne 0 ]; then 
   echo "Please run with sudo for nginx configuration"
   echo "Usage: sudo ./setup-vps.sh"
   exit 1
fi

# Configuration
DOMAIN="hive.theprofitplatform.com.au"
EMAIL="admin@theprofitplatform.com.au"

# 1. Setup Nginx configuration
echo "Setting up Nginx configuration..."
cp nginx-vps.conf /etc/nginx/sites-available/$DOMAIN

# Enable the site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# 2. Get SSL certificate
echo "Setting up SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL || {
    echo "SSL setup failed, continuing without SSL for now"
    # Create a non-SSL version
    cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name hive.theprofitplatform.com.au;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /api/ {
        proxy_pass http://localhost:9090/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /ws {
        proxy_pass http://localhost:9092;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /grafana/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /kibana/ {
        proxy_pass http://localhost:5601/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /jaeger/ {
        proxy_pass http://localhost:16686/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /rabbitmq/ {
        proxy_pass http://localhost:15672/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
}

# 3. Reload nginx
systemctl reload nginx

# 4. Configure firewall
echo "Configuring firewall..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 9090/tcp  # API
ufw allow 9092/tcp  # WebSocket
ufw allow 3000/tcp  # Grafana
ufw allow 5601/tcp  # Kibana
ufw allow 16686/tcp # Jaeger
ufw allow 15672/tcp # RabbitMQ

# 5. Start Docker services
echo "Starting Docker services..."
cd /home/avi/projects/ultimate/hive

# Use docker compose (v2) instead of docker-compose
docker compose down || true
docker compose up -d

# 6. Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# 7. Initialize Ollama
echo "Initializing Ollama..."
docker compose exec -T ollama ollama pull llama3.2:1b || echo "Ollama will initialize later"

# 8. Check service health
echo "Checking service health..."
docker compose ps

# 9. Display access information
echo ""
echo "================================"
echo "  Hive 2.0 VPS Setup Complete!"
echo "================================"
echo ""
echo "Access URLs:"
echo "  Dashboard:     http://$DOMAIN"
echo "  API:           http://$DOMAIN/api/"
echo "  WebSocket:     ws://$DOMAIN/ws"
echo "  Grafana:       http://$DOMAIN/grafana"
echo "  Kibana:        http://$DOMAIN/kibana"
echo "  Jaeger:        http://$DOMAIN/jaeger"
echo "  RabbitMQ:      http://$DOMAIN/rabbitmq"
echo ""
echo "Direct Ports (if needed):"
echo "  API:           http://$DOMAIN:9090"
echo "  WebSocket:     ws://$DOMAIN:9092"
echo "  Grafana:       http://$DOMAIN:3000"
echo "  Kibana:        http://$DOMAIN:5601"
echo "  Jaeger:        http://$DOMAIN:16686"
echo "  RabbitMQ:      http://$DOMAIN:15672"
echo ""
echo "Credentials are in the .env file"
echo ""
echo "Commands:"
echo "  View logs:     docker compose logs -f"
echo "  Stop:          docker compose down"
echo "  Restart:       docker compose restart"
echo "  Scale agents:  docker compose up -d --scale seo-agent=5"
echo ""