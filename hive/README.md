# Hive - Distributed Development System

## Overview

Hive is an intelligent multi-agent orchestration system designed for the Ultimate SEO Management Platform. It coordinates development, testing, deployment, and monitoring through specialized agents working in harmony.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Hive Dashboard                        │
│              (Real-time Monitoring & Control)            │
└─────────────────────┬───────────────────────────────────┘
                      │ WebSocket
┌─────────────────────▼───────────────────────────────────┐
│                    Orchestrator                          │
│            (Central Coordination & Management)           │
└──────┬──────────────────────────────────────┬───────────┘
       │                                      │
┌──────▼──────────┐                  ┌───────▼───────────┐
│ Task Distributor│                  │   Message Queue   │
│  (Load Balancing)                  │     (Redis)       │
└──────┬──────────┘                  └───────┬───────────┘
       │                                      │
┌──────▼──────────────────────────────────────▼───────────┐
│                     Agent Network                        │
├──────────────────────────────────────────────────────────┤
│ • Frontend Agent    • Backend Agent    • Database Agent  │
│ • DevOps Agent      • Testing Agent    • Integration Agent│
└──────────────────────────────────────────────────────────┘
```

## Components

### 1. Orchestrator (`orchestrator.js`)
- Central control system
- Workflow management
- Agent coordination
- Real-time status tracking
- WebSocket server for dashboard

### 2. Task Distributor (`task-distributor.js`)
- Intelligent task assignment
- Load balancing across agents
- Priority queue management
- Performance metrics tracking
- Agent capability matching

### 3. Specialized Agents

#### Frontend Agent (`agents/frontend.agent.js`)
- **Specialization**: Next.js, React, TypeScript, MUI
- **Capabilities**:
  - Component creation
  - Dashboard setup
  - SSE implementation
  - Form generation
  - Performance optimization
  - Frontend testing

#### Backend Agent
- **Specialization**: Node.js, Express, PostgreSQL, Redis
- **Capabilities**:
  - API development
  - Database operations
  - Authentication
  - Google API integration

#### Database Agent
- **Specialization**: PostgreSQL, Redis, Data Architecture
- **Capabilities**:
  - Schema design
  - Migration management
  - Performance optimization
  - Backup automation

#### DevOps Agent
- **Specialization**: Docker, Nginx, CI/CD
- **Capabilities**:
  - Container orchestration
  - Deployment automation
  - SSL management
  - Performance monitoring

#### Testing Agent
- **Specialization**: Jest, Playwright, k6
- **Capabilities**:
  - Unit testing
  - Integration testing
  - E2E automation
  - Performance testing

#### Integration Agent
- **Specialization**: Google APIs, OAuth, N8N
- **Capabilities**:
  - Google Workspace integration
  - OAuth implementation
  - Webhook management
  - Third-party APIs

### 4. Dashboard (`dashboard/index.html`)
- Real-time system monitoring
- Agent status tracking
- Task queue visualization
- Workflow pipeline display
- Performance metrics
- System logs

## Installation

### Prerequisites
- Node.js 18+
- Redis server
- npm or yarn

### Setup

1. Install dependencies:
```bash
cd /home/avi/projects/ultimate/hive
npm install redis express ws
```

2. Start Redis:
```bash
sudo systemctl start redis-server
```

3. Start the Hive system:
```bash
./start-hive.sh
```

## Usage

### Starting the System
```bash
./start-hive.sh
```

### Stopping the System
```bash
./stop-hive.sh
```

### Accessing the Dashboard
Open your browser and navigate to:
- Dashboard: http://localhost:8080
- WebSocket: ws://localhost:8081

### Creating Tasks via API

```bash
# Create a new component
curl -X POST http://localhost:8080/api/task \
  -H "Content-Type: application/json" \
  -d '{
    "type": "create-component",
    "agent": "frontend",
    "params": {
      "componentName": "UserProfile",
      "type": "page",
      "features": ["auth", "realtime"]
    }
  }'

# Start a workflow
curl -X POST http://localhost:8080/api/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "type": "development",
    "params": {}
  }'
```

### WebSocket Communication

```javascript
const ws = new WebSocket('ws://localhost:8081');

ws.onopen = () => {
  // Subscribe to updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['status', 'tasks', 'logs']
  }));
  
  // Create a task
  ws.send(JSON.stringify({
    type: 'task',
    payload: {
      type: 'run-tests',
      agent: 'testing',
      params: { testType: 'unit' }
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Workflows

### Development Workflow
Executes the complete development pipeline:

1. **Foundation Phase** (2 weeks)
   - Backend setup
   - Database configuration
   - DevOps infrastructure

2. **Core Features** (4 weeks)
   - Frontend components
   - Backend APIs
   - Integration setup

3. **Advanced Features** (4 weeks)
   - Complex functionality
   - Performance optimization
   - Testing implementation

4. **Polish Phase** (2 weeks)
   - Final testing
   - Deployment preparation
   - Documentation

### Deployment Workflow
Handles production deployment:

1. Pre-deployment checks
2. Database migration
3. Backend deployment
4. Frontend deployment
5. SSL configuration
6. Health checks
7. Monitoring setup

## Monitoring

### Metrics Tracked
- Task completion rate
- Agent utilization
- Error rate
- Average completion time
- Queue length
- System performance

### Alerts
- Agent failures
- Task errors
- System overload
- Performance degradation

### Logs
All logs are stored in `/home/avi/projects/ultimate/hive/logs/`:
- `orchestrator.log` - System orchestration
- `task-distributor.log` - Task distribution
- `agent-*.log` - Individual agent logs

## Configuration

Edit `hive.config.json` to customize:
- Agent specifications
- Resource allocation
- Workflow definitions
- Communication settings
- Monitoring preferences

## Troubleshooting

### Common Issues

1. **Agents not connecting**
   - Check Redis is running: `redis-cli ping`
   - Verify network connectivity
   - Check agent logs

2. **Tasks stuck in queue**
   - Check agent availability
   - Verify agent capabilities match task requirements
   - Review task distributor logs

3. **Dashboard not updating**
   - Check WebSocket connection
   - Verify orchestrator is running
   - Check browser console for errors

### Debug Mode

Enable debug logging:
```bash
DEBUG=* ./start-hive.sh
```

## Security

- All agent communication encrypted
- Authentication required for API access
- Rate limiting on task creation
- Audit logging for all operations
- Secure credential storage

## Performance

- Handles 1000+ concurrent tasks
- Sub-second task assignment
- Automatic load balancing
- Resource optimization
- Scalable architecture

## Contributing

To add a new agent:

1. Create agent file: `agents/[name].agent.js`
2. Add to configuration: `hive.config.json`
3. Implement required methods
4. Test with sample tasks
5. Update documentation

## License

Part of the Ultimate SEO Management Platform
© 2025 The Profit Platform

## Support

- Documentation: `/home/avi/projects/ultimate/docs/`
- Issues: GitHub repository
- Contact: admin@theprofitplatform.com.au

---

**Version**: 1.0.0
**Last Updated**: 2025-09-08