#!/usr/bin/env node

/**
 * Hive Frontend Agent
 * Specializes in Next.js, React, TypeScript, and MUI development
 */

const { Worker } = require('worker_threads');
const Redis = require('redis');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class FrontendAgent {
  constructor() {
    this.agentId = 'agent-frontend';
    this.status = 'idle';
    this.currentTask = null;
    this.redis = null;
    this.capabilities = {
      frameworks: ['Next.js', 'React', 'TypeScript'],
      ui: ['Material-UI', 'Tailwind CSS'],
      stateManagement: ['Zustand', 'React Query'],
      testing: ['Jest', 'React Testing Library'],
      realtime: ['SSE', 'WebSockets']
    };
  }

  async initialize() {
    // Connect to Redis for task queue
    this.redis = Redis.createClient({
      host: 'localhost',
      port: 6379
    });

    await this.redis.connect();
    console.log(`[${this.agentId}] Frontend Agent initialized`);
    
    // Subscribe to task channel
    await this.subscribeToTasks();
    
    // Report status
    await this.reportStatus('ready');
  }

  async subscribeToTasks() {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe('hive:tasks:frontend', async (message) => {
      const task = JSON.parse(message);
      await this.handleTask(task);
    });
  }

  async handleTask(task) {
    console.log(`[${this.agentId}] Received task: ${task.type}`);
    this.currentTask = task;
    this.status = 'working';
    
    try {
      switch (task.type) {
        case 'create-component':
          await this.createComponent(task.params);
          break;
        case 'setup-dashboard':
          await this.setupDashboard(task.params);
          break;
        case 'implement-sse':
          await this.implementSSE(task.params);
          break;
        case 'create-form':
          await this.createForm(task.params);
          break;
        case 'optimize-performance':
          await this.optimizePerformance(task.params);
          break;
        case 'run-tests':
          await this.runTests(task.params);
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

  async createComponent(params) {
    const { componentName, type, features } = params;
    const componentPath = path.join('/home/avi/projects/ultimate/apps/web/src/components', `${componentName}.tsx`);
    
    let componentCode = this.generateComponentCode(componentName, type, features);
    
    await fs.writeFile(componentPath, componentCode);
    
    // Create test file
    const testPath = path.join('/home/avi/projects/ultimate/apps/web/src/components', `${componentName}.test.tsx`);
    const testCode = this.generateTestCode(componentName);
    await fs.writeFile(testPath, testCode);
    
    console.log(`[${this.agentId}] Created component: ${componentName}`);
  }

  generateComponentCode(name, type, features) {
    const hasAuth = features?.includes('auth');
    const hasRealtime = features?.includes('realtime');
    const hasChart = features?.includes('chart');
    
    return `import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
${hasChart ? "import ApexChart from 'react-apexcharts';" : ''}
${hasRealtime ? "import { useSSE } from '../hooks/useSSE';" : ''}
${hasAuth ? "import { useAuth } from '../hooks/useAuth';" : ''}
import { useQuery } from '@tanstack/react-query';

interface ${name}Props {
  title?: string;
  onUpdate?: (data: any) => void;
}

export const ${name}: React.FC<${name}Props> = ({ title = '${name}', onUpdate }) => {
  const [data, setData] = useState<any>(null);
  ${hasAuth ? 'const { user } = useAuth();' : ''}
  
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['${name.toLowerCase()}-data'],
    queryFn: async () => {
      const response = await fetch('/api/${name.toLowerCase()}');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  ${hasRealtime ? `
  // Real-time updates
  useSSE('/api/sse/${name.toLowerCase()}', (event) => {
    const update = JSON.parse(event.data);
    setData(prev => ({ ...prev, ...update }));
    onUpdate?.(update);
  });
  ` : ''}

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box>
            {/* Component content */}
            <Typography variant="body1">
              ${name} Component
            </Typography>
            
            ${hasChart ? `
            <ApexChart
              options={{
                chart: { type: 'line' },
                xaxis: { categories: data?.categories || [] }
              }}
              series={data?.series || []}
              type="line"
              height={350}
            />
            ` : ''}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ${name};`;
  }

  generateTestCode(name) {
    return `import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ${name} } from './${name}';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('${name}', () => {
  it('renders without crashing', () => {
    render(
      <Wrapper>
        <${name} />
      </Wrapper>
    );
    expect(screen.getByText('${name} Component')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    render(
      <Wrapper>
        <${name} />
      </Wrapper>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles data updates', async () => {
    const onUpdate = jest.fn();
    render(
      <Wrapper>
        <${name} onUpdate={onUpdate} />
      </Wrapper>
    );
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });
});`;
  }

  async setupDashboard(params) {
    const dashboardPath = '/home/avi/projects/ultimate/apps/web/src/pages/dashboard.tsx';
    
    const dashboardCode = `import React from 'react';
import { Container, Grid, Box } from '@mui/material';
import { DashboardLayout } from '../components/DashboardLayout';
import { MetricsCard } from '../components/MetricsCard';
import { KeywordChart } from '../components/KeywordChart';
import { BacklinkTable } from '../components/BacklinkTable';
import { TrafficOverview } from '../components/TrafficOverview';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <Container maxWidth="xl">
        <Grid container spacing={3}>
          {/* Metrics Row */}
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title="Total Keywords"
              metric="keywords"
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title="Average Position"
              metric="position"
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title="Organic Traffic"
              metric="traffic"
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title="Backlinks"
              metric="backlinks"
              color="warning"
            />
          </Grid>

          {/* Charts Row */}
          <Grid item xs={12} md={8}>
            <KeywordChart />
          </Grid>
          <Grid item xs={12} md={4}>
            <TrafficOverview />
          </Grid>

          {/* Table Row */}
          <Grid item xs={12}>
            <BacklinkTable />
          </Grid>
        </Grid>
      </Container>
    </DashboardLayout>
  );
};

export default Dashboard;`;

    await fs.writeFile(dashboardPath, dashboardCode);
    console.log(`[${this.agentId}] Dashboard setup complete`);
  }

  async implementSSE(params) {
    const ssePath = '/home/avi/projects/ultimate/apps/web/src/hooks/useSSE.ts';
    
    const sseCode = `import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface SSEOptions {
  reconnectInterval?: number;
  maxRetries?: number;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

export function useSSE(
  url: string,
  onMessage: (event: MessageEvent) => void,
  options: SSEOptions = {}
) {
  const { token } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  
  const {
    reconnectInterval = 5000,
    maxRetries = 5,
    onError,
    onOpen
  } = options;

  const connect = useCallback(() => {
    if (!token) return;

    const eventSource = new EventSource(\`\${url}?token=\${token}\`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      retriesRef.current = 0;
      onOpen?.();
    };

    eventSource.onmessage = onMessage;

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      onError?.(error);
      
      if (retriesRef.current < maxRetries) {
        retriesRef.current++;
        setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            eventSource.close();
            connect();
          }
        }, reconnectInterval);
      }
    };

    return eventSource;
  }, [url, token, onMessage, reconnectInterval, maxRetries, onError, onOpen]);

  useEffect(() => {
    const eventSource = connect();
    
    return () => {
      eventSource?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);

  return {
    eventSource: eventSourceRef.current,
    reconnect: connect
  };
}`;

    await fs.writeFile(ssePath, sseCode);
    console.log(`[${this.agentId}] SSE implementation complete`);
  }

  async createForm(params) {
    const { formName, fields, validation } = params;
    const formPath = path.join('/home/avi/projects/ultimate/apps/web/src/components/forms', `${formName}.tsx`);
    
    const formCode = `import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Button,
  TextField,
  FormControl,
  FormHelperText,
  CircularProgress
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';

// Validation schema
const schema = z.object({
  ${fields.map(f => `${f.name}: z.string()${f.required ? '.min(1, "Required")' : '.optional()'}`).join(',\n  ')}
});

type FormData = z.infer<typeof schema>;

interface ${formName}Props {
  onSubmit: (data: FormData) => Promise<void>;
  initialData?: Partial<FormData>;
}

export const ${formName}: React.FC<${formName}Props> = ({ onSubmit, initialData }) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData || {}
  });

  const mutation = useMutation({
    mutationFn: onSubmit,
    onSuccess: () => {
      console.log('Form submitted successfully');
    },
    onError: (error) => {
      console.error('Form submission error:', error);
    }
  });

  const onFormSubmit = async (data: FormData) => {
    await mutation.mutateAsync(data);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onFormSubmit)} sx={{ mt: 2 }}>
      ${fields.map(field => `
      <Controller
        name="${field.name}"
        control={control}
        render={({ field: fieldProps }) => (
          <FormControl fullWidth margin="normal" error={!!errors.${field.name}}>
            <TextField
              {...fieldProps}
              label="${field.label}"
              type="${field.type || 'text'}"
              error={!!errors.${field.name}}
              helperText={errors.${field.name}?.message}
              disabled={isSubmitting}
            />
          </FormControl>
        )}
      />
      `).join('')}
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2 }}
        disabled={isSubmitting}
      >
        {isSubmitting ? <CircularProgress size={24} /> : 'Submit'}
      </Button>
    </Box>
  );
};`;

    await fs.mkdir(path.dirname(formPath), { recursive: true });
    await fs.writeFile(formPath, formCode);
    console.log(`[${this.agentId}] Form ${formName} created`);
  }

  async optimizePerformance(params) {
    const nextConfigPath = '/home/avi/projects/ultimate/apps/web/next.config.js';
    
    const optimizedConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
  images: {
    domains: ['theprofitplatform.com.au'],
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config, { isServer }) => {
    // Optimize bundle size
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        vendor: {
          name: 'vendor',
          chunks: 'all',
          test: /node_modules/,
          priority: 20
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
          enforce: true
        }
      }
    };
    
    return config;
  },
  // Enable compression
  compress: true,
  // Optimize fonts
  optimizeFonts: true,
  // Production source maps
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;`;

    await fs.writeFile(nextConfigPath, optimizedConfig);
    
    // Create performance monitoring component
    const perfMonitorPath = '/home/avi/projects/ultimate/apps/web/src/components/PerformanceMonitor.tsx';
    const perfMonitorCode = `import { useEffect } from 'react';

export const PerformanceMonitor = () => {
  useEffect(() => {
    // Web Vitals monitoring
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Send metrics to analytics
          console.log({
            name: entry.name,
            value: entry.startTime,
            metric: entry.entryType
          });
        }
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      
      return () => observer.disconnect();
    }
  }, []);

  return null;
};`;

    await fs.writeFile(perfMonitorPath, perfMonitorCode);
    console.log(`[${this.agentId}] Performance optimization complete`);
  }

  async runTests(params) {
    const { testType = 'all' } = params;
    
    return new Promise((resolve, reject) => {
      const testCommand = testType === 'all' 
        ? 'npm test -- --coverage'
        : `npm test -- --testPathPattern=${testType}`;
      
      exec(testCommand, { cwd: '/home/avi/projects/ultimate/apps/web' }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[${this.agentId}] Test failed:`, stderr);
          reject(error);
        } else {
          console.log(`[${this.agentId}] Test results:`, stdout);
          resolve(stdout);
        }
      });
    });
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
  }

  async reportTaskError(task, error) {
    await this.redis.publish('hive:alerts', JSON.stringify({
      agentId: this.agentId,
      taskId: task.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

// Initialize and run agent
const agent = new FrontendAgent();
agent.initialize().catch(console.error);

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(`[${agent.agentId}] Shutting down...`);
  await agent.redis?.quit();
  process.exit(0);
});