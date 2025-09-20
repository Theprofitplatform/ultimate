#!/usr/bin/env node

/**
 * Claude-Flow Communication Protocol
 * Advanced inter-agent communication system for Hive test spawn
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const Redis = require('redis');

class ClaudeFlow extends EventEmitter {
  constructor(options = {}) {
    super();
    this.nodeId = options.nodeId || `claude-flow-${uuidv4()}`;
    this.namespace = options.namespace || 'claude-flow';
    this.redis = null;
    this.protocols = new Map();
    this.routes = new Map();
    this.messageHistory = [];
    this.nodes = new Map();
    this.capabilities = options.capabilities || [];
    
    // Communication patterns
    this.patterns = {
      REQUEST_RESPONSE: 'request-response',
      PUBLISH_SUBSCRIBE: 'pub-sub',
      BROADCAST: 'broadcast',
      DIRECT_MESSAGE: 'direct',
      CONSENSUS: 'consensus'
    };
    
    // Flow states
    this.states = {
      INITIALIZING: 'initializing',
      READY: 'ready',
      ACTIVE: 'active',
      DEGRADED: 'degraded',
      SHUTDOWN: 'shutdown'
    };
    
    this.state = this.states.INITIALIZING;
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      activeConnections: 0,
      errorCount: 0
    };
  }

  async initialize() {
    console.log(`[ClaudeFlow] Initializing ${this.nodeId}...`);
    
    // Connect to Redis
    await this.connectRedis();
    
    // Setup communication protocols
    this.setupProtocols();
    
    // Register node
    await this.registerNode();
    
    // Subscribe to channels
    await this.subscribeToChannels();
    
    this.state = this.states.READY;
    console.log(`[ClaudeFlow] ${this.nodeId} ready`);
    
    this.emit('ready');
  }

  async connectRedis() {
    this.redis = Redis.createClient({
      host: 'localhost',
      port: 6379
    });
    
    await this.redis.connect();
    console.log(`[ClaudeFlow] Redis connected for ${this.nodeId}`);
  }

  setupProtocols() {
    // Request-Response Protocol
    this.protocols.set(this.patterns.REQUEST_RESPONSE, {
      send: async (target, request) => {
        const messageId = uuidv4();
        const message = {
          id: messageId,
          type: 'request',
          from: this.nodeId,
          to: target,
          payload: request,
          timestamp: Date.now(),
          pattern: this.patterns.REQUEST_RESPONSE
        };
        
        await this.redis.publish(`${this.namespace}:${target}`, JSON.stringify(message));
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
          }, 30000);
          
          this.once(`response:${messageId}`, (response) => {
            clearTimeout(timeout);
            resolve(response);
          });
        });
      },
      
      respond: async (messageId, target, response) => {
        const message = {
          id: uuidv4(),
          responseId: messageId,
          type: 'response',
          from: this.nodeId,
          to: target,
          payload: response,
          timestamp: Date.now(),
          pattern: this.patterns.REQUEST_RESPONSE
        };
        
        await this.redis.publish(`${this.namespace}:${target}`, JSON.stringify(message));
      }
    });

    // Publish-Subscribe Protocol
    this.protocols.set(this.patterns.PUBLISH_SUBSCRIBE, {
      publish: async (topic, data) => {
        const message = {
          id: uuidv4(),
          type: 'publish',
          from: this.nodeId,
          topic: topic,
          payload: data,
          timestamp: Date.now(),
          pattern: this.patterns.PUBLISH_SUBSCRIBE
        };
        
        await this.redis.publish(`${this.namespace}:topic:${topic}`, JSON.stringify(message));
      },
      
      subscribe: async (topic, handler) => {
        const subscriber = this.redis.duplicate();
        await subscriber.connect();
        
        await subscriber.subscribe(`${this.namespace}:topic:${topic}`, (message) => {
          const data = JSON.parse(message);
          if (data.from !== this.nodeId) {
            handler(data.payload, data);
          }
        });
      }
    });

    // Broadcast Protocol
    this.protocols.set(this.patterns.BROADCAST, {
      broadcast: async (data) => {
        const message = {
          id: uuidv4(),
          type: 'broadcast',
          from: this.nodeId,
          payload: data,
          timestamp: Date.now(),
          pattern: this.patterns.BROADCAST
        };
        
        await this.redis.publish(`${this.namespace}:broadcast`, JSON.stringify(message));
      }
    });

    // Direct Message Protocol
    this.protocols.set(this.patterns.DIRECT_MESSAGE, {
      send: async (target, data) => {
        const message = {
          id: uuidv4(),
          type: 'direct',
          from: this.nodeId,
          to: target,
          payload: data,
          timestamp: Date.now(),
          pattern: this.patterns.DIRECT_MESSAGE
        };
        
        await this.redis.publish(`${this.namespace}:${target}`, JSON.stringify(message));
      }
    });

    // Consensus Protocol
    this.protocols.set(this.patterns.CONSENSUS, {
      propose: async (proposal) => {
        const message = {
          id: uuidv4(),
          type: 'consensus-proposal',
          from: this.nodeId,
          payload: proposal,
          timestamp: Date.now(),
          pattern: this.patterns.CONSENSUS
        };
        
        await this.redis.publish(`${this.namespace}:consensus`, JSON.stringify(message));
        
        // Return promise that resolves when consensus is reached
        return new Promise((resolve) => {
          this.once(`consensus:${message.id}`, resolve);
        });
      },
      
      vote: async (proposalId, vote) => {
        const message = {
          id: uuidv4(),
          proposalId: proposalId,
          type: 'consensus-vote',
          from: this.nodeId,
          payload: { vote },
          timestamp: Date.now(),
          pattern: this.patterns.CONSENSUS
        };
        
        await this.redis.publish(`${this.namespace}:consensus`, JSON.stringify(message));
      }
    });
  }

  async registerNode() {
    const nodeInfo = {
      id: this.nodeId,
      capabilities: this.capabilities,
      state: this.state,
      registeredAt: Date.now()
    };
    
    await this.redis.hSet(`${this.namespace}:nodes`, this.nodeId, JSON.stringify(nodeInfo));
    
    // Send heartbeat
    this.heartbeatInterval = setInterval(async () => {
      await this.redis.hSet(`${this.namespace}:nodes`, this.nodeId, JSON.stringify({
        ...nodeInfo,
        lastSeen: Date.now(),
        state: this.state,
        metrics: this.metrics
      }));
    }, 5000);
  }

  async subscribeToChannels() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();
    
    // Subscribe to direct messages
    await subscriber.subscribe(`${this.namespace}:${this.nodeId}`, (message) => {
      this.handleMessage(JSON.parse(message));
    });
    
    // Subscribe to broadcasts
    await subscriber.subscribe(`${this.namespace}:broadcast`, (message) => {
      const data = JSON.parse(message);
      if (data.from !== this.nodeId) {
        this.handleMessage(data);
      }
    });
    
    // Subscribe to consensus channel
    await subscriber.subscribe(`${this.namespace}:consensus`, (message) => {
      const data = JSON.parse(message);
      if (data.from !== this.nodeId) {
        this.handleMessage(data);
      }
    });
  }

  handleMessage(message) {
    this.metrics.messagesReceived++;
    this.messageHistory.push(message);
    
    // Keep only last 1000 messages
    if (this.messageHistory.length > 1000) {
      this.messageHistory = this.messageHistory.slice(-1000);
    }
    
    switch (message.type) {
      case 'request':
        this.emit('request', message);
        break;
        
      case 'response':
        this.emit(`response:${message.responseId}`, message.payload);
        break;
        
      case 'direct':
        this.emit('direct-message', message);
        break;
        
      case 'broadcast':
        this.emit('broadcast', message);
        break;
        
      case 'publish':
        this.emit('publish', message);
        break;
        
      case 'consensus-proposal':
        this.emit('consensus-proposal', message);
        break;
        
      case 'consensus-vote':
        this.emit('consensus-vote', message);
        break;
    }
    
    this.emit('message', message);
  }

  // High-level communication methods
  async request(target, data) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.REQUEST_RESPONSE).send(target, data);
  }

  async respond(messageId, target, data) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.REQUEST_RESPONSE).respond(messageId, target, data);
  }

  async publish(topic, data) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.PUBLISH_SUBSCRIBE).publish(topic, data);
  }

  async subscribe(topic, handler) {
    return await this.protocols.get(this.patterns.PUBLISH_SUBSCRIBE).subscribe(topic, handler);
  }

  async broadcast(data) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.BROADCAST).broadcast(data);
  }

  async send(target, data) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.DIRECT_MESSAGE).send(target, data);
  }

  async propose(proposal) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.CONSENSUS).propose(proposal);
  }

  async vote(proposalId, vote) {
    this.metrics.messagesSent++;
    return await this.protocols.get(this.patterns.CONSENSUS).vote(proposalId, vote);
  }

  // Node discovery and management
  async discoverNodes() {
    const nodes = await this.redis.hGetAll(`${this.namespace}:nodes`);
    const nodeList = [];
    
    for (const [nodeId, nodeData] of Object.entries(nodes)) {
      const info = JSON.parse(nodeData);
      nodeList.push({
        id: nodeId,
        ...info,
        online: (Date.now() - info.lastSeen) < 30000 // 30 seconds
      });
    }
    
    return nodeList;
  }

  async getNodeCapabilities(nodeId) {
    const nodeData = await this.redis.hGet(`${this.namespace}:nodes`, nodeId);
    if (nodeData) {
      const info = JSON.parse(nodeData);
      return info.capabilities || [];
    }
    return [];
  }

  // Flow control
  setState(newState) {
    this.state = newState;
    this.emit('state-change', { from: this.state, to: newState });
  }

  getMetrics() {
    return {
      ...this.metrics,
      messageHistoryLength: this.messageHistory.length,
      state: this.state,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  async shutdown() {
    console.log(`[ClaudeFlow] Shutting down ${this.nodeId}...`);
    
    this.setState(this.states.SHUTDOWN);
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Remove from node registry
    await this.redis.hDel(`${this.namespace}:nodes`, this.nodeId);
    
    // Close Redis connections
    if (this.redis) {
      await this.redis.quit();
    }
    
    this.emit('shutdown');
  }
}

module.exports = ClaudeFlow;