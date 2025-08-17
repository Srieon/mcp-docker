import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { toolRegistry } from './tools/index.js';
import { ErrorHandler } from './utils/error-handler.js';
import { cacheManager } from './cache/cache-manager.js';

/**
 * MCP Server for Docker Hub integration
 */
export class DockerHubMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: config.server.name,
        version: config.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolRegistry.getAllTools().map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Get the tool handler
        const tool = toolRegistry.getTool(name);
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool ${name} not found`
          );
        }

        // Validate arguments
        const validationResult = tool.inputSchema.safeParse(args);
        if (!validationResult.success) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments for tool ${name}: ${validationResult.error.message}`
          );
        }

        // Execute the tool
        const result = await tool.execute(validationResult.data);

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // Handle different types of errors
        if (error instanceof McpError) {
          throw error;
        }

        const dockerHubError = ErrorHandler.handleError(error);
        ErrorHandler.logError(dockerHubError, `Tool execution: ${name}`);

        throw new McpError(
          ErrorCode.InternalError,
          ErrorHandler.createUserFriendlyMessage(dockerHubError)
        );
      }
    });

    // Note: Server-side notification handling may not be available in all MCP SDK versions
    // This would be used for handling client notifications if supported

    // Error handler
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    console.log(`Starting ${config.server.name} v${config.server.version}`);
    
    // Log configuration (without sensitive data)
    console.log('Configuration:', {
      cache: config.cache,
      server: config.server,
      logLevel: config.logLevel,
      dockerhubAuth: {
        hasUsername: !!config.dockerhub.username,
        hasPassword: !!config.dockerhub.password,
        hasAccessToken: !!config.dockerhub.accessToken,
      },
      privateRegistry: {
        configured: !!config.privateRegistry,
      },
    });

    // Initialize transport
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await this.server.connect(transport);

    console.log('Docker Hub MCP Server is running and ready to accept requests.');
    console.log(`Available tools: ${toolRegistry.getAllTools().map(t => t.name).join(', ')}`);

    // Set up graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('Shutting down Docker Hub MCP Server...');
    
    try {
      // Clear caches
      cacheManager.clear();
      
      // Close server connection
      await this.server.close();
      
      console.log('Server shutdown complete.');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    server: { name: string; version: string };
    tools: number;
    cache: ReturnType<typeof cacheManager.getStats>;
  } {
    return {
      server: {
        name: config.server.name,
        version: config.server.version,
      },
      tools: toolRegistry.getAllTools().length,
      cache: cacheManager.getStats(),
    };
  }
}

/**
 * Create and export server instance
 */
export const mcpServer = new DockerHubMCPServer();
