#!/usr/bin/env node

/**
 * Docker Hub MCP Server Entry Point
 * 
 * This is a Model Context Protocol (MCP) server that provides comprehensive
 * integration with Docker Hub, enabling AI assistants to search, analyze,
 * and manage Docker images through standardized MCP tools.
 */

import { mcpServer } from './server.js';

/**
 * Main function to start the MCP server
 */
async function main(): Promise<void> {
  try {
    await mcpServer.start();
  } catch (error) {
    console.error('Failed to start Docker Hub MCP Server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
