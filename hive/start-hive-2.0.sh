#!/bin/bash

# Hive 2.0 Enterprise - Startup Script
# Complete setup and launch of the enhanced multi-agent system

set -e

echo "================================================"
echo "    Hive 2.0 Enterprise - Initialization"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed. Please install Node.js 18+ first.${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed. Please install npm first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Create necessary directories
create_directories() {
    echo -e "${YELLOW}Creating directory structure...${NC}"
    
    mkdir -p configs
    mkdir -p logs
    mkdir -p backups
    mkdir -p dashboards
    mkdir -p services
    mkdir -p scripts
    mkdir -p tests
    mkdir -p core
    
    echo -e "${GREEN}✓ Directories created${NC}"
}

# Generate configuration files
generate_configs() {
    echo -e "${YELLOW}Generating configuration files...${NC}"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
# Hive 2.0 Environment Variables
NODE_ENV=production
LOG_LEVEL=info

# Database
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=hive

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_PASSWORD=$(openssl rand -hex 16)
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672

# Ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:1b

# Grafana
GRAFANA_PASSWORD=$(openssl rand -hex 16)

# JWT Secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# API Keys (add your own)
GOOGLE_API_KEY=
OPENAI_API_KEY=
EOF
        echo -e "${GREEN}✓ .env file created${NC}"
    fi
    
    # Create Prometheus config
    cat > configs/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'hive-agents'
    static_configs:
      - targets: 
        - 'backend-agent:9464'
        - 'frontend-agent:9465'
        - 'seo-agent:9466'
        - 'database-agent:9467'
        - 'devops-agent:9468'
        - 'testing-agent:9469'
        - 'orchestrator:9470'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
EOF
    
    # Create Grafana datasources
    cat > configs/grafana-datasources.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    
  - name: Elasticsearch
    type: elasticsearch
    access: proxy
    url: http://elasticsearch:9200
    database: hive-logs
    
  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
EOF
    
    # Create Nginx config
    cat > configs/nginx.conf << EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=auth:10m rate=5r/m;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
    
    # Upstream servers
    upstream orchestrator {
        least_conn;
        server orchestrator:9090 max_fails=3 fail_timeout=30s;
    }
    
    upstream websocket {
        ip_hash;
        server orchestrator:9092;
    }
    
    # Main server block
    server {
        listen 80;
        server_name _;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        
        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://orchestrator;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # WebSocket endpoint
        location /ws {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Dashboard
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files \$uri \$uri/ /index.html;
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
    
    # Create RabbitMQ config
    cat > configs/rabbitmq.conf << EOF
# RabbitMQ Configuration
listeners.tcp.default = 5672
management.tcp.port = 15672

# Performance tuning
vm_memory_high_watermark.relative = 0.6
disk_free_limit.absolute = 50GB

# Clustering
cluster_formation.peer_discovery_backend = rabbit_peer_discovery_classic_config
cluster_formation.classic_config.nodes.1 = rabbit@rabbitmq

# Logs
log.file.level = info
log.console = true
log.console.level = info
EOF
    
    echo -e "${GREEN}✓ Configuration files generated${NC}"
}

# Install Node.js dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    
    npm install
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Create database schema
create_database_schema() {
    echo -e "${YELLOW}Creating database schema...${NC}"
    
    cat > scripts/init.sql << 'EOF'
-- Hive 2.0 Database Schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    capabilities JSONB,
    status VARCHAR(50) DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 5,
    params JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to VARCHAR(255),
    result JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    tags JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);
CREATE INDEX idx_metrics_agent ON metrics(agent_id, timestamp DESC);
CREATE INDEX idx_metrics_name ON metrics(metric_name, timestamp DESC);
CREATE INDEX idx_audit_agent ON audit_logs(agent_id, created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EOF
    
    echo -e "${GREEN}✓ Database schema created${NC}"
}

# Pull Ollama model
setup_ollama() {
    echo -e "${YELLOW}Setting up Ollama AI model...${NC}"
    
    # Check if Ollama is running locally
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Pulling llama3.2:1b model..."
        ollama pull llama3.2:1b || true
        echo -e "${GREEN}✓ Ollama model ready${NC}"
    else
        echo -e "${YELLOW}Ollama will be set up in Docker container${NC}"
    fi
}

# Start Docker services
start_services() {
    echo -e "${YELLOW}Starting Docker services...${NC}"
    
    # Build images
    docker-compose build
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be healthy
    echo "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    docker-compose ps
    
    echo -e "${GREEN}✓ Services started${NC}"
}

# Initialize Ollama in container
init_ollama_container() {
    echo -e "${YELLOW}Initializing Ollama in container...${NC}"
    
    # Pull model in container
    docker-compose exec -T ollama ollama pull llama3.2:1b || true
    
    echo -e "${GREEN}✓ Ollama initialized${NC}"
}

# Display access information
display_info() {
    echo ""
    echo "================================================"
    echo -e "${GREEN}    Hive 2.0 Enterprise - Ready!${NC}"
    echo "================================================"
    echo ""
    echo "Access Points:"
    echo "  • Dashboard:        http://localhost"
    echo "  • Orchestrator API: http://localhost:9090"
    echo "  • WebSocket:        ws://localhost:9092"
    echo "  • RabbitMQ Admin:   http://localhost:15672 (user: hive)"
    echo "  • Grafana:          http://localhost:3000 (user: admin)"
    echo "  • Kibana:           http://localhost:5601"
    echo "  • Jaeger Tracing:   http://localhost:16686"
    echo "  • Prometheus:       http://localhost:9090"
    echo ""
    echo "Commands:"
    echo "  • View logs:        docker-compose logs -f"
    echo "  • Stop services:    docker-compose down"
    echo "  • Restart services: docker-compose restart"
    echo "  • Scale agents:     docker-compose up -d --scale seo-agent=5"
    echo ""
    echo "Monitoring:"
    echo "  • System health:    curl http://localhost:9090/health"
    echo "  • Agent status:     curl http://localhost:9090/api/agents"
    echo "  • Task queue:       curl http://localhost:9090/api/tasks"
    echo ""
    echo -e "${YELLOW}Check .env file for generated passwords${NC}"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    create_directories
    generate_configs
    install_dependencies
    create_database_schema
    setup_ollama
    start_services
    init_ollama_container
    display_info
}

# Run main function
main "$@"