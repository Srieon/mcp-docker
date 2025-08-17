import { MCPTool } from './index.js';
import { AnalyzeLayersArgs, AnalyzeLayersArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Analyze Docker image layers for optimization insights
 */
export const analyzeLayersTool: MCPTool<AnalyzeLayersArgs> = {
  name: 'docker_analyze_layers',
  description: 'Analyze image layers to understand composition, identify optimization opportunities, and provide insights about the build process.',
  inputSchema: AnalyzeLayersArgsSchema,
  
  async execute(args: AnalyzeLayersArgs) {
    const { repository, tag } = args;

    // Get manifest and image config
    const [manifest, imageConfig] = await Promise.all([
      dockerHubClient.getManifest(repository, tag),
      dockerHubClient.getImageConfig(repository, tag),
    ]);

    // Calculate layer sizes and analyze
    const totalSize = manifest.layers.reduce((sum, layer) => sum + layer.size, 0);
    
    const layersWithHistory = manifest.layers.map((layer, index) => {
      const historyEntry = imageConfig.history[index];
      
      return {
        index,
        digest: layer.digest,
        size: layer.size,
        formatted_size: formatBytes(layer.size),
        media_type: layer.mediaType,
        percentage_of_total: ((layer.size / totalSize) * 100).toFixed(2),
        created_by: historyEntry?.created_by || 'Unknown',
        created: historyEntry?.created || null,
        comment: historyEntry?.comment || null,
        empty_layer: historyEntry?.empty_layer || false,
        instruction: extractDockerInstruction(historyEntry?.created_by || ''),
      };
    });

    // Analyze layer patterns
    const analysis = analyzeLayerPatterns(layersWithHistory);
    
    // Generate optimization suggestions
    const optimizations = generateOptimizations(layersWithHistory, totalSize);

    return {
      repository,
      tag,
      summary: {
        total_layers: manifest.layers.length,
        total_size: totalSize,
        formatted_total_size: formatBytes(totalSize),
        empty_layers: layersWithHistory.filter(l => l.empty_layer).length,
        data_layers: layersWithHistory.filter(l => !l.empty_layer).length,
      },
      layers: layersWithHistory,
      analysis: {
        ...analysis,
        base_image: detectBaseImage(imageConfig),
        architecture: imageConfig.architecture,
        os: imageConfig.os,
        environment: imageConfig.config?.Env || [],
        working_directory: imageConfig.config?.WorkingDir || '/',
        exposed_ports: Object.keys(imageConfig.config?.ExposedPorts || {}),
        labels: imageConfig.config?.Labels || {},
          },
      optimizations,
      layer_breakdown: {
        by_instruction: groupLayersByInstruction(layersWithHistory),
        by_size: categorizeLayersBySizes(layersWithHistory, totalSize),
        timeline: createLayerTimeline(layersWithHistory),
      },
    };
  },
};

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

/**
 * Extract Docker instruction from created_by field
 */
function extractDockerInstruction(createdBy: string): string {
  // Match patterns like "/bin/sh -c #(nop) COPY file" or "RUN apt-get update"
  const match = createdBy.match(/(?:#\(nop\)\s*)?(\w+)/);
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

/**
 * Analyze layer patterns and composition
 */
function analyzeLayerPatterns(layers: any[]): any {
  const instructions = layers.map(l => l.instruction);
  const instructionCounts = instructions.reduce((acc: any, inst) => {
    acc[inst] = (acc[inst] || 0) + 1;
    return acc;
  }, {});

  const sizes = layers.map(l => l.size).filter(s => s > 0);
  const avgSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;

  return {
    instruction_distribution: instructionCounts,
    most_common_instruction: Object.entries(instructionCounts).sort(([,a]: any, [,b]: any) => b - a)[0]?.[0] || 'UNKNOWN',
    layer_size_variance: {
      average: Math.round(avgSize),
      formatted_average: formatBytes(Math.round(avgSize)),
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      formatted_min: formatBytes(Math.min(...sizes)),
      formatted_max: formatBytes(Math.max(...sizes)),
    },
    empty_layer_ratio: ((layers.filter(l => l.empty_layer).length / layers.length) * 100).toFixed(1),
  };
}

/**
 * Detect likely base image from layer history
 */
function detectBaseImage(imageConfig: any): string {
  // Look at the first few non-empty layers for base image clues
  const earlyHistroy = imageConfig.history?.slice(0, 5) || [];
  
  for (const entry of earlyHistroy) {
    const createdBy = entry.created_by || '';
    
    // Common base image patterns
    if (createdBy.includes('FROM')) {
      const match = createdBy.match(/FROM\s+([^\s]+)/);
      if (match) return match[1];
    }
    
    // Alpine indicators
    if (createdBy.includes('alpine')) return 'alpine (detected)';
    
    // Ubuntu indicators
    if (createdBy.includes('ubuntu') || createdBy.includes('apt-get')) return 'ubuntu (detected)';
    
    // Debian indicators
    if (createdBy.includes('debian')) return 'debian (detected)';
    
    // CentOS/RHEL indicators
    if (createdBy.includes('yum') || createdBy.includes('centos')) return 'centos/rhel (detected)';
  }
  
  return 'unknown';
}

/**
 * Group layers by Docker instruction type
 */
function groupLayersByInstruction(layers: any[]): any {
  const groups: any = {};
  
  layers.forEach(layer => {
    const instruction = layer.instruction;
    if (!groups[instruction]) {
      groups[instruction] = {
        count: 0,
        total_size: 0,
        layers: [],
      };
    }
    
    groups[instruction].count++;
    groups[instruction].total_size += layer.size;
    groups[instruction].layers.push({
      index: layer.index,
      size: layer.size,
      formatted_size: layer.formatted_size,
    });
  });
  
  // Add formatted sizes and percentages
  const totalSize = layers.reduce((sum, l) => sum + l.size, 0);
  Object.keys(groups).forEach(instruction => {
    groups[instruction].formatted_total_size = formatBytes(groups[instruction].total_size);
    groups[instruction].percentage_of_total = ((groups[instruction].total_size / totalSize) * 100).toFixed(2);
  });
  
  return groups;
}

/**
 * Categorize layers by size ranges
 */
function categorizeLayersBySizes(layers: any[], totalSize: number): any {
  const categories = {
    large: { threshold: totalSize * 0.1, layers: [] as any[] },
    medium: { threshold: totalSize * 0.01, layers: [] as any[] },
    small: { threshold: 0, layers: [] as any[] },
  };
  
  layers.forEach(layer => {
    if (layer.size > categories.large.threshold) {
      categories.large.layers.push(layer);
    } else if (layer.size > categories.medium.threshold) {
      categories.medium.layers.push(layer);
    } else {
      categories.small.layers.push(layer);
    }
  });
  
  return {
    large: {
      description: 'Layers larger than 10% of total image size',
      count: categories.large.layers.length,
      total_size: categories.large.layers.reduce((sum, l) => sum + l.size, 0),
      formatted_total_size: formatBytes(categories.large.layers.reduce((sum, l) => sum + l.size, 0)),
      layers: categories.large.layers.map(l => ({ index: l.index, size: l.formatted_size, instruction: l.instruction })),
    },
    medium: {
      description: 'Layers between 1% and 10% of total image size',
      count: categories.medium.layers.length,
      total_size: categories.medium.layers.reduce((sum, l) => sum + l.size, 0),
      formatted_total_size: formatBytes(categories.medium.layers.reduce((sum, l) => sum + l.size, 0)),
      layers: categories.medium.layers.map(l => ({ index: l.index, size: l.formatted_size, instruction: l.instruction })),
    },
    small: {
      description: 'Layers smaller than 1% of total image size',
      count: categories.small.layers.length,
      total_size: categories.small.layers.reduce((sum, l) => sum + l.size, 0),
      formatted_total_size: formatBytes(categories.small.layers.reduce((sum, l) => sum + l.size, 0)),
      layers: categories.small.layers.map(l => ({ index: l.index, size: l.formatted_size, instruction: l.instruction })),
    },
  };
}

/**
 * Create a timeline of layer creation
 */
function createLayerTimeline(layers: any[]): any[] {
  return layers
    .filter(l => l.created)
    .map(l => ({
      index: l.index,
      created: l.created,
      instruction: l.instruction,
      size: l.formatted_size,
      relative_time: getRelativeTime(l.created),
    }))
    .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
}

/**
 * Generate optimization recommendations
 */
function generateOptimizations(layers: any[], totalSize: number): string[] {
  const optimizations: string[] = [];
  
  // Check for large layers
  const largeLayers = layers.filter(l => l.size > totalSize * 0.2);
  if (largeLayers.length > 0) {
    optimizations.push(`Optimize ${largeLayers.length} large layer(s): ${largeLayers.map(l => `Layer ${l.index} (${l.instruction})`).join(', ')}`);
  }
  
  // Check for many RUN instructions
  const runLayers = layers.filter(l => l.instruction === 'RUN');
  if (runLayers.length > 5) {
    optimizations.push(`Consider combining ${runLayers.length} RUN instructions to reduce layer count`);
  }
  
  // Check for COPY/ADD patterns
  const copyLayers = layers.filter(l => ['COPY', 'ADD'].includes(l.instruction));
  if (copyLayers.length > 3) {
    optimizations.push(`Consider consolidating ${copyLayers.length} COPY/ADD operations`);
  }
  
  // Check total size
  if (totalSize > 500 * 1024 * 1024) { // > 500MB
    optimizations.push('Consider using a smaller base image or multi-stage builds to reduce size');
  }
  
  // Check layer count
  if (layers.length > 20) {
    optimizations.push('High layer count may impact pull performance - consider layer consolidation');
  }
  
  if (optimizations.length === 0) {
    optimizations.push('Layer structure appears well-optimized');
  }
  
  return optimizations;
}

/**
 * Get relative time string
 */
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}
