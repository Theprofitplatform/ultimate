module.exports = {
  apps: [
    {
      name: 'hive-orchestrator',
      script: './orchestrator-logged.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/orchestrator-error.log',
      out_file: './logs/orchestrator-out.log',
      log_file: './logs/orchestrator-combined.log',
      time: true
    },
    {
      name: 'hive-agent-backend',
      script: './agents/backend.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-database',
      script: './agents/database.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-frontend',
      script: './agents/frontend.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-devops',
      script: './agents/devops.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-testing',
      script: './agents/testing.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'hive-agent-integration',
      script: './agents/integration.agent.js',
      cwd: '/home/avi/projects/ultimate/hive',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
