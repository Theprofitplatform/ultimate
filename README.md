# Ultimate SEO Management Platform

Enterprise-grade multi-tenant SEO management platform with Google Workspace integration and distributed development system.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Hive system
npm run hive:start

# Check system status
npm run hive:status

# View dashboard
open http://localhost:9090
```

## 🏗️ Architecture

### Hive Distributed System
- **Orchestrator**: Central coordination on port 9090/9092
- **6 Specialized Agents**: Frontend, Backend, Database, DevOps, Testing, Integration
- **Task Distribution**: Intelligent load balancing
- **Real-time Monitoring**: WebSocket-based dashboard

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, MUI, React Query
- **Backend**: Node.js, Express/Fastify, PostgreSQL, Redis
- **Infrastructure**: Docker, Nginx, PM2
- **Integration**: Google OAuth 2.0, N8N workflows

## 📁 Project Structure

```
ultimate/
├── hive/                 # Distributed development system
│   ├── orchestrator.js   # Central coordinator
│   ├── agents/           # Specialized agents
│   └── dashboard/        # Monitoring interface
├── apps/
│   ├── web/             # Next.js frontend
│   └── api/             # Express backend
├── integrations/        # Third-party integrations
└── database/            # Schema and migrations
```

## 🔧 Available Commands

### Hive Management
```bash
npm run hive:start    # Start all agents
npm run hive:stop     # Stop system
npm run hive:status   # Check status
npm run hive:logs     # View logs
```

### Development
```bash
npm run dev          # Start development servers
npm run build        # Build for production
npm run test         # Run tests
```

### Database
```bash
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
```

### Docker
```bash
npm run docker:build # Build containers
npm run docker:up    # Start services
npm run docker:down  # Stop services
```

## 🎯 Features

### SEO Management
- Keyword tracking and ranking
- Backlink analysis
- Traffic metrics from Google Analytics
- Custom reporting templates
- Multi-tenant architecture

### Google Workspace Integration
- Google Drive file management
- Sheets synchronization
- OAuth 2.0 authentication
- Real-time data updates

### Workflow Automation
- N8N integration
- Webhook management
- Scheduled tasks
- API connectors

## 🛠️ Hive Agents

### Frontend Agent
- Next.js components
- Dashboard creation
- SSE implementation
- Performance optimization

### Backend Agent
- API development
- Authentication systems
- Service creation
- Redis setup

### Database Agent
- Schema design
- Migration management
- Query optimization
- Backup automation

### DevOps Agent
- Docker configuration
- Nginx setup
- CI/CD pipelines
- Monitoring setup

### Testing Agent
- Unit test creation
- E2E testing
- Performance testing
- Security scanning

### Integration Agent
- OAuth implementation
- API connectors
- Webhook creation
- Google services

## 📊 Monitoring

### Dashboard
Access the real-time dashboard at http://localhost:9090

### Status Check
```bash
./hive/hive-status.sh
```

### Logs
```bash
tail -f hive/logs/*.log
```

## 🔒 Security

- JWT authentication with refresh tokens
- AES-256-GCM encryption for credentials
- Row-level security in PostgreSQL
- Rate limiting and CSRF protection
- Audit logging for compliance

## 📈 Performance

- Response time: <200ms (p95)
- Dashboard load: <3 seconds
- Real-time updates via SSE
- Horizontal scaling ready

## 🚦 API Endpoints

### Core Routes
- `GET /api/status` - System status
- `POST /api/task` - Create task
- `POST /api/workflow` - Start workflow
- `GET /api/agents` - List agents

### Task Creation
```bash
curl -X POST http://localhost:9090/api/task \
  -H "Content-Type: application/json" \
  -d '{
    "type": "create-api",
    "agent": "backend",
    "params": {...}
  }'
```

## 📝 Documentation

- [Product Design Review](hive/PRODUCT_DESIGN_REVIEW.pdr)
- [Technical Specification](hive/TECHNICAL_SPECIFICATION.md)
- [Hive System Summary](hive/HIVE_SUMMARY.md)
- [Project Overview](hive/PROJECT_OVERVIEW.md)

## 🌐 Domains

- **Production**: seo.theprofitplatform.com.au
- **Testing**: test.theprofitplatform.com.au
- **N8N**: n8n.theprofitplatform.com.au
- **Dashboard**: dashboard.theprofitplatform.com.au

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Setup
```bash
# Clone repository
git clone https://github.com/theprofitplatform/ultimate.git
cd ultimate

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start services
npm run hive:start
npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

MIT License - The Profit Platform

## 🆘 Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: admin@theprofitplatform.com.au

---

**Version**: 1.0.0  
**Server**: 31.97.222.218  
**Built with Hive** 🐝