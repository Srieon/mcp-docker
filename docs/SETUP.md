# Setup Guide

This guide walks you through setting up the Docker Hub MCP Server, including authentication, configuration, and integration with MCP clients.

## Table of Contents

- [Installation](#installation)
- [Authentication Setup](#authentication-setup)
- [Configuration](#configuration)
- [MCP Client Integration](#mcp-client-integration)
- [Private Registry Support](#private-registry-support)
- [Testing Your Setup](#testing-your-setup)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

Ensure you have the following installed:
- **Node.js** 18.0 or higher
- **npm** or **yarn**
- **Git** (for cloning the repository)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd dockerhub-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Verify Installation

```bash
# Run basic server check
npm start -- --help

# Check if all dependencies are installed
npm list
```

---

## Authentication Setup

The Docker Hub MCP Server supports multiple authentication methods. Choose the one that best fits your needs:

### Option 1: Anonymous Access (Public Images Only)

For basic usage with public Docker Hub images, no authentication is required:

```bash
# Create basic .env file
cp env.example .env
```

**Limitations:**
- Only public repositories accessible
- Lower rate limits (100 requests/hour)
- No access to vulnerability scans
- Cannot access private repositories

### Option 2: Username/Password Authentication

Standard Docker Hub login credentials:

```bash
# Edit .env file
DOCKERHUB_USERNAME=your_dockerhub_username
DOCKERHUB_PASSWORD=your_dockerhub_password

# Optional: Increase rate limits
DOCKERHUB_RATE_LIMIT=200
DOCKERHUB_RATE_LIMIT_WINDOW=3600
```

**Benefits:**
- Access to private repositories you own
- Higher rate limits (200 requests/hour)
- Access to additional metadata
- Better error messages

**Security Considerations:**
- Store credentials securely
- Use environment variables in production
- Consider using access tokens instead

### Option 3: Access Token Authentication (Recommended)

Most secure option using Docker Hub Personal Access Tokens:

#### Creating an Access Token

1. **Login to Docker Hub**
   - Go to https://hub.docker.com
   - Sign in to your account

2. **Navigate to Account Settings**
   - Click on your username (top right)
   - Select "Account Settings"

3. **Create Access Token**
   - Go to "Security" tab
   - Click "New Access Token"
   - Choose appropriate permissions:
     - **Public Repo Read**: For public repositories
     - **Private Repo Read**: For your private repositories
     - **Repo Write**: If you need write access (not typically needed)

4. **Save the Token**
   - Copy the generated token immediately
   - Store it securely (you won't see it again)

#### Configure Access Token

```bash
# Edit .env file
DOCKERHUB_ACCESS_TOKEN=dckr_pat_1234567890abcdef...

# Remove username/password if present
# DOCKERHUB_USERNAME=
# DOCKERHUB_PASSWORD=
```

**Benefits:**
- Most secure authentication method
- Fine-grained permissions
- Can be revoked without changing password
- Better for CI/CD and automation

### Option 4: Two-Factor Authentication (2FA)

If your account has 2FA enabled, you **must** use an access token. Username/password authentication will fail.

```bash
# 2FA accounts MUST use access tokens
DOCKERHUB_ACCESS_TOKEN=dckr_pat_your_token_here
```

### Validation

Test your authentication setup:

```bash
# Test basic connection
npm run dev

# In another terminal, test a search
curl -X POST http://localhost:3000 -d '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "docker_search_images",
    "arguments": {"query": "nginx", "limit": 1}
  },
  "id": 1
}'
```

---

## Configuration

### Environment Variables

Complete list of configuration options:

```bash
# Docker Hub Authentication
DOCKERHUB_USERNAME=your_username           # Optional
DOCKERHUB_PASSWORD=your_password           # Optional  
DOCKERHUB_ACCESS_TOKEN=your_token          # Recommended

# Private Registry (Optional)
PRIVATE_REGISTRY_URL=https://registry.company.com
PRIVATE_REGISTRY_USERNAME=registry_user
PRIVATE_REGISTRY_PASSWORD=registry_pass

# Server Configuration
MCP_SERVER_NAME=dockerhub-mcp-server       # Server identifier
MCP_SERVER_VERSION=1.0.0                  # Server version

# Performance Tuning
CACHE_TTL_SECONDS=300                      # Cache lifetime (5 minutes)
MAX_CACHE_SIZE=1000                        # Maximum cache entries
DOCKERHUB_RATE_LIMIT=100                   # Requests per window
DOCKERHUB_RATE_LIMIT_WINDOW=3600          # Rate limit window (1 hour)

# Logging
LOG_LEVEL=info                             # debug, info, warn, error
```

### Cache Configuration

Optimize caching for your use case:

```bash
# High-frequency usage (more caching)
CACHE_TTL_SECONDS=600      # 10 minutes
MAX_CACHE_SIZE=2000        # More entries

# Low-memory environment (less caching)  
CACHE_TTL_SECONDS=60       # 1 minute
MAX_CACHE_SIZE=100         # Fewer entries

# Development (no caching)
CACHE_TTL_SECONDS=0        # Disable cache
```

### Rate Limiting Configuration

Configure rate limiting based on your Docker Hub plan:

```bash
# Free tier
DOCKERHUB_RATE_LIMIT=100
DOCKERHUB_RATE_LIMIT_WINDOW=3600

# Pro tier
DOCKERHUB_RATE_LIMIT=5000
DOCKERHUB_RATE_LIMIT_WINDOW=3600

# Team tier  
DOCKERHUB_RATE_LIMIT=10000
DOCKERHUB_RATE_LIMIT_WINDOW=3600
```

---

## MCP Client Integration

### Claude Desktop

Add the MCP server to your Claude Desktop configuration:

#### macOS/Linux
```bash
# Edit Claude Desktop config
~/.config/claude-desktop/claude_desktop_config.json
```

#### Windows
```bash
# Edit Claude Desktop config  
%APPDATA%/Claude/claude_desktop_config.json
```

#### Configuration
```json
{
  "mcpServers": {
    "dockerhub": {
      "command": "node",
      "args": ["/absolute/path/to/dockerhub-mcp-server/dist/index.js"],
      "env": {
        "DOCKERHUB_ACCESS_TOKEN": "dckr_pat_your_token_here"
      }
    }
  }
}
```

### Cursor IDE

Configure the MCP server in Cursor:

1. **Open Cursor Settings**
   - Go to Settings → Extensions → MCP

2. **Add Server Configuration**
```json
{
  "name": "dockerhub",
  "command": "node",
  "args": ["/absolute/path/to/dockerhub-mcp-server/dist/index.js"],
  "env": {
    "DOCKERHUB_ACCESS_TOKEN": "dckr_pat_your_token_here",
    "LOG_LEVEL": "info"
  }
}
```

### Cline (VS Code Extension)

Add to your Cline MCP configuration:

1. **Open VS Code Settings**
   - Go to File → Preferences → Settings
   - Search for "Cline MCP"

2. **Configure MCP Servers**
```json
{
  "cline.mcpServers": {
    "dockerhub": {
      "command": "node",
      "args": ["/absolute/path/to/dockerhub-mcp-server/dist/index.js"],
      "env": {
        "DOCKERHUB_ACCESS_TOKEN": "dckr_pat_your_token_here"
      }
    }
  }
}
```

### Custom MCP Client

For custom implementations, connect via stdio:

```javascript
import { spawn } from 'child_process';

const mcpProcess = spawn('node', ['/path/to/dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DOCKERHUB_ACCESS_TOKEN: 'your_token_here'
  }
});

// Send MCP requests via stdin
// Receive responses via stdout
```

---

## Private Registry Support

Configure access to private Docker registries:

### Docker Hub Private Repositories

Use your regular Docker Hub credentials:

```bash
DOCKERHUB_USERNAME=your_username
DOCKERHUB_PASSWORD=your_password
# OR
DOCKERHUB_ACCESS_TOKEN=dckr_pat_your_token
```

### Third-Party Registries

Configure additional registry access:

```bash
# Registry configuration
PRIVATE_REGISTRY_URL=https://registry.company.com
PRIVATE_REGISTRY_USERNAME=company_username  
PRIVATE_REGISTRY_PASSWORD=company_password

# Multiple registries (JSON format)
PRIVATE_REGISTRIES='[
  {
    "url": "https://registry1.company.com",
    "username": "user1",
    "password": "pass1"
  },
  {
    "url": "https://registry2.company.com", 
    "username": "user2",
    "password": "pass2"
  }
]'
```

### Azure Container Registry (ACR)

```bash
PRIVATE_REGISTRY_URL=https://myregistry.azurecr.io
PRIVATE_REGISTRY_USERNAME=myregistry
PRIVATE_REGISTRY_PASSWORD=access_token_from_azure
```

### Google Container Registry (GCR)

```bash
PRIVATE_REGISTRY_URL=https://gcr.io
PRIVATE_REGISTRY_USERNAME=_json_key
PRIVATE_REGISTRY_PASSWORD='{"type": "service_account", ...}'
```

### Amazon ECR

```bash
PRIVATE_REGISTRY_URL=https://123456789.dkr.ecr.region.amazonaws.com
PRIVATE_REGISTRY_USERNAME=AWS
PRIVATE_REGISTRY_PASSWORD=eyJwYXlsb2FkIjoiQ...  # From aws ecr get-login-password
```

---

## Testing Your Setup

### Basic Functionality Test

```bash
# Start the server
npm run dev

# Test in another terminal
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call", 
    "params": {
      "name": "docker_search_images",
      "arguments": {"query": "hello-world", "limit": 1}
    },
    "id": 1
  }'
```

### Authentication Test

```bash
# Test private repository access (if configured)
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "docker_get_image_details", 
      "arguments": {"repository": "your_username/private_repo"}
    },
    "id": 1
  }'
```

### Performance Test

```bash
# Test multiple requests (rate limiting)
for i in {1..5}; do
  curl -X POST http://localhost:3000 \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"docker_search_images\",
        \"arguments\": {\"query\": \"test$i\", \"limit\": 1}
      },
      \"id\": $i
    }" &
done
wait
```

### Integration Test with MCP Client

Create a test script for your MCP client:

```javascript
// test-mcp-integration.js
import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';

async function testIntegration() {
  const client = new MCPClient();
  
  // Connect to our server
  await client.connect({
    command: 'node',
    args: ['./dist/index.js']
  });
  
  // Test tool listing
  const tools = await client.listTools();
  console.log('Available tools:', tools.tools.map(t => t.name));
  
  // Test tool execution
  const result = await client.callTool('docker_search_images', {
    query: 'nginx',
    limit: 1
  });
  
  console.log('Search result:', result);
}

testIntegration().catch(console.error);
```

---

## Troubleshooting

### Common Issues

**Authentication Failures**
```bash
# Check credentials format
echo "Username: $DOCKERHUB_USERNAME"
echo "Has Password: $([ -n "$DOCKERHUB_PASSWORD" ] && echo "Yes" || echo "No")"
echo "Has Token: $([ -n "$DOCKERHUB_ACCESS_TOKEN" ] && echo "Yes" || echo "No")"

# Test Docker Hub login separately
docker login --username="$DOCKERHUB_USERNAME" --password="$DOCKERHUB_PASSWORD"
```

**Rate Limiting Issues**
```bash
# Check current rate limit status
curl -I https://auth.docker.io/token?service=registry.docker.io

# Monitor rate limit headers in logs
LOG_LEVEL=debug npm run dev
```

**Network Connectivity**
```bash
# Test Docker Hub connectivity
curl -I https://hub.docker.com
curl -I https://registry-1.docker.io

# Test with proxy (if behind firewall)
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

**MCP Client Connection Issues**
```bash
# Test stdio communication
echo '{"jsonrpc":"2.0","method":"ping","id":1}' | node dist/index.js

# Check file permissions
ls -la dist/index.js
chmod +x dist/index.js
```

### Debug Mode

Enable detailed debugging:

```bash
# Maximum verbosity
LOG_LEVEL=debug npm run dev

# Network request debugging
DEBUG=axios npm run dev

# MCP protocol debugging
DEBUG=mcp:* npm run dev
```

### Health Check Endpoint

The server includes health check capabilities:

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed status including auth and rate limits
curl http://localhost:3000/status
```

### Configuration Validation

Validate your configuration:

```bash
# Check configuration loading
npm run dev -- --validate-config

# Test all authentication methods
npm run dev -- --test-auth
```

---

## Production Deployment

### Environment Setup

```bash
# Production environment variables
NODE_ENV=production
LOG_LEVEL=warn
CACHE_TTL_SECONDS=600
MAX_CACHE_SIZE=5000

# Security
DOCKERHUB_ACCESS_TOKEN=dckr_pat_secure_token
# Don't use username/password in production
```

### Process Management

```bash
# Using PM2
npm install -g pm2
pm2 start dist/index.js --name dockerhub-mcp

# Using systemd service
sudo cp scripts/dockerhub-mcp.service /etc/systemd/system/
sudo systemctl enable dockerhub-mcp
sudo systemctl start dockerhub-mcp
```

### Monitoring

```bash
# Log monitoring
tail -f logs/dockerhub-mcp.log

# Performance monitoring
pm2 monit

# Health monitoring
curl -f http://localhost:3000/health || exit 1
```

---

## Security Best Practices

1. **Use Access Tokens**: Never use username/password in production
2. **Secure Storage**: Store credentials in secure environment variables
3. **Network Security**: Use HTTPS and secure networks
4. **Rate Limiting**: Configure appropriate rate limits
5. **Log Security**: Don't log sensitive information
6. **Update Regularly**: Keep dependencies updated

For additional help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue on GitHub.
