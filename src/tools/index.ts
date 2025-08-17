import { z } from 'zod';

/**
 * Interface for MCP tools
 */
export interface MCPTool<T = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<T, any, any>;
  execute: (args: T) => Promise<any>;
}

/**
 * Tool registry for managing MCP tools
 */
export class ToolRegistry {
  private tools = new Map<string, MCPTool>();

  /**
   * Register a new tool
   */
  register<T>(tool: MCPTool<T>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered
   */
  hasTools(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// Create and export singleton registry
export const toolRegistry = new ToolRegistry();

// Import and register all tools
import { searchImagesTool } from './search-images.js';
import { getImageDetailsTool } from './get-image-details.js';
import { listTagsTool } from './list-tags.js';
import { getManifestTool } from './get-manifest.js';
import { analyzeLayersTool } from './analyze-layers.js';
import { compareImagesTool } from './compare-images.js';
import { getDockerfileTool } from './get-dockerfile.js';
import { getStatsTool } from './get-stats.js';
import { getVulnerabilitiesTool } from './get-vulnerabilities.js';
import { getImageHistoryTool } from './get-image-history.js';
import { estimatePullSizeTool } from './estimate-pull-size.js';
import { batchImageDetailsTool } from './batch-image-details.js';
import { exportDataTool } from './export-data.js';
import { enhancedVulnerabilityTool } from './enhanced-vulnerability-analysis.js';

// Register required tools
toolRegistry.register(searchImagesTool);
toolRegistry.register(getImageDetailsTool);
toolRegistry.register(listTagsTool);
toolRegistry.register(getManifestTool);
toolRegistry.register(analyzeLayersTool);
toolRegistry.register(compareImagesTool);
toolRegistry.register(getDockerfileTool);
toolRegistry.register(getStatsTool);

// Register bonus tools
toolRegistry.register(getVulnerabilitiesTool);
toolRegistry.register(getImageHistoryTool);
toolRegistry.register(estimatePullSizeTool);
toolRegistry.register(batchImageDetailsTool);
toolRegistry.register(exportDataTool);
toolRegistry.register(enhancedVulnerabilityTool);
