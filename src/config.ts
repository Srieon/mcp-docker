import dotenv from 'dotenv';
import { Config, ConfigSchema } from './types.js';

// Load environment variables
dotenv.config();

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const config = {
    dockerhub: {
      username: process.env.DOCKERHUB_USERNAME,
      password: process.env.DOCKERHUB_PASSWORD,
      accessToken: process.env.DOCKERHUB_ACCESS_TOKEN,
      rateLimit: parseInt(process.env.DOCKERHUB_RATE_LIMIT || '100', 10),
      rateLimitWindow: parseInt(process.env.DOCKERHUB_RATE_LIMIT_WINDOW || '3600', 10),
    },
    privateRegistry: process.env.PRIVATE_REGISTRY_URL ? {
      url: process.env.PRIVATE_REGISTRY_URL,
      username: process.env.PRIVATE_REGISTRY_USERNAME,
      password: process.env.PRIVATE_REGISTRY_PASSWORD,
    } : undefined,
      cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    maxSize: parseInt(process.env.MAX_CACHE_SIZE || '1000', 10),
  },
  server: {
    name: process.env.MCP_SERVER_NAME || 'dockerhub-mcp-server',
    version: process.env.MCP_SERVER_VERSION || '1.0.0',
    transport: (process.env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
    httpPort: parseInt(process.env.MCP_HTTP_PORT || '3000', 10),
    httpHost: process.env.MCP_HTTP_HOST || 'localhost',
    cors: process.env.MCP_CORS !== 'false',
  },
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  };

  // Validate configuration
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.issues);
    process.exit(1);
  }

  // Validate authentication
  const dockerhubConfig = result.data.dockerhub;
  if (!dockerhubConfig.accessToken && (!dockerhubConfig.username || !dockerhubConfig.password)) {
    console.warn('Warning: No Docker Hub authentication configured. Some features may be limited.');
  }

  return result.data;
}

/**
 * Get the current configuration
 */
export const config = loadConfig();
