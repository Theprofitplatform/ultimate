# Multi-stage Dockerfile for Ultimate SEO Platform
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Development stage
FROM base AS development

# Install all dependencies (including devDependencies)
RUN npm ci --include=dev
RUN cd apps/api && npm ci --include=dev
RUN cd apps/web && npm ci --include=dev

# Copy source code
COPY . .

# Expose ports for development
EXPOSE 9090 9092 3000

# Default command for development
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies for building
RUN npm ci --include=dev
RUN cd apps/api && npm ci --include=dev
RUN cd apps/web && npm ci --include=dev

# Copy source code
COPY . .

# Build applications
RUN npm run build

# Remove development dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd apps/api && npm ci --only=production && npm cache clean --force
RUN cd apps/web && npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S ultimate -u 1001

# Install production system dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY --from=build --chown=ultimate:nodejs /app/package*.json ./
COPY --from=build --chown=ultimate:nodejs /app/node_modules ./node_modules

# Copy built applications
COPY --from=build --chown=ultimate:nodejs /app/apps ./apps

# Copy necessary config files
COPY --from=build --chown=ultimate:nodejs /app/database ./database
COPY --from=build --chown=ultimate:nodejs /app/scripts ./scripts

# Create logs directory
RUN mkdir -p /app/logs && chown ultimate:nodejs /app/logs

# Health check script
COPY --chown=ultimate:nodejs scripts/health-check.sh /usr/local/bin/health-check
RUN chmod +x /usr/local/bin/health-check

# Switch to non-root user
USER ultimate

# Expose ports
EXPOSE 9090 9092

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD health-check

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["npm", "start"]

# API-specific stage
FROM production AS api-production

WORKDIR /app/apps/api

# Expose only API port
EXPOSE 9090

# API health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

CMD ["npm", "start"]

# Web-specific stage
FROM nginx:alpine AS web-production

# Copy built web application
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/apps/web/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Add nginx user
RUN addgroup -g 1001 -S nginx-ultimate
RUN adduser -S nginx-ultimate -u 1001 -G nginx-ultimate

# Set ownership
RUN chown -R nginx-ultimate:nginx-ultimate /usr/share/nginx/html
RUN chown -R nginx-ultimate:nginx-ultimate /var/cache/nginx
RUN chown -R nginx-ultimate:nginx-ultimate /var/log/nginx

# Switch to non-root user
USER nginx-ultimate

# Expose port
EXPOSE 80

# Health check for web
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

# Worker stage for background tasks
FROM production AS worker

WORKDIR /app/apps/api

# Expose no ports for worker
EXPOSE

# Worker-specific health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=90s --retries=2 \
    CMD node scripts/worker-health-check.js || exit 1

CMD ["npm", "run", "worker"]

# Testing stage
FROM base AS test

# Install all dependencies including test dependencies
RUN npm ci
RUN cd apps/api && npm ci
RUN cd apps/web && npm ci

# Copy source code
COPY . .

# Install additional test tools
RUN npm install -g jest playwright

# Expose ports for testing
EXPOSE 9090 9092 3000

# Default test command
CMD ["npm", "test"]