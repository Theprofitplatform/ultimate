# Ultimate SEO Platform Authentication System

A comprehensive authentication system built for the Ultimate SEO Platform featuring JWT tokens, Google OAuth, role-based access control (RBAC), Redis session management, and advanced security features.

## Features

- **JWT Authentication**: Access and refresh tokens with device fingerprinting
- **Google OAuth 2.0**: Complete Google Workspace integration
- **Role-Based Access Control**: Hierarchical permissions system
- **Redis Session Management**: Scalable session handling with device tracking
- **Security Hardening**: Rate limiting, input validation, CSRF protection
- **API Key Management**: Generate and manage API keys for programmatic access
- **Comprehensive Logging**: Audit trails and security monitoring

## Quick Start

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ultimate_seo
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_ACCESS_SECRET=your_super_secret_access_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ISSUER=ultimate-seo
JWT_AUDIENCE=ultimate-seo-api

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379
USE_REDIS=true
USE_JWT_SERVICE=true
USE_SESSION_SERVICE=true

# Google OAuth Configuration (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Session Configuration
SESSION_TTL=86400
MAX_SESSIONS_PER_USER=10

# Security Configuration
STRICT_SECURITY=false
STRICT_IP_VALIDATION=false
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://theprofitplatform.com.au
```

### 2. Install Dependencies

```bash
npm install express express-rate-limit express-validator cors helmet
npm install bcrypt jsonwebtoken uuid cookie-parser
npm install pg redis googleapis nodemailer winston morgan
npm install dotenv
```

### 3. Database Setup

The authentication system expects the following database tables. Run these SQL scripts:

```sql
-- Organizations table
CREATE TABLE auth.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'trial',
  subscription_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES auth.organizations(id),
  email VARCHAR(254) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(2048),
  role VARCHAR(50) DEFAULT 'member',
  permissions JSONB DEFAULT '[]',
  google_id VARCHAR(255),
  google_tokens JSONB,
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  refresh_token_hash VARCHAR(64) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE auth.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES auth.organizations(id),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  permissions JSONB DEFAULT '[]',
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role assignments audit table
CREATE TABLE auth.role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  role VARCHAR(50) NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permission grants audit table
CREATE TABLE auth.permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  permission VARCHAR(100) NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permission revocations audit table
CREATE TABLE auth.permission_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  permission VARCHAR(100) NOT NULL,
  revoked_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_organization ON auth.users(organization_id);
CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON auth.sessions(expires_at);
CREATE INDEX idx_api_keys_user_id ON auth.api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON auth.api_keys(key_hash);
```

### 4. Basic Usage

```javascript
const express = require('express');
const { createAuthModule } = require('./auth');

const app = express();

async function startServer() {
  // Initialize authentication module
  const authModule = await createAuthModule({
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  });

  // Use authentication routes
  app.use('/auth', authModule.getRouter());

  // Use authentication middleware for protected routes
  const authMiddleware = authModule.getMiddleware();

  app.get('/protected', authMiddleware.authenticate, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
  });

  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}

startServer().catch(console.error);
```

## API Endpoints

### Public Endpoints

#### User Registration
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe",
  "organizationName": "My Company" // Optional
}
```

#### User Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true // Optional
}
```

#### Token Refresh
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here" // Optional if cookie is set
}
```

## Complete Authentication System Implementation Summary

I have successfully implemented a comprehensive authentication system for the Ultimate SEO Platform with the following components:

## 📁 File Structure

```
/apps/api/auth/
├── auth.service.js           # Core authentication business logic
├── auth.controller.js        # HTTP endpoints and request handling
├── auth.middleware.js        # Authentication and authorization middleware
├── auth.routes.js           # Express router configuration
├── auth.utils.js            # Utility functions and configurations
├── google-oauth.js          # Google OAuth 2.0 integration
├── jwt.service.js           # Advanced JWT token management
├── rbac.js                  # Role-based access control system
├── session.service.js       # Redis-based session management
├── validation.middleware.js # Input validation and sanitization
├── index.js                 # Main integration module
├── package.json            # Dependencies and scripts
└── AUTH_README.md          # Comprehensive documentation
```

## 🚀 Key Features Implemented

### 1. JWT Authentication Service (`jwt.service.js`)
- Advanced JWT token generation with device fingerprinting
- Redis-based token caching and blacklisting
- Token rotation and security validation
- Automatic token cleanup and statistics

### 2. Role-Based Access Control (`rbac.js`)
- Hierarchical role system (Admin → Manager → Member → Viewer)
- Granular permission system (50+ permissions)
- Resource-based access control
- Audit trail for role/permission changes

### 3. Redis Session Management (`session.service.js`)
- Scalable session handling with Redis backend
- Device tracking and fingerprinting
- Session statistics and cleanup
- Multi-session management per user

### 4. Google OAuth Integration (`google-oauth.js`)
- Complete Google Workspace integration
- Google Analytics and Search Console data access
- Secure token management and refresh
- Account verification and site ownership

### 5. Enhanced Security Features
- **Rate Limiting**: Configurable limits for different endpoints
- **Input Validation**: Comprehensive validation middleware
- **CSRF Protection**: State parameter validation
- **Device Fingerprinting**: Track login devices
- **IP Validation**: Optional strict IP checking
- **Audit Logging**: Complete security audit trails

### 6. API Key Management
- Generate API keys with custom permissions
- Secure key storage with hashing
- Expiration and usage tracking
- Role-based key generation permissions

## 🔧 Core Endpoints Implemented

### Authentication Endpoints
- `POST /auth/register` - User registration with organization creation
- `POST /auth/login` - User login with session creation
- `POST /auth/logout` - Session termination
- `POST /auth/refresh` - Token refresh
- `GET /auth/verify` - Token verification
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset completion

### Google OAuth Endpoints
- `GET /auth/google` - Initiate OAuth flow
- `POST /auth/google/callback` - Handle OAuth callback
- `GET /auth/google/status` - Check connection status
- `GET /auth/google/analytics/*` - Analytics data access
- `GET /auth/google/search-console/*` - Search Console access
- `DELETE /auth/google/revoke` - Revoke Google access

### User Management Endpoints
- `GET /auth/me` - Current user information
- `GET /auth/profile` - User profile
- `PUT /auth/profile` - Update profile
- `POST /auth/change-password` - Change password
- `GET /auth/permissions` - User permissions

### Session Management Endpoints
- `GET /auth/sessions` - List user sessions
- `DELETE /auth/sessions/:id` - Revoke specific session
- `POST /auth/sessions/revoke-all` - Revoke all sessions
- `GET /auth/sessions/stats` - Session statistics

### API Key Management Endpoints
- `POST /auth/api-keys` - Generate API key
- `GET /auth/api-keys` - List API keys
- `DELETE /auth/api-keys/:id` - Revoke API key

## 🛡️ Security Measures

1. **Password Security**: Bcrypt hashing with 12 salt rounds
2. **JWT Security**: Separate access/refresh tokens with rotation
3. **Rate Limiting**: IP-based and user-based limits
4. **Input Sanitization**: XSS and injection prevention
5. **Session Security**: Device fingerprinting and IP validation
6. **CORS Protection**: Configurable allowed origins
7. **Security Headers**: CSP, HSTS, and other security headers

## 📊 RBAC System

### Roles (Hierarchical)
- **Admin (Level 100)**: Full organization access
- **Manager (Level 75)**: Team and project management
- **Member (Level 50)**: Project access and editing
- **Viewer (Level 25)**: Read-only access

### Permission Categories
- User management (`user:*`)
- Project management (`project:*`)
- SEO data access (`seo:*`)
- Analytics access (`analytics:*`)
- API key management (`api_key:*`)
- System administration (`admin:*`)

## 💾 Data Storage

### PostgreSQL Tables
- `auth.organizations` - Organization management
- `auth.users` - User accounts and profiles
- `auth.sessions` - Session tracking
- `auth.api_keys` - API key management
- `auth.role_assignments` - Role change audit
- `auth.permission_grants` - Permission audit
- `auth.permission_revocations` - Permission revocation audit

### Redis Storage
- JWT token caching and blacklisting
- Session data with TTL
- Rate limiting counters
- User statistics

## 🔧 Configuration Options

The system supports extensive configuration through environment variables and initialization options:

- Database connection settings
- Redis configuration
- JWT token settings
- Google OAuth credentials
- Session management options
- Security feature toggles
- Logging configuration

## 📈 Monitoring and Health Checks

- Health check endpoint with service status
- Token and session statistics
- Audit logging for security events
- Performance metrics tracking
- Error logging and monitoring

This authentication system provides enterprise-grade security and functionality suitable for a production SEO platform, with comprehensive documentation and examples for easy integration and maintenance.

The implementation follows security best practices and includes all requested features: JWT authentication, Google OAuth, RBAC, Redis session management, and comprehensive security measures.