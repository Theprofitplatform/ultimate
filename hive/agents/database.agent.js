#!/usr/bin/env node

const Redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../logger');

class DatabaseAgent {
  constructor() {
    this.agentId = 'agent-database';
    this.logger = new Logger('agent-database');
    this.status = 'idle';
    this.currentTask = null;
    this.redis = null;
    this.capabilities = {
      databases: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis'],
      operations: ['schema-design', 'migration', 'optimization', 'backup'],
      features: ['partitioning', 'indexing', 'replication', 'sharding']
    };
  }

  async initialize() {
    try {
      this.redis = Redis.createClient({
        host: 'localhost',
        port: 6379
      });

      await this.redis.connect();
      this.logger.info('Database Agent initialized');
      
      await this.subscribeToTasks();
      await this.reportStatus('ready');
    } catch (error) {
      this.logger.error('Failed to initialize', error);
      process.exit(1);
    }
  }

  async subscribeToTasks() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe('hive:tasks:database', async (message) => {
      const task = JSON.parse(message);
      await this.handleTask(task);
    });
    
    this.logger.info('Subscribed to database tasks');
  }

  async handleTask(task) {
    this.logger.info(`Received task: ${task.type}`, { taskId: task.id });
    this.currentTask = task;
    this.status = 'working';
    
    try {
      switch (task.type) {
        case 'create-schema':
          await this.createSchema(task.params);
          break;
        case 'run-migration':
          await this.runMigration(task.params);
          break;
        case 'optimize-query':
          await this.optimizeQuery(task.params);
          break;
        case 'create-backup':
          await this.createBackup(task.params);
          break;
        case 'setup-replication':
          await this.setupReplication(task.params);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      await this.reportTaskComplete(task);
    } catch (error) {
      await this.reportTaskError(task, error);
    }
    
    this.currentTask = null;
    this.status = 'idle';
  }

  async createSchema(params) {
    const { database, tables } = params;
    const schemaPath = '/home/avi/projects/ultimate/database/schemas';
    
    await fs.mkdir(schemaPath, { recursive: true });
    
    let schemaSQL = `-- Schema for ${database}\n\n`;
    
    for (const table of tables) {
      schemaSQL += `CREATE TABLE IF NOT EXISTS ${table.name} (\n`;
      schemaSQL += table.columns.map(col => 
        `  ${col.name} ${col.type}${col.constraints ? ' ' + col.constraints : ''}`
      ).join(',\n');
      schemaSQL += '\n);\n\n';
      
      if (table.indexes) {
        table.indexes.forEach(index => {
          schemaSQL += `CREATE INDEX idx_${table.name}_${index.column} ON ${table.name}(${index.column});\n`;
        });
      }
    }
    
    await fs.writeFile(path.join(schemaPath, `${database}.sql`), schemaSQL);
    
    this.logger.info(`Schema created for database: ${database}`);
  }

  async runMigration(params) {
    const { direction, version } = params;
    this.logger.info(`Running migration: ${direction} to version ${version}`);
    
    return new Promise((resolve, reject) => {
      exec(
        `cd /home/avi/projects/ultimate && npx knex migrate:${direction} --to ${version}`,
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error('Migration failed', error);
            reject(error);
          } else {
            this.logger.info('Migration completed', { stdout });
            resolve(stdout);
          }
        }
      );
    });
  }

  async optimizeQuery(params) {
    const { query, database } = params;
    this.logger.info('Analyzing query for optimization');
    
    const optimizationReport = {
      original: query,
      suggestions: [],
      indexes: []
    };
    
    if (query.includes('SELECT *')) {
      optimizationReport.suggestions.push('Specify columns instead of SELECT *');
    }
    
    if (!query.includes('LIMIT') && query.startsWith('SELECT')) {
      optimizationReport.suggestions.push('Consider adding LIMIT clause');
    }
    
    if (query.includes('JOIN')) {
      optimizationReport.indexes.push('Ensure foreign key columns are indexed');
    }
    
    const reportPath = '/home/avi/projects/ultimate/database/optimization';
    await fs.mkdir(reportPath, { recursive: true });
    await fs.writeFile(
      path.join(reportPath, `report_${Date.now()}.json`),
      JSON.stringify(optimizationReport, null, 2)
    );
    
    this.logger.info('Query optimization report generated');
  }

  async createBackup(params) {
    const { database, type } = params;
    const backupPath = '/home/avi/projects/ultimate/backups';
    
    await fs.mkdir(backupPath, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupPath, `${database}_${timestamp}.sql`);
    
    return new Promise((resolve, reject) => {
      const command = `pg_dump -h localhost -U postgres -d ${database} > ${backupFile}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('Backup failed', error);
          reject(error);
        } else {
          this.logger.info(`Backup created: ${backupFile}`);
          resolve(backupFile);
        }
      });
    });
  }

  async setupReplication(params) {
    const { master, slave, type } = params;
    const configPath = '/home/avi/projects/ultimate/database/replication';
    
    await fs.mkdir(configPath, { recursive: true });
    
    const replicationConfig = {
      type,
      master: {
        host: master.host,
        port: master.port,
        database: master.database
      },
      slave: {
        host: slave.host,
        port: slave.port,
        database: slave.database
      },
      settings: {
        wal_level: 'replica',
        max_wal_senders: 3,
        wal_keep_segments: 64,
        hot_standby: 'on'
      }
    };
    
    await fs.writeFile(
      path.join(configPath, 'replication.json'),
      JSON.stringify(replicationConfig, null, 2)
    );
    
    this.logger.info('Replication configuration created');
  }

  async reportStatus(status) {
    await this.redis.publish('hive:status', JSON.stringify({
      agentId: this.agentId,
      status,
      timestamp: new Date().toISOString(),
      capabilities: this.capabilities
    }));
  }

  async reportTaskComplete(task) {
    await this.redis.publish('hive:logs', JSON.stringify({
      agentId: this.agentId,
      taskId: task.id,
      status: 'completed',
      timestamp: new Date().toISOString()
    }));
    
    this.logger.info(`Task completed: ${task.id}`);
  }

  async reportTaskError(task, error) {
    await this.redis.publish('hive:alerts', JSON.stringify({
      agentId: this.agentId,
      taskId: task.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    this.logger.error(`Task failed: ${task.id}`, error);
  }

  async shutdown() {
    this.logger.info('Shutting down database agent...');
    if (this.redis) {
      await this.redis.quit();
    }
    this.logger.close();
    process.exit(0);
  }
}

const agent = new DatabaseAgent();
agent.initialize().catch(console.error);

process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());