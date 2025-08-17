# Examples and Use Cases

This document provides practical examples and workflows for using the Docker Hub MCP Server with various MCP clients.

## Table of Contents

- [Basic Operations](#basic-operations)
- [Image Analysis Workflows](#image-analysis-workflows)
- [Security and Optimization](#security-and-optimization)
- [Comparison and Selection](#comparison-and-selection)
- [Advanced Use Cases](#advanced-use-cases)
- [Integration Examples](#integration-examples)

---

## Basic Operations

### Finding the Right Base Image

**Scenario:** You need to find an official Python image for your application.

**Workflow:**
```json
// 1. Search for Python images
{
  "tool": "docker_search_images",
  "arguments": {
    "query": "python",
    "is_official": true,
    "limit": 10
  }
}

// 2. Get detailed information about the official Python image
{
  "tool": "docker_get_image_details",
  "arguments": {
    "repository": "library/python"
  }
}

// 3. List available Python tags to find the right version
{
  "tool": "docker_list_tags",
  "arguments": {
    "repository": "library/python",
    "limit": 20
  }
}
```

**Expected Results:**
- Search returns official Python images with popularity metrics
- Details show repository statistics and recent activity  
- Tags list shows available Python versions (3.11, 3.10, etc.) with sizes

### Exploring Popular Images in a Category

**Scenario:** Find the most popular web servers on Docker Hub.

**Workflow:**
```json
// Search for web server images
{
  "tool": "docker_search_images", 
  "arguments": {
    "query": "web server",
    "limit": 15
  }
}

// Get statistics for top results
{
  "tool": "docker_get_stats",
  "arguments": {
    "repository": "library/nginx"
  }
}

{
  "tool": "docker_get_stats", 
  "arguments": {
    "repository": "library/httpd"
  }
}
```

**Analysis Points:**
- Compare pull counts to gauge popularity
- Check star ratings for community approval
- Review last updated dates for maintenance activity
- Consider official vs community images

---

## Image Analysis Workflows

### Complete Image Assessment

**Scenario:** Evaluate a Docker image before using it in production.

**Step 1: Basic Information**
```json
{
  "tool": "docker_get_image_details",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}
```

**Step 2: Size and Layer Analysis**
```json
{
  "tool": "docker_analyze_layers",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}
```

**Step 3: Security Assessment**
```json
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}
```

**Step 4: Download Impact**
```json
{
  "tool": "docker_estimate_pull_size",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine",
    "architecture": "amd64"
  }
}
```

**Decision Matrix:**
- **Size**: Acceptable for container deployment?
- **Security**: Any critical vulnerabilities?
- **Maintenance**: Recently updated?
- **Performance**: Download time acceptable?
- **Complexity**: Layer structure optimized?

### Layer Optimization Analysis

**Scenario:** Optimize a Docker image for better performance.

```json
// 1. Analyze current layer structure
{
  "tool": "docker_analyze_layers",
  "arguments": {
    "repository": "mycompany/webapp",
    "tag": "latest"
  }
}

// 2. Get detailed build history
{
  "tool": "docker_get_image_history",
  "arguments": {
    "repository": "mycompany/webapp", 
    "tag": "latest"
  }
}

// 3. Attempt to get Dockerfile for reference
{
  "tool": "docker_get_dockerfile",
  "arguments": {
    "repository": "mycompany/webapp",
    "tag": "latest"
  }
}
```

**Optimization Checklist:**
- [ ] Consolidate RUN commands
- [ ] Use multi-stage builds
- [ ] Remove unnecessary packages
- [ ] Optimize COPY operations
- [ ] Use .dockerignore effectively

---

## Security and Optimization

### Security Audit Workflow

**Scenario:** Perform comprehensive security assessment of container images.

**Step 1: Current Environment Scan**
```json
// Scan base image
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "library/ubuntu",
    "tag": "20.04"
  }
}

// Scan application image  
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "mycompany/app",
    "tag": "v1.2.3"
  }
}
```

**Step 2: Alternative Assessment**
```json
// Check security of potential alternatives
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "library/alpine", 
    "tag": "3.18"
  }
}

{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "distroless/java",
    "tag": "11"
  }
}
```

**Step 3: Risk Analysis**
```json
// Compare base images for security
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "library/ubuntu",
    "tag1": "20.04",
    "repository2": "library/alpine", 
    "tag2": "3.18"
  }
}
```

**Security Recommendations:**
- Prioritize images with fewer vulnerabilities
- Choose smaller base images (reduced attack surface)
- Prefer official and regularly updated images
- Implement regular vulnerability scanning

### Performance Optimization

**Scenario:** Reduce Docker image pull times and storage requirements.

**Analysis Workflow:**
```json
// 1. Analyze current image size breakdown
{
  "tool": "docker_estimate_pull_size",
  "arguments": {
    "repository": "mycompany/large-app",
    "tag": "latest"
  }
}

// 2. Examine layer structure for optimization
{
  "tool": "docker_analyze_layers", 
  "arguments": {
    "repository": "mycompany/large-app",
    "tag": "latest"
  }
}

// 3. Compare with optimized alternatives
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "mycompany/large-app",
    "tag1": "latest",
    "repository2": "mycompany/large-app",
    "tag2": "optimized"
  }
}
```

**Optimization Strategies:**
- Use multi-stage builds
- Choose minimal base images
- Consolidate layer operations
- Remove unnecessary files
- Leverage layer caching

---

## Comparison and Selection

### Base Image Selection

**Scenario:** Choose between different Node.js base images for a web application.

**Candidates Comparison:**
```json
// Option 1: Standard Node image
{
  "tool": "docker_get_image_details",
  "arguments": {
    "repository": "library/node",
    "tag": "18"
  }
}

// Option 2: Alpine-based Node image  
{
  "tool": "docker_get_image_details",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}

// Option 3: Slim Node image
{
  "tool": "docker_get_image_details",
  "arguments": {
    "repository": "library/node",
    "tag": "18-slim"
  }
}
```

**Direct Comparisons:**
```json
// Compare Alpine vs Slim
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "library/node",
    "tag1": "18-alpine", 
    "repository2": "library/node",
    "tag2": "18-slim"
  }
}

// Compare Alpine vs Full
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "library/node",
    "tag1": "18-alpine",
    "repository2": "library/node", 
    "tag2": "18"
  }
}
```

**Decision Factors:**
- **Size**: Alpine < Slim < Full
- **Security**: Fewer packages = smaller attack surface  
- **Compatibility**: Full > Slim > Alpine
- **Performance**: Smaller = faster pulls and starts

### Multi-Architecture Selection

**Scenario:** Choose optimal image for multi-architecture deployment.

```json
// Analyze ARM64 support
{
  "tool": "docker_estimate_pull_size",
  "arguments": {
    "repository": "library/nginx",
    "tag": "alpine",
    "architecture": "arm64"
  }
}

// Compare with AMD64
{
  "tool": "docker_estimate_pull_size",
  "arguments": {
    "repository": "library/nginx", 
    "tag": "alpine",
    "architecture": "amd64"
  }
}

// Check tag details for architecture support
{
  "tool": "docker_list_tags",
  "arguments": {
    "repository": "library/nginx",
    "limit": 5
  }
}
```

---

## Advanced Use Cases

### CI/CD Pipeline Integration

**Scenario:** Integrate security and quality checks into deployment pipeline.

**Pipeline Step 1: Image Validation**
```bash
#!/bin/bash
# validate-image.sh

IMAGE_REPO="$1"
IMAGE_TAG="$2"

# Check image exists and get basic info
docker_get_image_details "$IMAGE_REPO"

# Security scan
VULN_SCAN=$(docker_get_vulnerabilities "$IMAGE_REPO" "$IMAGE_TAG")
HIGH_VULNS=$(echo "$VULN_SCAN" | jq '.scan_summary.high')

if [ "$HIGH_VULNS" -gt 5 ]; then
  echo "❌ Too many high severity vulnerabilities: $HIGH_VULNS"
  exit 1
fi

# Size check
SIZE_INFO=$(docker_estimate_pull_size "$IMAGE_REPO" "$IMAGE_TAG")
SIZE_MB=$(echo "$SIZE_INFO" | jq '.size_breakdown.compressed_size / 1024 / 1024')

if [ "$SIZE_MB" -gt 500 ]; then
  echo "⚠️  Large image size: ${SIZE_MB}MB"
fi

echo "✅ Image validation passed"
```

**Pipeline Step 2: Optimization Recommendations**
```bash
#!/bin/bash
# optimize-recommendations.sh

IMAGE_REPO="$1"
IMAGE_TAG="$2"

# Get layer analysis
LAYER_ANALYSIS=$(docker_analyze_layers "$IMAGE_REPO" "$IMAGE_TAG")

# Extract recommendations
echo "$LAYER_ANALYSIS" | jq -r '.optimizations[]' | while read rec; do
  echo "💡 $rec"
done

# Get build history insights  
BUILD_HISTORY=$(docker_get_image_history "$IMAGE_REPO" "$IMAGE_TAG")
echo "$BUILD_HISTORY" | jq -r '.optimization_insights[]' | while read insight; do
  echo "🔍 $insight"
done
```

### Dependency Analysis

**Scenario:** Analyze and track base image dependencies across projects.

**Dependency Mapping:**
```json
// For each project image, check base image
{
  "tool": "docker_get_image_history",
  "arguments": {
    "repository": "project-a/api",
    "tag": "latest"
  }
}

{
  "tool": "docker_get_image_history", 
  "arguments": {
    "repository": "project-b/worker", 
    "tag": "latest"
  }
}

// Analyze base image security and updates
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}
```

**Update Planning:**
```json
// Check if newer versions are available
{
  "tool": "docker_list_tags",
  "arguments": {
    "repository": "library/node",
    "limit": 10
  }
}

// Compare current vs latest
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "library/node",
    "tag1": "18-alpine",
    "repository2": "library/node",
    "tag2": "20-alpine" 
  }
}
```

### Registry Migration Planning

**Scenario:** Plan migration from Docker Hub to private registry.

**Assessment Workflow:**
```json
// 1. Inventory current images
{
  "tool": "docker_search_images",
  "arguments": {
    "query": "mycompany/",
    "limit": 50
  }
}

// 2. Analyze each image
{
  "tool": "docker_get_stats",
  "arguments": {
    "repository": "mycompany/webapp"
  }
}

// 3. Estimate transfer requirements
{
  "tool": "docker_estimate_pull_size",
  "arguments": {
    "repository": "mycompany/webapp",
    "tag": "latest"
  }
}
```

---

## Integration Examples

### Claude Desktop Integration

**Example: Image Analysis Conversation**

```
User: "I need to analyze the nginx:alpine image for production use"

Claude: I'll help you analyze the nginx:alpine image for production readiness. Let me gather comprehensive information.

[Uses docker_get_image_details tool]
[Uses docker_analyze_layers tool] 
[Uses docker_get_vulnerabilities tool]
[Uses docker_estimate_pull_size tool]

Based on my analysis:

**Size & Performance:**
- Image size: 23.4 MB (very compact)
- Download time: ~2 seconds on broadband
- Well-optimized layer structure

**Security Assessment:**
- 3 low severity vulnerabilities found
- No critical or high severity issues
- Suitable for production with monitoring

**Recommendations:**
✅ Excellent choice for production
✅ Minimal attack surface due to Alpine base
✅ Fast deployment due to small size
⚠️  Monitor for security updates
⚠️  Consider implementing vulnerability scanning
```

### Cursor IDE Integration

**Example: Dockerfile Optimization**

```typescript
// User working on Dockerfile optimization
// Cursor suggests improvements based on MCP analysis

const analyzeDockerfile = async (imageName: string) => {
  // MCP tool calls through Cursor integration
  const layers = await mcp.callTool('docker_analyze_layers', {
    repository: imageName,
    tag: 'latest'
  });
  
  const recommendations = layers.optimizations;
  
  // Cursor shows inline suggestions
  recommendations.forEach(rec => {
    console.log(`💡 Optimization: ${rec}`);
  });
};
```

### Custom MCP Client

**Example: Automated Image Scanning**

```javascript
import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';

class ImageScanner {
  constructor() {
    this.client = new MCPClient();
  }
  
  async scanImage(repository, tag = 'latest') {
    // Connect to MCP server
    await this.client.connect({
      command: 'node',
      args: ['./dist/index.js'],
      env: process.env
    });
    
    // Comprehensive analysis
    const [details, vulnerabilities, layers, size] = await Promise.all([
      this.client.callTool('docker_get_image_details', { repository }),
      this.client.callTool('docker_get_vulnerabilities', { repository, tag }),
      this.client.callTool('docker_analyze_layers', { repository, tag }),
      this.client.callTool('docker_estimate_pull_size', { repository, tag })
    ]);
    
    return {
      repository,
      tag,
      summary: {
        size: size.size_breakdown.formatted_compressed_size,
        vulnerabilities: vulnerabilities.scan_summary,
        optimization_score: this.calculateOptimizationScore(layers),
        production_ready: this.assessProductionReadiness(vulnerabilities, layers)
      },
      recommendations: [
        ...vulnerabilities.recommendations,
        ...layers.optimizations
      ]
    };
  }
  
  calculateOptimizationScore(layers) {
    // Custom scoring logic
    let score = 100;
    if (layers.summary.total_layers > 15) score -= 20;
    if (layers.summary.total_size > 500 * 1024 * 1024) score -= 30;
    return Math.max(0, score);
  }
  
  assessProductionReadiness(vulnerabilities, layers) {
    const criticalVulns = vulnerabilities.scan_summary?.high || 0;
    const largeSize = layers.summary.total_size > 1024 * 1024 * 1024;
    
    return criticalVulns === 0 && !largeSize;
  }
}

// Usage
const scanner = new ImageScanner();
const report = await scanner.scanImage('library/nginx', 'alpine');
console.log('Scan Report:', report);
```

---

## Best Practices

### Workflow Patterns

1. **Always start with search** - Understand available options
2. **Get detailed info** - Check maintenance and popularity  
3. **Analyze security** - Scan for vulnerabilities
4. **Compare alternatives** - Don't settle for first option
5. **Estimate impact** - Consider download and storage costs
6. **Document decisions** - Track rationale for future reference

### Automation Guidelines

```bash
# Example automation script
#!/bin/bash

analyze_image() {
  local repo="$1"
  local tag="${2:-latest}"
  
  echo "🔍 Analyzing $repo:$tag"
  
  # Basic info
  docker_get_image_details "$repo" | jq '.statistics'
  
  # Security check
  docker_get_vulnerabilities "$repo" "$tag" | jq '.scan_summary'
  
  # Size analysis
  docker_estimate_pull_size "$repo" "$tag" | jq '.size_breakdown'
  
  echo "✅ Analysis complete for $repo:$tag"
}

# Analyze multiple images
for image in "nginx:alpine" "node:18-alpine" "postgres:15"; do
  IFS=':' read -r repo tag <<< "$image"
  analyze_image "$repo" "$tag"
done
```

### Error Handling

```javascript
async function robustImageAnalysis(repository, tag) {
  try {
    const results = {};
    
    // Try each analysis with individual error handling
    try {
      results.details = await mcp.callTool('docker_get_image_details', { repository });
    } catch (e) {
      console.warn('Failed to get details:', e.message);
      results.details = null;
    }
    
    try {
      results.vulnerabilities = await mcp.callTool('docker_get_vulnerabilities', { repository, tag });
    } catch (e) {
      console.warn('Vulnerability scan unavailable:', e.message);
      results.vulnerabilities = null;
    }
    
    return results;
    
  } catch (error) {
    console.error('Analysis failed:', error);
    throw new Error(`Cannot analyze ${repository}:${tag}`);
  }
}
```

This examples guide demonstrates the versatility and power of the Docker Hub MCP Server across different scenarios and integration patterns. Adapt these examples to your specific use cases and workflows.
