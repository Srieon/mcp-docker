# Docker Hub MCP Server

A comprehensive Model Context Protocol (MCP) server that provides seamless integration with Docker Hub, enabling AI assistants to search, analyze, and manage Docker images through standardized MCP tools.

## 🚀 Features

### Core Capabilities
- **Image Search & Discovery**: Search Docker Hub with advanced filtering options
- **Detailed Image Analysis**: Get comprehensive repository information and statistics  
- **Tag Management**: List and analyze all available tags for repositories
- **Layer Analysis**: Deep dive into image layers, sizes, and optimization opportunities
- **Image Comparison**: Compare two images for differences in layers, sizes, and composition
- **Dockerfile Retrieval**: Attempt to retrieve Dockerfile content when available
- **Statistics & Metrics**: Download counts, star ratings, and popularity analytics

### Advanced Features
- **Security Scanning**: Vulnerability analysis and security recommendations
- **Build History**: Detailed layer-by-layer build process analysis
- **Pull Size Estimation**: Calculate actual download sizes considering caching and compression
- **Performance Optimization**: Layer deduplication and size optimization insights

### Technical Excellence
- **Production Ready**: Built with TypeScript, comprehensive error handling, and rate limiting
- **Smart Caching**: Intelligent caching system to minimize API calls and improve performance
- **Authentication Support**: Secure credential management for both public and private registries
- **MCP Standard Compliance**: Fully compatible with popular MCP clients (Claude Desktop, Cursor, Cline)

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dockerhub-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your Docker Hub credentials (optional for public images)
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file from the provided template:

```bash
# Docker Hub Authentication (Optional for public images)
DOCKERHUB_USERNAME=your_dockerhub_username
DOCKERHUB_PASSWORD=your_dockerhub_password
# OR use access token instead
DOCKERHUB_ACCESS_TOKEN=your_dockerhub_access_token

# Private Registry Support (Optional)
PRIVATE_REGISTRY_URL=https://your-private-registry.com
PRIVATE_REGISTRY_USERNAME=your_private_username
PRIVATE_REGISTRY_PASSWORD=your_private_password

# Server Configuration
MCP_SERVER_NAME=dockerhub-mcp-server
MCP_SERVER_VERSION=1.0.0

# Performance Tuning
CACHE_TTL_SECONDS=300
MAX_CACHE_SIZE=1000
DOCKERHUB_RATE_LIMIT=100
DOCKERHUB_RATE_LIMIT_WINDOW=3600

# Logging
LOG_LEVEL=info
```

### Authentication

The server supports multiple authentication methods:

1. **Anonymous Access**: Works for all public Docker Hub images
2. **Username/Password**: Standard Docker Hub login credentials
3. **Access Token**: More secure, generated from Docker Hub settings
4. **Private Registry**: Support for custom registries

See [SETUP.md](docs/SETUP.md) for detailed authentication configuration.

## 🛠️ Available MCP Tools

### Required Tools

| Tool Name | Description |
|-----------|-------------|
| `docker_search_images` | Search Docker Hub for images with filtering options |
| `docker_get_image_details` | Get comprehensive repository information |
| `docker_list_tags` | List all available tags with detailed metadata |
| `docker_get_manifest` | Retrieve Docker image manifest and layer info |
| `docker_analyze_layers` | Analyze image layers for optimization insights |
| `docker_compare_images` | Compare two images for differences |
| `docker_get_dockerfile` | Attempt to retrieve Dockerfile content |
| `docker_get_stats` | Get download statistics and popularity metrics |

### Bonus Tools

| Tool Name | Description |
|-----------|-------------|
| `docker_get_vulnerabilities` | Fetch security vulnerability scan results |
| `docker_get_image_history` | Get detailed build history and timeline |
| `docker_estimate_pull_size` | Calculate estimated download size for pulls |

## 📖 Usage Examples

### Basic Image Search
```json
{
  "tool": "docker_search_images",
  "arguments": {
    "query": "nginx",
    "limit": 10,
    "is_official": true
  }
}
```

### Detailed Image Analysis
```json
{
  "tool": "docker_get_image_details",
  "arguments": {
    "repository": "library/nginx"
  }
}
```

### Layer Analysis for Optimization
```json
{
  "tool": "docker_analyze_layers",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}
```

### Image Comparison
```json
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "library/node",
    "tag1": "18-alpine",
    "repository2": "library/node", 
    "tag2": "18-slim"
  }
}
```

### Security Analysis
```json
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "library/ubuntu",
    "tag": "latest"
  }
}
```

See [EXAMPLES.md](docs/EXAMPLES.md) for more comprehensive usage examples and workflows.

## 🏗️ Development

### Project Structure
```
src/
├── auth/           # Authentication management
├── cache/          # Caching infrastructure  
├── clients/        # Docker Hub API client
├── tools/          # MCP tool implementations
├── utils/          # Utilities (error handling, rate limiting)
├── types.ts        # TypeScript type definitions
├── config.ts       # Configuration management
├── server.ts       # MCP server implementation
└── index.ts        # Entry point
```

### Development Commands
```bash
# Development with hot reload
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

The project includes comprehensive testing:

- **Unit Tests**: Individual function and class testing
- **Integration Tests**: Full API workflow testing  
- **Mock Tests**: Testing with simulated Docker Hub responses

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- tools/search-images.test.ts
```

## 🔌 Integration with MCP Clients

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "dockerhub": {
      "command": "node",
      "args": ["/path/to/dockerhub-mcp-server/dist/index.js"],
      "env": {
        "DOCKERHUB_USERNAME": "your_username"
      }
    }
  }
}
```

### Cursor

The server is compatible with Cursor's MCP integration. See the [integration guide](docs/INTEGRATION.md) for setup instructions.

### Cline

Works seamlessly with Cline's MCP support. Refer to Cline's documentation for MCP server configuration.

## 🐳 Docker Support

### Using Docker Compose

A `docker-compose.yml` is provided for easy testing with a local registry:

```bash
# Start local registry and server
docker-compose up

# Test with local registry
curl -X POST http://localhost:3000/api/search -d '{"query": "nginx"}'
```

### Building Docker Image

```bash
# Build the image
docker build -t dockerhub-mcp-server .

# Run the container
docker run -d \
  --name dockerhub-mcp \
  -e DOCKERHUB_USERNAME=your_username \
  -e DOCKERHUB_PASSWORD=your_password \
  dockerhub-mcp-server
```

## 🚨 Troubleshooting

### Common Issues

**Authentication Failures**
- Verify credentials in `.env` file
- Check if 2FA is enabled (use access token instead)
- Ensure proper permissions for private repositories

**Rate Limiting**
- Default limits: 100 requests per hour
- Authenticated users get higher limits
- Implement exponential backoff for retries

**Network Issues**
- Check firewall settings
- Verify DNS resolution for `registry-1.docker.io`
- Consider proxy configuration if behind corporate firewall

See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for comprehensive troubleshooting guide.

## 📊 Performance & Optimization

### Caching Strategy
- **Image Metadata**: Cached for 10 minutes
- **Search Results**: Cached for 5 minutes
- **Layer Information**: Cached for 30 minutes
- **Vulnerability Scans**: Cached for 1 hour

### Rate Limiting
- Automatic rate limit detection from Docker Hub headers
- Intelligent backoff when limits are approached
- Queue management for high-volume requests

### Memory Management
- LRU cache with configurable size limits
- Automatic cleanup of expired entries
- Memory usage monitoring and alerts

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

### Code Standards
- TypeScript strict mode
- ESLint configuration provided
- 100% test coverage for new features
- Comprehensive documentation

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP specification
- [Docker Hub API](https://docs.docker.com/registry/spec/api/) for the comprehensive API
- TypeScript and Node.js communities for excellent tooling

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)

---

**Built with ❤️ for the Docker and AI communities**
