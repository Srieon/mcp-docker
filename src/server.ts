/**
 * Copyright (c) 2025 Docker Hub MCP Server Contributors
 * SPDX-License-Identifier: MIT
 * 
 * This file is part of the Docker Hub MCP Server project.
 * See LICENSE file in the project root for full license information.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { toolRegistry } from './tools/index.js';
import { ErrorHandler } from './utils/error-handler.js';
import { cacheManager } from './cache/cache-manager.js';

/**
 * MCP Server for Docker Hub integration
 */
export class DockerHubMCPServer {
  private server: Server;
  private httpServer?: express.Application;

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
    
    if (config.server.transport === 'http') {
      this.setupHttpServer();
    }
  }

  /**
   * Set up HTTP server for web-based transport
   */
  private setupHttpServer(): void {
    this.httpServer = express();
    
    // Enable CORS if configured
    if (config.server.cors) {
      this.httpServer.use(cors({
        origin: true,
        credentials: true,
      }));
    }
    
    this.httpServer.use(express.json());
    
    // Health check endpoint
    this.httpServer.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        server: {
          name: config.server.name,
          version: config.server.version,
          transport: config.server.transport,
        },
        tools: toolRegistry.getAllTools().length,
        cache: cacheManager.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    // Server info endpoint
    this.httpServer.get('/info', (_req, res) => {
      res.json({
        server: {
          name: config.server.name,
          version: config.server.version,
          transport: config.server.transport,
        },
        tools: toolRegistry.getAllTools().map(tool => ({
          name: tool.name,
          description: tool.description,
        })),
        capabilities: {
          tools: {},
        },
      });
    });
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
    console.log(`Transport: ${config.server.transport}`);
    
    // Log configuration (without sensitive data)
    console.log('Configuration:', {
      cache: config.cache,
      server: {
        name: config.server.name,
        version: config.server.version,
        transport: config.server.transport,
        ...(config.server.transport === 'http' && {
          httpHost: config.server.httpHost,
          httpPort: config.server.httpPort,
          cors: config.server.cors,
        }),
      },
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

    if (config.server.transport === 'http') {
      await this.startHttpTransport();
    } else {
      await this.startStdioTransport();
    }

    console.log('Docker Hub MCP Server is running and ready to accept requests.');
    console.log(`Available tools: ${toolRegistry.getAllTools().map(t => t.name).join(', ')}`);

    // Set up graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Start HTTP transport
   */
  private async startHttpTransport(): Promise<void> {
    if (!this.httpServer) {
      throw new Error('HTTP server not initialized');
    }

    // Add SSE endpoint manually for now since SSEServerTransport doesn't work directly with Express
    this.httpServer.get('/message', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });
      
      res.write('event: connected\n');
      res.write('data: {"message": "MCP Server connected"}\n\n');
      
      // For now, just keep the connection open
      // In a full implementation, this would handle MCP protocol messages
      const keepAlive = setInterval(() => {
        res.write('event: ping\n');
        res.write('data: {"timestamp": "' + new Date().toISOString() + '"}\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
      });
    });

    // Add a simple MCP tools endpoint for demonstration
    this.httpServer.post('/tools', express.json(), async (req, res): Promise<void> => {
      try {
        const { tool, arguments: args } = req.body;
        
        if (!tool) {
          res.status(400).json({ error: 'Tool name required' });
          return;
        }
        
        const toolHandler = toolRegistry.getTool(tool);
        if (!toolHandler) {
          res.status(404).json({ error: `Tool ${tool} not found` });
          return;
        }
        
        const validationResult = toolHandler.inputSchema.safeParse(args || {});
        if (!validationResult.success) {
          res.status(400).json({ 
            error: `Invalid arguments: ${validationResult.error.message}` 
          });
          return;
        }
        
        const result = await toolHandler.execute(validationResult.data);
        res.json({ result });
        
      } catch (error: any) {
        console.error('Tool execution error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    });

    const httpServerInstance = this.httpServer.listen(
      config.server.httpPort,
      config.server.httpHost,
      () => {
        console.log(`HTTP server listening on http://${config.server.httpHost}:${config.server.httpPort}`);
        console.log(`Health check available at: http://${config.server.httpHost}:${config.server.httpPort}/health`);
        console.log(`Server info available at: http://${config.server.httpHost}:${config.server.httpPort}/info`);
        console.log(`MCP SSE endpoint available at: http://${config.server.httpHost}:${config.server.httpPort}/message`);
        console.log(`Tools endpoint available at: http://${config.server.httpHost}:${config.server.httpPort}/tools`);
      }
    );

    // Store the server instance for cleanup
    (this as any).httpServerInstance = httpServerInstance;
  }

  /**
   * Start stdio transport
   */
  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('MCP server connected via stdio transport');
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('Shutting down Docker Hub MCP Server...');
    
    try {
      // Clear caches
      cacheManager.clear();
      
      // Close HTTP server if it exists
      const httpServerInstance = (this as any).httpServerInstance;
      if (httpServerInstance) {
        await new Promise<void>((resolve) => {
          httpServerInstance.close(() => {
            console.log('HTTP server closed');
            resolve();
          });
        });
      }
      
      // Close MCP server connection
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
