# Technical Specification: SEO Management Web Application

## Architecture Overview and Technology Decisions

Based on comprehensive research of modern SaaS implementations and SEO platform requirements, this specification outlines the complete architecture for building a multi-tenant SEO management platform with Google Workspace integration.

### Recommended Tech Stack

**Frontend Framework**: Next.js 14 with TypeScript  
**Backend**: Node.js with Express/Fastify  
**Database**: PostgreSQL with row-level security  
**State Management**: Zustand for client state, React Query for server state  
**UI Components**: Material-UI (MUI) with custom theming  
**Charts**: ApexCharts for advanced visualizations, Recharts for simple charts  
**Real-time**: Server-Sent Events (SSE) for live updates  
**Caching**: Redis for session management and data caching  
**Queue**: Bull/BullMQ with Redis for background jobs  
**Authentication**: JWT with refresh tokens stored in HttpOnly cookies  

### Project Structure and Initial Setup

```bash
seo-management-platform/
├── apps/
│   ├── web/                 # Next.js frontend application
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── features/    # Feature-specific modules
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── lib/         # Utility functions
│   │   │   ├── pages/       # Next.js pages
│   │   │   └── styles/      # Global styles
│   │   └── public/          # Static assets
│   ├── api/                 # Express backend API
│   │   ├── src/
│   │   │   ├── controllers/ # Request handlers
│   │   │   ├── middleware/  # Express middleware
│   │   │   ├── models/      # Database models
│   │   │   ├── services/    # Business logic
│   │   │   ├── utils/       # Helper functions
│   │   │   └── workers/     # Background job processors
│   │   └── prisma/          # Database schema and migrations
│   └── shared/              # Shared types and utilities
├── infrastructure/          # Terraform/CloudFormation templates
├── docker/                  # Docker configurations
└── scripts/                 # Build and deployment scripts
```

## Database Design with Multi-Tenancy

### PostgreSQL Schema with Row-Level Security

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    google_credentials JSONB, -- Encrypted Google API credentials
    subscription_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table with tenant association
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-tenant relationships (many-to-many)
CREATE TABLE user_tenants (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tenant_id)
);

-- Keywords tracking table with partitioning
CREATE TABLE seo_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    search_volume INTEGER,
    competition_score DECIMAL(3,2),
    difficulty_score INTEGER,
    cpc DECIMAL(10,2),
    target_url TEXT,
    google_sheet_id TEXT, -- Reference to Google Sheet
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for keywords
CREATE TABLE seo_keywords_2024_01 PARTITION OF seo_keywords
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Keyword rankings time-series data
CREATE TABLE keyword_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    keyword_id UUID REFERENCES seo_keywords(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    url TEXT NOT NULL,
    search_engine VARCHAR(50) DEFAULT 'google',
    location VARCHAR(100) DEFAULT 'United States',
    device VARCHAR(20) DEFAULT 'desktop',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

-- Backlinks table
CREATE TABLE backlinks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    anchor_text TEXT,
    domain_authority INTEGER,
    page_authority INTEGER,
    link_type VARCHAR(20) DEFAULT 'dofollow',
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Traffic metrics from Google Analytics
CREATE TABLE traffic_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    organic_sessions INTEGER DEFAULT 0,
    organic_users INTEGER DEFAULT 0,
    pageviews INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2),
    avg_session_duration INTEGER, -- in seconds
    conversion_rate DECIMAL(5,2),
    recorded_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (recorded_date);

-- SEO reports configuration
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    template_config JSONB NOT NULL, -- Report sections and settings
    schedule_config JSONB, -- Cron expression and recipients
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_keywords_tenant_keyword ON seo_keywords (tenant_id, keyword);
CREATE INDEX idx_rankings_tenant_date ON keyword_rankings (tenant_id, recorded_at DESC);
CREATE INDEX idx_backlinks_tenant_target ON backlinks (tenant_id, target_url);
CREATE INDEX idx_traffic_tenant_date ON traffic_metrics (tenant_id, recorded_date DESC);
CREATE INDEX idx_audit_tenant_user ON audit_logs (tenant_id, user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_metrics ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation function
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID
$$ LANGUAGE SQL SECURITY DEFINER;

-- Create RLS policies
CREATE POLICY tenant_isolation ON seo_keywords
    USING (tenant_id = current_tenant_id());
    
CREATE POLICY tenant_isolation ON keyword_rankings
    USING (tenant_id = current_tenant_id());
    
CREATE POLICY tenant_isolation ON backlinks
    USING (tenant_id = current_tenant_id());
    
CREATE POLICY tenant_isolation ON traffic_metrics
    USING (tenant_id = current_tenant_id());
```

## Google API Integration Implementation

### OAuth 2.0 Authentication Flow

```typescript
// apps/api/src/services/google-auth.service.ts
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import crypto from 'crypto';

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;
  private encryptionKey: string;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    this.encryptionKey = process.env.ENCRYPTION_KEY!;
  }

  // Generate OAuth URL for user consent
  generateAuthUrl(tenantId: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in Redis for verification
    redis.setex(`oauth_state:${state}`, 600, tenantId);
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/analytics.readonly'
      ],
      state,
      prompt: 'consent' // Force refresh token generation
    });
  }

  // Handle OAuth callback
  async handleCallback(code: string, state: string): Promise<void> {
    // Verify state
    const tenantId = await redis.get(`oauth_state:${state}`);
    if (!tenantId) throw new Error('Invalid state parameter');
    
    // Exchange code for tokens
    const { tokens } = await this.oauth2Client.getToken(code);
    
    // Encrypt and store tokens
    const encryptedTokens = this.encryptTokens(tokens);
    
    await db.query(
      'UPDATE tenants SET google_credentials = $1 WHERE id = $2',
      [encryptedTokens, tenantId]
    );
    
    // Clean up state
    await redis.del(`oauth_state:${state}`);
  }

  // Encrypt tokens for storage
  private encryptTokens(tokens: any): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  // Decrypt tokens for use
  private decryptTokens(encryptedData: string): any {
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  // Get authenticated client for tenant
  async getAuthenticatedClient(tenantId: string): Promise<OAuth2Client> {
    const tenant = await db.query(
      'SELECT google_credentials FROM tenants WHERE id = $1',
      [tenantId]
    );
    
    if (!tenant.rows[0]?.google_credentials) {
      throw new Error('No Google credentials found for tenant');
    }
    
    const tokens = this.decryptTokens(tenant.rows[0].google_credentials);
    this.oauth2Client.setCredentials(tokens);
    
    // Auto-refresh tokens if needed
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      await this.updateStoredTokens(tenantId, credentials);
    }
    
    return this.oauth2Client;
  }
}
```

### Google Drive and Sheets API Service

```typescript
// apps/api/src/services/google-workspace.service.ts
import { google, drive_v3, sheets_v4 } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

export class GoogleWorkspaceService {
  private authService: GoogleAuthService;

  constructor() {
    this.authService = new GoogleAuthService();
  }

  // List files in a specific folder
  async listDriveFiles(
    tenantId: string,
    folderId?: string
  ): Promise<drive_v3.Schema$File[]> {
    const auth = await this.authService.getAuthenticatedClient(tenantId);
    const drive = google.drive({ version: 'v3', auth });
    
    const query = folderId 
      ? `'${folderId}' in parents and trashed = false`
      : 'trashed = false';
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 100
    });
    
    return response.data.files || [];
  }

  // Read data from Google Sheets
  async readSheetData(
    tenantId: string,
    spreadsheetId: string,
    range: string
  ): Promise<any[][]> {
    const auth = await this.authService.getAuthenticatedClient(tenantId);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    
    return response.data.values || [];
  }

  // Batch update sheets with rate limiting
  async batchUpdateSheet(
    tenantId: string,
    spreadsheetId: string,
    updates: Array<{ range: string; values: any[][] }>
  ): Promise<void> {
    const auth = await this.authService.getAuthenticatedClient(tenantId);
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Rate limiter implementation
    await this.rateLimiter.checkLimit(tenantId);
    
    const data = updates.map(update => ({
      range: update.range,
      values: update.values
    }));
    
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data
      }
    });
  }

  // Watch for changes in Drive files
  async setupDriveWebhook(
    tenantId: string,
    fileId: string,
    webhookUrl: string
  ): Promise<void> {
    const auth = await this.authService.getAuthenticatedClient(tenantId);
    const drive = google.drive({ version: 'v3', auth });
    
    await drive.files.watch({
      fileId,
      requestBody: {
        id: crypto.randomUUID(),
        type: 'web_hook',
        address: webhookUrl,
        token: this.generateWebhookToken(tenantId, fileId),
        expiration: Date.now() + 86400000 // 24 hours
      }
    });
  }

  // Rate limiter for API calls
  private rateLimiter = {
    limits: new Map<string, number[]>(),
    
    async checkLimit(tenantId: string): Promise<void> {
      const now = Date.now();
      const windowMs = 60000; // 1 minute window
      const maxRequests = 300; // Google Sheets API limit
      
      if (!this.limits.has(tenantId)) {
        this.limits.set(tenantId, []);
      }
      
      const requests = this.limits.get(tenantId)!;
      const recentRequests = requests.filter(time => now - time < windowMs);
      
      if (recentRequests.length >= maxRequests) {
        const oldestRequest = recentRequests[0];
        const waitTime = windowMs - (now - oldestRequest);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.limits.set(tenantId, [...recentRequests, now]);
    }
  };
}
```

## Authentication and Security Implementation

### JWT Authentication with Refresh Tokens

```typescript
// apps/api/src/middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface JWTPayload {
  sub: string; // user id
  tenant_id: string;
  roles: string[];
  permissions: string[];
}

export class AuthMiddleware {
  private accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
  private refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;

  // Generate access token (15 minutes)
  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '15m',
      issuer: 'seo-platform',
      audience: 'seo-api'
    });
  }

  // Generate refresh token (7 days)
  generateRefreshToken(userId: string, tenantId: string): string {
    const tokenId = crypto.randomUUID();
    
    // Store refresh token in database for revocation
    db.query(
      'INSERT INTO refresh_tokens (id, user_id, tenant_id, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenId, userId, tenantId, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );
    
    return jwt.sign(
      { jti: tokenId, sub: userId, tenant_id: tenantId },
      this.refreshTokenSecret,
      { expiresIn: '7d' }
    );
  }

  // Middleware to verify JWT
  async verifyToken(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      // Set tenant context for RLS
      await db.query('SET app.current_tenant = $1', [decoded.tenant_id]);
      await db.query('SET app.current_user = $1', [decoded.sub]);
      
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Check specific permissions
  requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user?.permissions.includes(permission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  // Refresh token endpoint
  async refreshToken(req: Request, res: Response) {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }
    
    try {
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as any;
      
      // Verify token exists in database
      const tokenExists = await db.query(
        'SELECT * FROM refresh_tokens WHERE id = $1 AND expires_at > NOW()',
        [decoded.jti]
      );
      
      if (!tokenExists.rows[0]) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      
      // Get user details
      const user = await db.query(
        `SELECT u.*, ut.role, ut.permissions 
         FROM users u 
         JOIN user_tenants ut ON u.id = ut.user_id 
         WHERE u.id = $1 AND ut.tenant_id = $2`,
        [decoded.sub, decoded.tenant_id]
      );
      
      if (!user.rows[0]) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Generate new access token
      const accessToken = this.generateAccessToken({
        sub: user.rows[0].id,
        tenant_id: decoded.tenant_id,
        roles: [user.rows[0].role],
        permissions: user.rows[0].permissions || []
      });
      
      res.json({ accessToken, expiresIn: 900 });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
}
```

### Security Headers and Rate Limiting

```typescript
// apps/api/src/middleware/security.middleware.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate limiting configurations
export const rateLimiters = {
  // General API rate limit
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Strict rate limit for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts',
  }),

  // Google API proxy rate limit
  googleApi: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Google's typical rate limit
    keyGenerator: (req: Request) => {
      return req.user?.tenant_id || req.ip;
    },
  }),
};

// CORS configuration
export const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
```

## Frontend Implementation with Next.js

### Dashboard Component with Real-time Updates

```tsx
// apps/web/src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import ApexChart from 'react-apexcharts';
import { useSSE } from '../hooks/useSSE';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>();
  
  // Initial data fetch
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Real-time updates via SSE
  useSSE('/api/sse/dashboard', (event) => {
    const update = JSON.parse(event.data);
    setMetrics(prev => ({ ...prev, ...update }));
  });

  const chartOptions = {
    chart: {
      type: 'line',
      animations: {
        enabled: true,
        easing: 'linear',
        dynamicAnimation: {
          speed: 1000
        }
      },
      toolbar: {
        show: false
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    xaxis: {
      type: 'datetime',
      labels: {
        format: 'HH:mm'
      }
    }
  };

  return (
    <Grid container spacing={3}>
      {/* Key Metrics Cards */}
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Total Keywords</Typography>
          <Typography variant="h3">{metrics?.totalKeywords || 0}</Typography>
          <Typography variant="body2" color="success.main">
            +{metrics?.keywordGrowth || 0}% this month
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Average Position</Typography>
          <Typography variant="h3">{metrics?.avgPosition || 0}</Typography>
          <Typography variant="body2" color="success.main">
            ↑ {metrics?.positionImprovement || 0} positions
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Organic Traffic</Typography>
          <Typography variant="h3">{metrics?.organicTraffic || 0}</Typography>
          <Typography variant="body2" color="success.main">
            +{metrics?.trafficGrowth || 0}% vs last month
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Backlinks</Typography>
          <Typography variant="h3">{metrics?.totalBacklinks || 0}</Typography>
          <Typography variant="body2">
            {metrics?.newBacklinks || 0} new this week
          </Typography>
        </Paper>
      </Grid>

      {/* Ranking Trends Chart */}
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Ranking Trends
          </Typography>
          <ApexChart
            options={chartOptions}
            series={metrics?.rankingTrends || []}
            type="line"
            height={350}
          />
        </Paper>
      </Grid>

      {/* Top Performing Keywords */}
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Top Keywords
          </Typography>
          <KeywordsList keywords={metrics?.topKeywords || []} />
        </Paper>
      </Grid>
    </Grid>
  );
};
```

### Custom SSE Hook for Real-time Updates

```typescript
// apps/web/src/hooks/useSSE.ts
import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export function useSSE(url: string, onMessage: (event: MessageEvent) => void) {
  const { token } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;

    // Create EventSource with authentication
    const eventSource = new EventSource(`${url}?token=${token}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = onMessage;

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // Implement exponential backoff reconnection
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close();
          eventSourceRef.current = new EventSource(`${url}?token=${token}`);
        }
      }, 5000);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url, token, onMessage]);

  return eventSourceRef.current;
}
```

## Deployment Configuration

### Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: seo_platform
      POSTGRES_USER: seo_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U seo_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://seo_admin:${DB_PASSWORD}@postgres:5432/seo_platform
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    volumes:
      - ./apps/api:/app
      - /app/node_modules
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    volumes:
      - ./apps/web:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    depends_on:
      - api
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

### Production Nginx Configuration

```nginx
# /etc/nginx/sites-available/seo.theprofitplatform.com.au
upstream api_backend {
    least_conn;
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream web_frontend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

server {
    listen 80;
    server_name seo.theprofitplatform.com.au;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seo.theprofitplatform.com.au;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/seo.theprofitplatform.com.au/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seo.theprofitplatform.com.au/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/javascript application/vnd.ms-fontobject application/x-font-ttf font/opentype;

    # API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        
        # Timeout settings for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Auth endpoints with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE endpoint for real-time updates
    location /api/sse/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header X-Accel-Buffering 'no';
        proxy_read_timeout 86400;
        proxy_buffering off;
        chunked_transfer_encoding off;
    }

    # Static files and Next.js app
    location / {
        proxy_pass http://web_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static file caching
    location /_next/static/ {
        proxy_pass http://web_frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
    }

    # Logs
    access_log /var/log/nginx/seo.access.log combined;
    error_log /var/log/nginx/seo.error.log warn;
}
```

## Monitoring and Maintenance

### Health Check Script

```bash
#!/bin/bash
# /root/automation/scripts/hourly/seo-platform-health.sh

source /root/automation/scripts/common/utils.sh

SCRIPT_NAME="seo-platform-health"
LOG_CATEGORY="hourly"

# Acquire lock
if ! acquire_lock "$SCRIPT_NAME"; then
    exit 1
fi
trap 'release_lock "$SCRIPT_NAME"' EXIT

check_service_health() {
    local service=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    if curl -f -s "http://localhost:${port}${endpoint}" > /dev/null; then
        log_message "INFO" "${service} is healthy" "$SCRIPT_NAME" "$LOG_CATEGORY"
        return 0
    else
        log_message "ERROR" "${service} health check failed" "$SCRIPT_NAME" "$LOG_CATEGORY"
        send_notification "SEO Platform Alert" "${service} is down on port ${port}"
        return 1
    fi
}

main() {
    log_message "INFO" "Starting SEO platform health check" "$SCRIPT_NAME" "$LOG_CATEGORY"
    
    # Check services
    check_service_health "API" 3001
    check_service_health "Frontend" 3000
    check_service_health "PostgreSQL" 5432 "/"
    check_service_health "Redis" 6379 "/"
    
    # Check disk space
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 80 ]; then
        log_message "WARNING" "Disk usage is ${DISK_USAGE}%" "$SCRIPT_NAME" "$LOG_CATEGORY"
        send_notification "Disk Space Warning" "Disk usage is at ${DISK_USAGE}%"
    fi
    
    # Check memory
    MEMORY_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ $MEMORY_USAGE -gt 90 ]; then
        log_message "WARNING" "Memory usage is ${MEMORY_USAGE}%" "$SCRIPT_NAME" "$LOG_CATEGORY"
        send_notification "Memory Warning" "Memory usage is at ${MEMORY_USAGE}%"
    fi
    
    log_message "INFO" "Health check completed" "$SCRIPT_NAME" "$LOG_CATEGORY"
}

main "$@"
```

### Database Backup Script

```bash
#!/bin/bash
# /root/automation/scripts/daily/seo-platform-backup.sh

source /root/automation/scripts/common/utils.sh

SCRIPT_NAME="seo-platform-backup"
LOG_CATEGORY="daily"
BACKUP_DIR="/root/backups/seo-platform"
DB_NAME="seo_platform"
RETENTION_DAYS=30

if ! acquire_lock "$SCRIPT_NAME"; then
    exit 1
fi
trap 'release_lock "$SCRIPT_NAME"' EXIT

main() {
    log_message "INFO" "Starting SEO platform backup" "$SCRIPT_NAME" "$LOG_CATEGORY"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Generate backup filename
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/seo_platform_${TIMESTAMP}.sql.gz"
    
    # Perform database backup
    if PGPASSWORD="${DB_PASSWORD}" pg_dump -h localhost -U seo_admin -d "$DB_NAME" | gzip > "$BACKUP_FILE"; then
        log_message "INFO" "Database backup created: $BACKUP_FILE" "$SCRIPT_NAME" "$LOG_CATEGORY"
        
        # Upload to cloud storage (optional)
        # aws s3 cp "$BACKUP_FILE" "s3://backup-bucket/seo-platform/"
        
        # Clean old backups
        find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
        log_message "INFO" "Cleaned backups older than $RETENTION_DAYS days" "$SCRIPT_NAME" "$LOG_CATEGORY"
    else
        log_message "ERROR" "Database backup failed" "$SCRIPT_NAME" "$LOG_CATEGORY"
        send_notification "Backup Failed" "SEO platform database backup failed"
        exit 1
    fi
    
    log_message "INFO" "Backup completed successfully" "$SCRIPT_NAME" "$LOG_CATEGORY"
}

main "$@"
```

---

## Conclusion

This technical specification provides a comprehensive blueprint for building a production-ready SEO management platform with Google Workspace integration. The architecture emphasizes:

- **Scalability**: Multi-tenant design with PostgreSQL RLS
- **Security**: Multiple layers of authentication and encryption
- **Performance**: Caching, rate limiting, and optimization
- **Reliability**: Health checks, monitoring, and automated backups
- **Maintainability**: Clear structure and comprehensive documentation

The implementation leverages modern technologies and best practices to ensure a robust, secure, and scalable solution suitable for enterprise deployment.