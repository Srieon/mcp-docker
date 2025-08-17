# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Docker Hub MCP Server.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Authentication Issues](#authentication-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Rate Limiting Problems](#rate-limiting-problems)
- [MCP Client Integration](#mcp-client-integration)
- [Performance Issues](#performance-issues)
- [Error Reference](#error-reference)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check Script

Run this script to quickly identify common issues:

```bash
#!/bin/bash
# diagnose.sh - Quick health check

echo "🔍 Docker Hub MCP Server Diagnostics"
echo "====================================="

# Check Node.js version
echo "Node.js version:"
node --version

# Check if server builds
echo -e "\n📦 Building server..."
if npm run build; then
  echo "✅ Build successful"
else
  echo "❌ Build failed - check TypeScript errors"
  exit 1
fi

# Check environment configuration
echo -e "\n🔧 Environment configuration:"
echo "DOCKERHUB_USERNAME: ${DOCKERHUB_USERNAME:-(not set)}"
echo "DOCKERHUB_ACCESS_TOKEN: ${DOCKERHUB_ACCESS_TOKEN:+(set)}${DOCKERHUB_ACCESS_TOKEN:-(not set)}"
echo "LOG_LEVEL: ${LOG_LEVEL:-info}"

# Test basic connectivity
echo -e "\n🌐 Testing Docker Hub connectivity..."
if curl -s --connect-timeout 10 https://hub.docker.com > /dev/null; then
  echo "✅ Docker Hub reachable"
else
  echo "❌ Cannot reach Docker Hub - check network/proxy"
fi

# Test registry connectivity  
echo -e "\n🏗️  Testing Docker Registry connectivity..."
if curl -s --connect-timeout 10 https://registry-1.docker.io > /dev/null; then
  echo "✅ Docker Registry reachable"
else
  echo "❌ Cannot reach Docker Registry - check network/proxy"
fi

# Test server startup
echo -e "\n🚀 Testing server startup..."
timeout 10s npm start -- --validate 2>&1 | grep -q "ready" && echo "✅ Server starts successfully" || echo "❌ Server startup failed"

echo -e "\n📋 Diagnosis complete"
```

### Configuration Validator

```bash
# validate-config.sh
#!/bin/bash

echo "🔧 Configuration Validation"
echo "=========================="

# Check required files
if [ ! -f ".env" ]; then
  echo "❌ .env file not found - copy from env.example"
  exit 1
fi

# Check for conflicting auth methods
if [ -n "$DOCKERHUB_ACCESS_TOKEN" ] && [ -n "$DOCKERHUB_PASSWORD" ]; then
  echo "⚠️  Both access token and password set - token will be used"
fi

# Validate numeric values
if ! [[ "$CACHE_TTL_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "❌ CACHE_TTL_SECONDS must be a number"
fi

if ! [[ "$DOCKERHUB_RATE_LIMIT" =~ ^[0-9]+$ ]]; then
  echo "❌ DOCKERHUB_RATE_LIMIT must be a number"
fi

echo "✅ Configuration validation complete"
```

---

## Authentication Issues

### Problem: "Authentication failed"

**Symptoms:**
- Error: `Authentication failed. Please check your Docker Hub credentials.`
- 401 Unauthorized responses
- Cannot access private repositories

**Solutions:**

1. **Check Credentials Format**
   ```bash
   # Verify environment variables are set correctly
   echo "Username: '$DOCKERHUB_USERNAME'"
   echo "Password length: ${#DOCKERHUB_PASSWORD}"
   echo "Token prefix: ${DOCKERHUB_ACCESS_TOKEN:0:10}..."
   ```

2. **Test Docker Hub Login**
   ```bash
   # Test credentials directly with Docker
   docker login --username="$DOCKERHUB_USERNAME" --password="$DOCKERHUB_PASSWORD"
   
   # Or with access token
   echo "$DOCKERHUB_ACCESS_TOKEN" | docker login --username=your_username --password-stdin
   ```

3. **Check for 2FA**
   - If 2FA is enabled, you **must** use an access token
   - Username/password authentication will fail with 2FA
   ```bash
   # Use access token instead
   unset DOCKERHUB_USERNAME
   unset DOCKERHUB_PASSWORD
   export DOCKERHUB_ACCESS_TOKEN="dckr_pat_your_token_here"
   ```

### Problem: "Access token expired"

**Symptoms:**
- Intermittent authentication failures
- Works initially, then fails after time

**Solutions:**

1. **Generate New Token**
   - Go to Docker Hub → Account Settings → Security
   - Delete old token and create new one
   - Update environment variable

2. **Check Token Permissions**
   - Ensure token has required scopes
   - Public Repository Read: minimum requirement
   - Private Repository Read: for private repos

### Problem: "Rate limited despite authentication"

**Symptoms:**
- 429 Too Many Requests errors
- Rate limits lower than expected

**Solutions:**

1. **Verify Authentication is Working**
   ```bash
   # Check server logs for auth confirmation
   LOG_LEVEL=debug npm run dev 2>&1 | grep -i auth
   ```

2. **Check Docker Hub Plan**
   - Free tier: 200 requests/6 hours when authenticated
   - Pro/Team: Higher limits
   - Enterprise: Custom limits

---

## Network and Connectivity  

### Problem: "Network error: Unable to reach Docker Hub API"

**Symptoms:**
- Connection timeouts
- DNS resolution failures
- SSL/TLS errors

**Solutions:**

1. **Check Basic Connectivity**
   ```bash
   # Test DNS resolution
   nslookup hub.docker.com
   nslookup registry-1.docker.io
   
   # Test HTTPS connectivity
   curl -v https://hub.docker.com
   curl -v https://registry-1.docker.io/v2/
   ```

2. **Corporate Firewall/Proxy**
   ```bash
   # Configure proxy if needed
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   export NO_PROXY=localhost,127.0.0.1
   
   # Test with proxy
   npm run dev
   ```

3. **SSL Certificate Issues**
   ```bash
   # Test SSL certificate
   openssl s_client -connect hub.docker.com:443 -servername hub.docker.com
   
   # If corporate certificates, add to Node.js
   export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
   ```

### Problem: "Connection refused" or "ECONNREFUSED"

**Symptoms:**
- Cannot connect to local MCP server
- Server process exits immediately

**Solutions:**

1. **Check Server Process**
   ```bash
   # Ensure server is running
   ps aux | grep "node.*index.js"
   
   # Check port binding
   netstat -tulpn | grep :3000
   ```

2. **Check Logs for Startup Errors**
   ```bash
   # Run with verbose logging
   LOG_LEVEL=debug npm run dev
   
   # Check for port conflicts
   lsof -i :3000
   ```

---

## Rate Limiting Problems

### Problem: "Rate limit exceeded" errors

**Symptoms:**
- 429 HTTP status codes
- "Try again after X time" messages
- Slow responses

**Solutions:**

1. **Check Current Rate Limit Status**
   ```bash
   # Monitor rate limit headers
   curl -I "https://auth.docker.io/token?service=registry.docker.io"
   ```

2. **Adjust Rate Limiting Configuration**
   ```bash
   # Reduce request frequency
   export DOCKERHUB_RATE_LIMIT=50
   export DOCKERHUB_RATE_LIMIT_WINDOW=3600
   
   # Increase cache TTL to reduce API calls
   export CACHE_TTL_SECONDS=600
   ```

3. **Implement Backoff Strategy**
   ```javascript
   // Custom retry logic
   const retryWithBackoff = async (fn, maxRetries = 3) => {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.name === 'RateLimitError' && i < maxRetries - 1) {
           const delay = Math.pow(2, i) * 1000; // Exponential backoff
           await new Promise(resolve => setTimeout(resolve, delay));
           continue;
         }
         throw error;
       }
     }
   };
   ```

### Problem: "Rate limit headers not updating"

**Symptoms:**
- Server not respecting Docker Hub rate limits
- Unexpected rate limit errors

**Solutions:**

1. **Enable Debug Logging**
   ```bash
   # Monitor rate limit header processing
   LOG_LEVEL=debug npm run dev 2>&1 | grep -i "rate"
   ```

2. **Manual Rate Limit Check**
   ```bash
   # Check what Docker Hub reports
   curl -v "https://auth.docker.io/token?service=registry.docker.io" 2>&1 | grep -i "ratelimit"
   ```

---

## MCP Client Integration

### Problem: Claude Desktop not recognizing server

**Symptoms:**
- Server not listed in Claude Desktop
- No MCP tools available
- Connection errors

**Solutions:**

1. **Check Configuration File Location**
   ```bash
   # macOS
   ls -la ~/.config/claude-desktop/claude_desktop_config.json
   
   # Windows  
   dir "%APPDATA%\Claude\claude_desktop_config.json"
   ```

2. **Validate JSON Configuration**
   ```bash
   # Check JSON syntax
   cat ~/.config/claude-desktop/claude_desktop_config.json | jq .
   
   # Expected format:
   {
     "mcpServers": {
       "dockerhub": {
         "command": "node",
         "args": ["/absolute/path/to/dist/index.js"],
         "env": {
           "DOCKERHUB_ACCESS_TOKEN": "your_token"
         }
       }
     }
   }
   ```

3. **Check Path and Permissions**
   ```bash
   # Verify server executable
   ls -la /absolute/path/to/dist/index.js
   
   # Test server standalone
   node /absolute/path/to/dist/index.js --help
   ```

### Problem: "MCP server failed to start"

**Symptoms:**
- Server process crashes on startup
- No response from MCP server
- Error messages in client logs

**Solutions:**

1. **Test Server Independently**
   ```bash
   # Run server in standalone mode
   cd /path/to/dockerhub-mcp-server
   npm run dev
   
   # Test basic functionality
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
   ```

2. **Check Dependencies**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

3. **Environment Variable Issues**
   ```bash
   # Test with minimal environment
   env -i NODE_PATH=/usr/local/lib/node_modules node dist/index.js
   ```

### Problem: Cursor IDE integration issues

**Symptoms:**
- MCP server not appearing in Cursor
- Tools not available in assistant

**Solutions:**

1. **Check Cursor MCP Settings**
   ```json
   // Cursor Settings → Extensions → MCP
   {
     "mcp.servers": [
       {
         "name": "dockerhub",
         "command": "node",
         "args": ["/absolute/path/to/dist/index.js"],
         "workingDirectory": "/absolute/path/to/dockerhub-mcp-server"
       }
     ]
   }
   ```

2. **Restart Cursor After Configuration**
   - Close Cursor completely
   - Clear any MCP cache if available
   - Restart and check MCP server status

---

## Performance Issues

### Problem: Slow response times

**Symptoms:**
- Tools take long time to respond
- Timeout errors
- High memory usage

**Solutions:**

1. **Optimize Caching**
   ```bash
   # Increase cache size and TTL
   export MAX_CACHE_SIZE=2000
   export CACHE_TTL_SECONDS=600
   
   # Monitor cache performance
   LOG_LEVEL=debug npm run dev 2>&1 | grep -i cache
   ```

2. **Reduce Concurrent Requests**
   ```bash
   # Lower rate limits to prevent overwhelming
   export DOCKERHUB_RATE_LIMIT=50
   ```

3. **Memory Management**
   ```bash
   # Monitor memory usage
   node --max-old-space-size=4096 dist/index.js
   
   # Check for memory leaks
   top -p $(pgrep -f "node.*index.js")
   ```

### Problem: High CPU usage

**Symptoms:**
- Server process consuming high CPU
- System becomes unresponsive
- Fan noise increase

**Solutions:**

1. **Profile Performance**
   ```bash
   # Run with profiling
   node --prof dist/index.js
   
   # Generate profile report
   node --prof-process isolate-*.log > profile.txt
   ```

2. **Reduce Processing Load**
   ```bash
   # Disable verbose logging
   export LOG_LEVEL=warn
   
   # Reduce cache processing
   export MAX_CACHE_SIZE=500
   ```

---

## Error Reference

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOTFOUND hub.docker.com` | DNS resolution failure | Check internet connection, DNS settings |
| `ECONNRESET` | Connection dropped | Check proxy settings, network stability |
| `401 Unauthorized` | Invalid credentials | Verify username/password or access token |
| `403 Forbidden` | Permission denied | Check repository access rights |
| `404 Not Found` | Repository/tag doesn't exist | Verify repository name and tag |
| `429 Too Many Requests` | Rate limit exceeded | Wait or use authentication for higher limits |
| `500 Internal Server Error` | Docker Hub service issue | Temporary issue, retry later |
| `EADDRINUSE` | Port already in use | Kill process using port or change port |

### TypeScript/Build Errors

**Error: `Cannot find module '@modelcontextprotocol/sdk'`**
```bash
# Reinstall MCP SDK
npm uninstall @modelcontextprotocol/sdk
npm install @modelcontextprotocol/sdk@latest
```

**Error: `Type errors in compilation`**
```bash
# Check TypeScript configuration
npx tsc --noEmit --listFiles

# Update TypeScript
npm install -D typescript@latest
```

### Runtime Errors

**Error: `UnhandledPromiseRejectionWarning`**
```bash
# Enable detailed error reporting
node --unhandled-rejections=strict dist/index.js
```

**Error: `Maximum call stack size exceeded`**
```bash
# Check for circular dependencies or infinite recursion
node --stack-size=2000 dist/index.js
```

---

## Getting Help

### Collecting Debug Information

When reporting issues, include this information:

```bash
#!/bin/bash
# collect-debug-info.sh

echo "=== System Information ==="
uname -a
node --version
npm --version

echo -e "\n=== Environment Variables ==="
env | grep -E "DOCKERHUB|MCP|NODE" | sort

echo -e "\n=== Package Information ==="  
npm list --depth=0

echo -e "\n=== Recent Logs ==="
tail -n 50 logs/dockerhub-mcp.log 2>/dev/null || echo "No log file found"

echo -e "\n=== Network Test ==="
curl -I https://hub.docker.com
curl -I https://registry-1.docker.io

echo -e "\n=== Server Test ==="
timeout 5s npm start -- --version 2>&1 || echo "Server test failed"
```

### Support Channels

1. **GitHub Issues**: Technical problems and bugs
2. **GitHub Discussions**: General questions and community help  
3. **Documentation**: Check [SETUP.md](SETUP.md) and [EXAMPLES.md](EXAMPLES.md)
4. **Discord/Slack**: Real-time community support (if available)

### Before Requesting Help

- [ ] Run the diagnostic script
- [ ] Check recent GitHub issues for similar problems
- [ ] Try with minimal configuration
- [ ] Test with different images/repositories
- [ ] Collect debug information

### Reporting Bugs

Include in your bug report:
1. **Environment**: OS, Node.js version, npm version
2. **Configuration**: Sanitized .env file (remove secrets)
3. **Steps to reproduce**: Exact commands and inputs
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Logs**: Relevant error messages and debug output
7. **Debug info**: Output from debug collection script

---

## Preventive Measures

### Regular Maintenance

```bash
#!/bin/bash
# maintenance.sh - Run weekly

# Update dependencies
npm audit fix
npm update

# Clear old cache
rm -rf node_modules/.cache

# Rebuild
npm run clean
npm run build

# Test basic functionality
npm test

echo "Maintenance complete"
```

### Monitoring Setup

```bash
#!/bin/bash
# monitor.sh - Health check script

# Check server health
if ! curl -f http://localhost:3000/health; then
  echo "❌ Server health check failed"
  # Restart server or send alert
fi

# Check rate limit status
RATE_LIMIT=$(curl -s -I https://auth.docker.io/token | grep -i ratelimit-remaining | cut -d' ' -f2)
if [ "$RATE_LIMIT" -lt 10 ]; then
  echo "⚠️  Rate limit low: $RATE_LIMIT requests remaining"
fi

# Check disk space for logs/cache
DISK_USAGE=$(df /var/log | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
  echo "⚠️  Disk usage high: ${DISK_USAGE}%"
fi
```

Remember: Most issues are configuration-related. Start with the basics and work systematically through the troubleshooting steps.
