# Hive 2.0 VPS Access Guide

## 🌐 Access URLs

Your Hive 2.0 system is now running on your VPS!

### Main Access Points:

| Service | URL | Status |
|---------|-----|--------|
| **Hive Dashboard** | http://hive.theprofitplatform.com.au | 🟢 Ready |
| **API Endpoint** | http://hive.theprofitplatform.com.au/api/status | 🟢 Ready |
| **WebSocket** | ws://hive.theprofitplatform.com.au/ws | 🟢 Ready |
| **Health Check** | http://hive.theprofitplatform.com.au/health | 🟢 Ready |

### Direct Port Access (if needed):

| Service | Port | URL |
|---------|------|-----|
| Orchestrator API | 9190 | http://31.97.222.218:9190 |
| WebSocket | 9192 | ws://31.97.222.218:9192 |
| Redis | 6380 | redis://31.97.222.218:6380 |
| PostgreSQL | 5433 | postgresql://31.97.222.218:5433 |

## 📊 Service Status

Check current status:
```bash
docker compose -f docker-compose-simple.yml ps
```

View logs:
```bash
# All services
docker compose -f docker-compose-simple.yml logs -f

# Specific service
docker compose -f docker-compose-simple.yml logs orchestrator -f
docker compose -f docker-compose-simple.yml logs seo-agent -f
```

## 🔧 Management Commands

### Start/Stop Services
```bash
# Stop all services
docker compose -f docker-compose-simple.yml down

# Start all services
docker compose -f docker-compose-simple.yml up -d

# Restart a specific service
docker compose -f docker-compose-simple.yml restart orchestrator
```

### Scale Agents
```bash
# Scale SEO agents to 5 instances
docker compose -f docker-compose-simple.yml up -d --scale seo-agent=5

# Scale backend agents to 3 instances
docker compose -f docker-compose-simple.yml up -d --scale backend-agent=3
```

## 🧪 Test the System

### Test API
```bash
# Check status
curl http://hive.theprofitplatform.com.au/api/status

# Submit a task
curl -X POST http://hive.theprofitplatform.com.au/api/task \
  -H "Content-Type: application/json" \
  -d '{
    "type": "optimize-content",
    "params": {
      "content": "Test content for SEO optimization",
      "keywords": ["SEO", "optimization", "test"]
    }
  }'
```

### Test from browser
1. Open http://hive.theprofitplatform.com.au
2. Check the dashboard (when available)
3. Monitor agent status

## 🔐 Credentials

Check the `.env` file for passwords:
```bash
cat /home/avi/projects/ultimate/hive/.env
```

Key passwords:
- PostgreSQL: Check `POSTGRES_PASSWORD` in .env
- Redis: No password (local access only)
- Grafana: Check `GRAFANA_PASSWORD` in .env

## 🚀 What's Running

| Agent | Container | Purpose | Status |
|-------|-----------|---------|--------|
| Orchestrator | hive-orchestrator | Coordinates all agents | ✅ Running |
| Backend Agent | hive-backend-agent | API development | ✅ Running |
| Frontend Agent | hive-frontend-agent | UI development | ✅ Running |
| SEO AI Agent | hive-seo-agent | AI-powered SEO | ✅ Running |
| Redis | hive-redis | Cache & messaging | ✅ Running |
| PostgreSQL | hive-postgres | Database | ✅ Running |

## 🔄 SSL Setup (Optional)

To enable HTTPS:
```bash
sudo certbot --nginx -d hive.theprofitplatform.com.au
```

## 📈 Monitoring

### View container stats
```bash
docker stats
```

### Check resource usage
```bash
docker compose -f docker-compose-simple.yml top
```

### Database access
```bash
# Connect to PostgreSQL
docker exec -it hive-postgres psql -U hive -d hive

# Connect to Redis
docker exec -it hive-redis redis-cli
```

## 🆘 Troubleshooting

### If services won't start:
```bash
# Check for port conflicts
netstat -tulpn | grep -E ":(9190|9192|6380|5433)"

# Reset everything
docker compose -f docker-compose-simple.yml down -v
docker compose -f docker-compose-simple.yml up -d
```

### If Ollama isn't working:
```bash
# Check if Ollama is running locally
curl http://localhost:11434/api/tags

# Pull the model if needed
ollama pull llama3.2:1b
```

### Check agent logs:
```bash
docker compose -f docker-compose-simple.yml logs backend-agent
docker compose -f docker-compose-simple.yml logs seo-agent
```

## 🎯 Next Steps

1. **Test the API**: Try the curl commands above
2. **Monitor logs**: Watch for any errors
3. **Scale as needed**: Add more agent instances
4. **Set up SSL**: Run certbot for HTTPS
5. **Add monitoring**: Deploy Grafana/Prometheus later

---

**System is ready at:** http://hive.theprofitplatform.com.au