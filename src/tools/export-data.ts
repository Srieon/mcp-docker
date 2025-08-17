import { MCPTool } from './index.js';
import { z } from 'zod';
import { ExportFormatter } from '../utils/export-formatter.js';
import { dockerHubClient } from '../clients/dockerhub.js';
import { ErrorHandler } from '../utils/error-handler.js';

/**
 * Export Data Tool - Convert Docker image data to various formats
 */

export const ExportDataArgsSchema = z.object({
  repository: z.string().describe('Repository name to export data for'),
  tag: z.string().default('latest').describe('Image tag'),
  export_type: z.enum(['dependency-tree', 'layer-analysis', 'manifest-csv']).describe('Type of data to export'),
  format: z.enum(['json', 'csv', 'tree-string']).default('json').describe('Output format'),
});

export type ExportDataArgs = z.infer<typeof ExportDataArgsSchema>;

export const exportDataTool: MCPTool<ExportDataArgs> = {
  name: 'docker_export_data',
  description: 'Export Docker image data in various formats including dependency trees, CSV analysis, and structured data for external consumption.',
  inputSchema: ExportDataArgsSchema,
  
  async execute(args: ExportDataArgs) {
    const { repository, tag, export_type, format } = args;

    try {
      console.log(`Exporting ${export_type} data for ${repository}:${tag} in ${format} format`);

      switch (export_type) {
        case 'dependency-tree':
          return await exportDependencyTree(repository, tag, format);
        
        case 'layer-analysis':
          return await exportLayerAnalysis(repository, tag, format);
        
        case 'manifest-csv':
          return await exportManifestCSV(repository, tag, format);
        
        default:
          throw new Error(`Unsupported export type: ${export_type}`);
      }
      
    } catch (error) {
      throw ErrorHandler.handleError(error);
    }
  },
};

/**
 * Export dependency tree for an image
 */
async function exportDependencyTree(repository: string, tag: string, format: string): Promise<any> {
  const [manifest, imageConfig] = await Promise.all([
    dockerHubClient.getManifest(repository, tag),
    dockerHubClient.getImageConfig(repository, tag),
  ]);

  const dependencyTree = ExportFormatter.layersToDependencyTree(repository, manifest, imageConfig);

  const result = {
    repository,
    tag,
    export_type: 'dependency-tree',
    format,
    metadata: {
      total_size: manifest.layers.reduce((sum, layer) => sum + layer.size, 0),
      layer_count: manifest.layers.length,
      architecture: imageConfig.architecture,
      os: imageConfig.os,
    },
  };

  switch (format) {
    case 'tree-string':
      return {
        ...result,
        exported_data: ExportFormatter.dependencyTreeToString(dependencyTree),
        usage: 'Text representation of dependency tree - suitable for documentation or console output',
      };
    
    case 'csv':
      // Convert tree to flat CSV format
      const csvData = flattenDependencyTree(dependencyTree);
      return {
        ...result,
        exported_data: ExportFormatter.toCSV(csvData),
        usage: 'Flattened dependency data in CSV format - suitable for spreadsheet analysis',
      };
    
    case 'json':
    default:
      return {
        ...result,
        exported_data: dependencyTree,
        usage: 'Structured JSON dependency tree - suitable for programmatic processing',
      };
  }
}

/**
 * Export layer analysis data
 */
async function exportLayerAnalysis(repository: string, tag: string, format: string): Promise<any> {
  const [manifest, imageConfig] = await Promise.all([
    dockerHubClient.getManifest(repository, tag),
    dockerHubClient.getImageConfig(repository, tag),
  ]);

  const totalSize = manifest.layers.reduce((sum, layer) => sum + layer.size, 0);
  
  const layersWithHistory = manifest.layers.map((layer, index) => {
    const historyEntry = imageConfig.history[index];
    
    return {
      layer_index: index + 1,
      digest: layer.digest,
      size_bytes: layer.size,
      size_formatted: formatBytes(layer.size),
      media_type: layer.mediaType,
      percentage_of_total: ((layer.size / totalSize) * 100).toFixed(2),
      instruction: extractDockerInstruction(historyEntry?.created_by || ''),
      created_by: historyEntry?.created_by || 'Unknown',
      created: historyEntry?.created || null,
      empty_layer: historyEntry?.empty_layer || false,
    };
  });

  const result = {
    repository,
    tag,
    export_type: 'layer-analysis',
    format,
    metadata: {
      total_size: totalSize,
      total_size_formatted: formatBytes(totalSize),
      layer_count: manifest.layers.length,
      empty_layers: layersWithHistory.filter(l => l.empty_layer).length,
    },
  };

  switch (format) {
    case 'csv':
      return {
        ...result,
        exported_data: ExportFormatter.toCSV(layersWithHistory.map(l => ({ repository, ...l }))),
        usage: 'Layer analysis data in CSV format - suitable for spreadsheet analysis and optimization planning',
      };
    
    case 'tree-string':
      const treeView = createLayerTreeView(layersWithHistory);
      return {
        ...result,
        exported_data: treeView,
        usage: 'Layer hierarchy in tree format - suitable for visual analysis',
      };
    
    case 'json':
    default:
      return {
        ...result,
        exported_data: {
          layers: layersWithHistory,
          summary: {
            instruction_distribution: layersWithHistory.reduce((acc: any, layer) => {
              acc[layer.instruction] = (acc[layer.instruction] || 0) + 1;
              return acc;
            }, {}),
            size_distribution: categorizeLayersBySizes(layersWithHistory, totalSize),
          },
        },
        usage: 'Detailed layer analysis with summary statistics - suitable for optimization and debugging',
      };
  }
}

/**
 * Export manifest data as CSV
 */
async function exportManifestCSV(repository: string, tag: string, format: string): Promise<any> {
  const manifest = await dockerHubClient.getManifest(repository, tag);

  const manifestData = {
    repository,
    tag,
    schema_version: manifest.schemaVersion,
    media_type: manifest.mediaType,
    config_digest: manifest.config.digest,
    config_size: manifest.config.size,
    config_media_type: manifest.config.mediaType,
    total_layers: manifest.layers.length,
    total_size: manifest.layers.reduce((sum, layer) => sum + layer.size, 0),
    layers: manifest.layers.map((layer, index) => ({
      layer_index: index + 1,
      digest: layer.digest,
      size: layer.size,
      media_type: layer.mediaType,
    })),
  };

  const result = {
    repository,
    tag,
    export_type: 'manifest-csv',
    format,
    metadata: {
      schema_version: manifest.schemaVersion,
      total_layers: manifest.layers.length,
      total_size: manifestData.total_size,
    },
  };

  switch (format) {
    case 'csv':
      // Create two CSV sections: manifest info and layers
      const manifestInfo = [{
        field: 'repository',
        value: repository,
      }, {
        field: 'tag',
        value: tag,
      }, {
        field: 'schema_version',
        value: manifest.schemaVersion,
      }, {
        field: 'total_layers',
        value: manifest.layers.length,
      }, {
        field: 'total_size',
        value: manifestData.total_size,
      }];

      const manifestCsv = ExportFormatter.toCSV(manifestInfo.map(info => ({ repository, ...info })));
      const layersCsv = ExportFormatter.toCSV(manifestData.layers.map(layer => ({ repository, ...layer })));
      
      return {
        ...result,
        exported_data: `# Manifest Information\n${manifestCsv}\n# Layer Information\n${layersCsv}`,
        usage: 'Manifest and layer data in CSV format - suitable for detailed analysis and reporting',
      };
    
    case 'json':
    default:
      return {
        ...result,
        exported_data: manifestData,
        usage: 'Complete manifest data in JSON format - suitable for programmatic processing',
      };
  }
}

/**
 * Flatten dependency tree to CSV-friendly format
 */
function flattenDependencyTree(node: any, parentPath: string = '', level: number = 0): any[] {
  const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
  
  const flatData = [{
    path: currentPath,
    name: node.name,
    version: node.version || '',
    size: node.size || 0,
    size_formatted: node.size ? formatBytes(node.size) : '',
    level: level,
    type: node.metadata?.type || '',
    has_children: node.children && node.children.length > 0,
  }];

  if (node.children) {
    node.children.forEach((child: any) => {
      flatData.push(...flattenDependencyTree(child, currentPath, level + 1));
    });
  }

  return flatData;
}

/**
 * Create tree view for layers
 */
function createLayerTreeView(layers: any[]): string {
  let treeView = 'Layer Structure:\n';
  
  layers.forEach((layer, index) => {
    const isLast = index === layers.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const sizeInfo = `(${layer.size_formatted})`;
    const instructionInfo = layer.instruction !== 'UNKNOWN' ? ` [${layer.instruction}]` : '';
    
    treeView += `${prefix}Layer ${layer.layer_index}${instructionInfo} ${sizeInfo}\n`;
    
    if (layer.created_by && layer.created_by !== 'Unknown') {
      const cmdPrefix = isLast ? '    ' : '│   ';
      const truncatedCmd = layer.created_by.length > 60 
        ? layer.created_by.substring(0, 57) + '...' 
        : layer.created_by;
      treeView += `${cmdPrefix}${truncatedCmd}\n`;
    }
  });
  
  return treeView;
}

/**
 * Categorize layers by size
 */
function categorizeLayersBySizes(layers: any[], totalSize: number): any {
  const categories = {
    large: layers.filter(l => l.size_bytes > totalSize * 0.1),
    medium: layers.filter(l => l.size_bytes > totalSize * 0.01 && l.size_bytes <= totalSize * 0.1),
    small: layers.filter(l => l.size_bytes <= totalSize * 0.01),
  };

  return {
    large: {
      count: categories.large.length,
      description: 'Layers larger than 10% of total image size',
    },
    medium: {
      count: categories.medium.length,
      description: 'Layers between 1% and 10% of total image size',
    },
    small: {
      count: categories.small.length,
      description: 'Layers smaller than 1% of total image size',
    },
  };
}

/**
 * Extract Docker instruction from created_by field
 */
function extractDockerInstruction(createdBy: string): string {
  const match = createdBy.match(/(?:#\(nop\)\s*)?(\w+)/);
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
