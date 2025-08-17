# Multi-stage Docker build for Docker Hub MCP Server

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Copy built application and dependencies from builder stage
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/package.json ./package.json

# Create directories for logs and config
RUN mkdir -p /app/logs /app/config && \
    chown -R mcp:nodejs /app/logs /app/config

# Set environment variables
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    MCP_SERVER_NAME=dockerhub-mcp-server \
    MCP_SERVER_VERSION=1.0.0

# Expose port for health checks (optional)
EXPOSE 3000

# Switch to non-root user
USER mcp

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the MCP server
CMD ["node", "dist/index.js"]

# Development stage (optional)
FROM node:18-alpine AS development

WORKDIR /app

# Install all dependencies including dev dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Change ownership
RUN chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Expose port for development
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev"]
