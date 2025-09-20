# Ultimate SEO Platform - Authentication System

A complete JWT-based authentication system with Google OAuth integration, role-based access control (RBAC), and multi-tenant architecture support.

## Features

- **JWT Authentication**: Secure access and refresh token implementation
- **Google OAuth Integration**: Single sign-on with Google Workspace
- **Role-Based Access Control (RBAC)**: Fine-grained permissions system
- **Multi-Tenant Architecture**: Organization-based data isolation
- **Password Security**: Bcrypt hashing with strength validation
- **Rate Limiting**: Protection against brute force attacks
- **Session Management**: Secure session handling with database storage
- **Email Verification**: Account verification via email tokens
- **Password Reset**: Secure password recovery flow
- **API Key Authentication**: Service-to-service authentication
- **Security Headers**: Comprehensive security middleware
- **Request Logging**: Detailed audit trail

## Quick Start

### 1. Installation

```bash
cd /home/avi/projects/ultimate/apps/api/auth
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

Ensure your PostgreSQL database is running with the schema from `/database/schema.sql`:

```bash
psql -U postgres -d ultimate_seo -f /home/avi/projects/ultimate/database/schema.sql
```

### 4. Start the Service

```bash
npm run dev
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/auth/register` | User registration | None |
| POST | `/auth/login` | User login | None |
| POST | `/auth/refresh` | Refresh access token | None |
| POST | `/auth/logout` | User logout | Required |
| GET | `/auth/me` | Get auth status | Optional |

### Profile Management

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/auth/profile` | Get user profile | Required |
| PUT | `/auth/profile` | Update user profile | Required |
| POST | `/auth/change-password` | Change password | Required |

### Email & Password Reset

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/auth/verify-email` | Verify email address | None |
| POST | `/auth/resend-verification` | Resend verification email | Required |
| POST | `/auth/forgot-password` | Initiate password reset | None |
| POST | `/auth/reset-password` | Reset password with token | None |

### Google OAuth

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/auth/google` | Initiate Google OAuth | None |
| POST | `/auth/google/callback` | Handle OAuth callback | None |
| GET | `/auth/google/analytics/:viewId` | Get Analytics data | Required |
| GET | `/auth/google/search-console/:siteUrl` | Get Search Console data | Required |
| DELETE | `/auth/google/revoke` | Revoke Google access | Required |

### Session Management

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/auth/sessions` | Get user sessions | Required |
| DELETE | `/auth/sessions/:sessionId` | Revoke specific session | Required |

## Usage Examples

### Registration

```javascript
const response = await fetch('/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!',
    fullName: 'John Doe',
    organizationName: 'Acme Corp' // Optional
  })
});
```

### Login

```javascript
const response = await fetch('/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!',
    rememberMe: true
  })
});

const { data } = await response.json();
// Store the access token
localStorage.setItem('accessToken', data.tokens.accessToken);
```

### Authenticated Requests

```javascript
const response = await fetch('/auth/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Google OAuth Flow

```javascript
// 1. Initiate OAuth
const authResponse = await fetch('/auth/google');
const { authUrl } = await authResponse.json();

// 2. Redirect user to authUrl
window.location.href = authUrl;

// 3. Handle callback (after user returns)
const callbackResponse = await fetch('/auth/google/callback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: urlParams.get('code'),
    state: urlParams.get('state')
  })
});
```

## Architecture

### Core Components

1. **AuthService** (`auth.service.js`): Business logic for authentication operations
2. **AuthController** (`auth.controller.js`): HTTP request handlers
3. **AuthMiddleware** (`auth.middleware.js`): JWT validation and RBAC
4. **AuthUtils** (`auth.utils.js`): Utility functions for tokens, passwords, and security
5. **GoogleOAuthService** (`google-oauth.js`): Google OAuth integration

### Security Features

- **Password Hashing**: Bcrypt with configurable rounds
- **JWT Tokens**: HS256 algorithm with separate access/refresh secrets
- **Rate Limiting**: Configurable limits for different endpoint types
- **CORS Protection**: Configurable allowed origins
- **Security Headers**: XSS, CSRF, and other security headers
- **Input Sanitization**: XSS prevention and data validation
- **Session Security**: HTTP-only cookies for refresh tokens

### Multi-Tenant Support

The system supports multi-tenant architecture through:

- **Organization-based isolation**: All data is scoped to organizations
- **Row-level security**: Database-level access control
- **API-level filtering**: Middleware ensures organization context
- **Role inheritance**: Organization-specific role assignments

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ultimate_seo

# JWT Secrets (generate secure random strings)
JWT_ACCESS_SECRET=your_secure_access_secret
JWT_REFRESH_SECRET=your_secure_refresh_secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Optional Variables

```bash
# JWT Configuration
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ISSUER=ultimate-seo
JWT_AUDIENCE=ultimate-seo-api

# Security
BCRYPT_ROUNDS=12
COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:3000

# Email (for verification/reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Role-Based Access Control

### Available Roles

- **admin**: Full system access
- **manager**: Organization management permissions
- **member**: Standard user permissions
- **viewer**: Read-only access
- **api**: API key access

### Permission System

```javascript
// Example permission checks in routes
router.get('/admin/users', 
  authMiddleware.requireRole(['admin']),
  authMiddleware.requirePermission(['user:read']),
  controller.getUsers
);
```

### Permission Constants

```javascript
const { PERMISSIONS } = require('./auth.middleware');

// Usage
authMiddleware.requirePermission([
  PERMISSIONS.USER_READ,
  PERMISSIONS.PROJECT_WRITE
])
```

## Error Handling

The system provides comprehensive error handling with:

- **Validation Errors**: Input validation with detailed messages
- **Authentication Errors**: Clear auth failure responses
- **Rate Limit Errors**: Rate limiting with retry information
- **Server Errors**: Sanitized error responses (no stack traces in production)

### Error Response Format

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": {} // Optional, development only
}
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Production Deployment

### Security Checklist

1. ✅ Set strong JWT secrets (minimum 32 characters)
2. ✅ Configure HTTPS-only cookies (`COOKIE_SECURE=true`)
3. ✅ Set appropriate CORS origins
4. ✅ Enable rate limiting
5. ✅ Configure secure database connections
6. ✅ Set up email service for verification
7. ✅ Monitor logs for security events

### Environment Variables for Production

```bash
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
DB_SSL=true
LOG_LEVEL=warn
ALLOWED_ORIGINS=https://yourdomain.com
```

## Integration with Ultimate SEO Platform

This authentication system integrates with the broader Ultimate SEO platform:

- **Database Schema**: Uses the auth schema from the platform database
- **Multi-tenancy**: Organization-based data isolation
- **Google Integration**: Analytics and Search Console access
- **API Gateway**: Can be used with the platform's API gateway
- **Logging**: Compatible with platform logging infrastructure

## Support

For issues or questions:

1. Check the logs: `tail -f logs/app.log`
2. Review environment configuration
3. Verify database connectivity and schema
4. Check Google OAuth setup (if using)

## License

This authentication system is part of the Ultimate SEO Platform and is proprietary software.