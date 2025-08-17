import { MCPTool } from './index.js';
import { GetImageHistoryArgs, GetImageHistoryArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Get detailed build history and layer information for a Docker image (bonus tool)
 */
export const getImageHistoryTool: MCPTool<GetImageHistoryArgs> = {
  name: 'docker_get_image_history',
  description: 'Retrieve detailed build history, layer creation timeline, and Dockerfile command reconstruction for a Docker image to understand its construction process.',
  inputSchema: GetImageHistoryArgsSchema,
  
  async execute(args: GetImageHistoryArgs) {
    const { repository, tag } = args;

    // Get image configuration which contains history
    const imageConfig = await dockerHubClient.getImageConfig(repository, tag);
    
    // Get manifest for layer information
    const manifest = await dockerHubClient.getManifest(repository, tag);
    
    // Process and analyze the history
    const processedHistory = processImageHistory(imageConfig.history || [], manifest.layers);
    const buildAnalysis = analyzeBuildProcess(processedHistory);
    const timeline = createBuildTimeline(processedHistory);
    const dockerfileReconstruction = reconstructDockerfile(processedHistory);
    
    return {
      repository,
      tag,
      image_info: {
        architecture: imageConfig.architecture,
        os: imageConfig.os,
        total_layers: manifest.layers.length,
        total_history_entries: imageConfig.history?.length || 0,
        root_filesystem_type: imageConfig.rootfs?.type || 'unknown',
      },
      build_history: {
        total_steps: processedHistory.length,
        total_size: processedHistory.reduce((sum, step) => sum + (step.size || 0), 0),
        formatted_total_size: formatBytes(processedHistory.reduce((sum, step) => sum + (step.size || 0), 0)),
        build_duration_estimate: estimateBuildDuration(processedHistory),
        empty_layers: processedHistory.filter(step => step.empty_layer).length,
        data_layers: processedHistory.filter(step => !step.empty_layer).length,
      },
      detailed_history: processedHistory.map((step, index) => ({
        step: index + 1,
        created: step.created,
        created_relative: getRelativeTime(step.created),
        instruction: step.instruction,
        command: step.created_by,
        size: step.size || 0,
        formatted_size: step.size ? formatBytes(step.size) : '0 B',
        empty_layer: step.empty_layer,
        layer_digest: step.layer_digest,
        comment: step.comment,
      })),
      build_analysis: buildAnalysis,
      timeline: timeline,
      dockerfile_reconstruction: dockerfileReconstruction,
      optimization_insights: generateOptimizationInsights(processedHistory),
      layer_efficiency: analyzeLayerEfficiency(processedHistory),
    };
  },
};

/**
 * Process raw image history and correlate with manifest layers
 */
function processImageHistory(history: any[], manifestLayers: any[]): any[] {
  let layerIndex = 0;
  
  return history.map((entry, _historyIndex) => {
    const step = {
      created: entry.created,
      created_by: entry.created_by || '',
      comment: entry.comment,
      empty_layer: entry.empty_layer || false,
      size: 0,
      layer_digest: null as string | null,
      instruction: extractDockerInstruction(entry.created_by || ''),
    };
    
    // If this is not an empty layer, associate it with a manifest layer
    if (!step.empty_layer && layerIndex < manifestLayers.length) {
      const layer = manifestLayers[layerIndex];
      step.size = layer.size;
      step.layer_digest = layer.digest;
      layerIndex++;
    }
    
    return step;
  });
}

/**
 * Extract Docker instruction from created_by field
 */
function extractDockerInstruction(createdBy: string): string {
  // Handle nop instructions (metadata-only)
  if (createdBy.includes('#(nop)')) {
    const match = createdBy.match(/#\(nop\)\s*(.+)/);
    if (match) {
      const instruction = match[1].trim();
      const instMatch = instruction.match(/^(\w+)/);
      return instMatch ? instMatch[1].toUpperCase() : 'METADATA';
    }
    return 'METADATA';
  }
  
  // Handle shell commands (usually RUN instructions)
  if (createdBy.startsWith('/bin/sh -c')) {
    return 'RUN';
  }
  
  // Try to extract direct instruction
  const directMatch = createdBy.match(/^(\w+)\s/);
  if (directMatch) {
    return directMatch[1].toUpperCase();
  }
  
  return 'UNKNOWN';
}

/**
 * Analyze the build process for patterns and insights
 */
function analyzeBuildProcess(history: any[]): any {
  const instructions = history.map(step => step.instruction);
  const instructionCounts = instructions.reduce((acc: any, inst) => {
    acc[inst] = (acc[inst] || 0) + 1;
    return acc;
  }, {});
  
  // Detect base image
  const baseImage = detectBaseImage(history);
  
  // Analyze build patterns
  const buildPatterns = detectBuildPatterns(history);
  
  // Calculate layer impact
  const layerImpact = calculateLayerImpact(history);
  
  return {
    base_image: baseImage,
    instruction_distribution: instructionCounts,
    most_used_instruction: Object.entries(instructionCounts)
      .sort(([, a]: any, [, b]: any) => b - a)[0]?.[0] || 'UNKNOWN',
    build_patterns: buildPatterns,
    layer_impact: layerImpact,
    complexity_indicators: {
      total_run_commands: instructionCounts.RUN || 0,
      copy_operations: (instructionCounts.COPY || 0) + (instructionCounts.ADD || 0),
      metadata_steps: instructionCounts.METADATA || 0,
      build_complexity: calculateBuildComplexity(instructionCounts),
    },
  };
}

/**
 * Detect base image from history
 */
function detectBaseImage(history: any[]): any {
  // Look at the first few entries for FROM instruction
  for (const step of history.slice(0, 5)) {
    const createdBy = step.created_by;
    
    if (createdBy.includes('FROM')) {
      const match = createdBy.match(/FROM\s+([^\s]+)/);
      if (match) {
        return {
          name: match[1],
          detected_from: 'FROM instruction',
          confidence: 'high',
        };
      }
    }
    
    // Detect from common base image indicators
    const indicators = [
      { pattern: /alpine/i, name: 'Alpine Linux' },
      { pattern: /ubuntu/i, name: 'Ubuntu' },
      { pattern: /debian/i, name: 'Debian' },
      { pattern: /centos/i, name: 'CentOS' },
      { pattern: /node/i, name: 'Node.js' },
      { pattern: /python/i, name: 'Python' },
      { pattern: /nginx/i, name: 'Nginx' },
    ];
    
    for (const indicator of indicators) {
      if (indicator.pattern.test(createdBy)) {
        return {
          name: indicator.name + ' (detected)',
          detected_from: 'command pattern analysis',
          confidence: 'medium',
        };
      }
    }
  }
  
  return {
    name: 'Unknown',
    detected_from: 'unable to determine',
    confidence: 'low',
  };
}

/**
 * Detect build patterns and best practices
 */
function detectBuildPatterns(history: any[]): any {
  const patterns: any = {
    multi_stage_build: false,
    cache_optimization: false,
    layer_consolidation: false,
    package_manager_usage: [],
    security_practices: [],
  };
  
  let fromCount = 0;
  let consecutiveRuns = 0;
  
  for (const step of history) {
    const createdBy = step.created_by.toLowerCase();
    
    // Multi-stage build detection
    if (step.instruction === 'FROM') fromCount++;
    
    // Package manager detection
    if (createdBy.includes('apt-get')) patterns.package_manager_usage.push('apt-get');
    if (createdBy.includes('yum')) patterns.package_manager_usage.push('yum');
    if (createdBy.includes('apk')) patterns.package_manager_usage.push('apk');
    if (createdBy.includes('npm install')) patterns.package_manager_usage.push('npm');
    if (createdBy.includes('pip install')) patterns.package_manager_usage.push('pip');
    
    // Layer consolidation detection
    if (step.instruction === 'RUN') {
      consecutiveRuns++;
      if (createdBy.includes('&&')) {
        patterns.layer_consolidation = true;
      }
    } else {
      consecutiveRuns = 0;
    }
    
    // Security practices detection
    if (createdBy.includes('--no-cache')) patterns.security_practices.push('no-cache flag usage');
    if (createdBy.includes('rm -rf')) patterns.security_practices.push('cleanup operations');
    if (createdBy.includes('useradd') || createdBy.includes('adduser')) patterns.security_practices.push('non-root user creation');
  }
  
  patterns.multi_stage_build = fromCount > 1;
  patterns.excessive_run_commands = consecutiveRuns > 3;
  patterns.package_manager_usage = [...new Set(patterns.package_manager_usage)];
  patterns.security_practices = [...new Set(patterns.security_practices)];
  
  return patterns;
}

/**
 * Calculate layer impact analysis
 */
function calculateLayerImpact(history: any[]): any {
  const dataLayers = history.filter(step => !step.empty_layer);
  const totalSize = dataLayers.reduce((sum, step) => sum + step.size, 0);
  
  if (dataLayers.length === 0) {
    return {
      largest_layer: null,
      smallest_layer: null,
      size_distribution: 'No data layers found',
    };
  }
  
  const sortedBySize = [...dataLayers].sort((a, b) => b.size - a.size);
  const largest = sortedBySize[0];
  const smallest = sortedBySize[sortedBySize.length - 1];
  
  return {
    largest_layer: {
      instruction: largest.instruction,
      size: largest.size,
      formatted_size: formatBytes(largest.size),
      percentage_of_total: ((largest.size / totalSize) * 100).toFixed(2) + '%',
      command_snippet: largest.created_by.slice(0, 100) + (largest.created_by.length > 100 ? '...' : ''),
    },
    smallest_layer: {
      instruction: smallest.instruction,
      size: smallest.size,
      formatted_size: formatBytes(smallest.size),
      percentage_of_total: ((smallest.size / totalSize) * 100).toFixed(2) + '%',
    },
    size_distribution: categorizeLayerSizes(dataLayers, totalSize),
  };
}

/**
 * Categorize layer sizes for analysis
 */
function categorizeLayerSizes(layers: any[], totalSize: number): any {
  const large = layers.filter(l => l.size > totalSize * 0.1);
  const medium = layers.filter(l => l.size > totalSize * 0.01 && l.size <= totalSize * 0.1);
  const small = layers.filter(l => l.size <= totalSize * 0.01);
  
  return {
    large_layers: { count: large.length, description: 'Layers > 10% of total size' },
    medium_layers: { count: medium.length, description: 'Layers 1-10% of total size' },
    small_layers: { count: small.length, description: 'Layers < 1% of total size' },
  };
}

/**
 * Calculate build complexity score
 */
function calculateBuildComplexity(instructionCounts: any): string {
  let score = 0;
  score += (instructionCounts.RUN || 0) * 2;
  score += (instructionCounts.COPY || 0) * 1;
  score += (instructionCounts.ADD || 0) * 1;
  score += (instructionCounts.ENV || 0) * 0.5;
  
  if (score < 5) return 'Low';
  if (score < 15) return 'Medium';
  if (score < 30) return 'High';
  return 'Very High';
}

/**
 * Create build timeline
 */
function createBuildTimeline(history: any[]): any {
  const timeline = history
    .filter(step => step.created)
    .map((step, index) => ({
      step: index + 1,
      timestamp: step.created,
      relative_time: getRelativeTime(step.created),
      instruction: step.instruction,
      size_added: step.size || 0,
      formatted_size_added: step.size ? formatBytes(step.size) : '0 B',
      cumulative_size: history.slice(0, index + 1).reduce((sum, s) => sum + (s.size || 0), 0),
    }));
  
  // Calculate time gaps between steps
  for (let i = 1; i < timeline.length; i++) {
    const prev = new Date(timeline[i - 1].timestamp).getTime();
    const current = new Date(timeline[i].timestamp).getTime();
    (timeline[i] as any).time_since_previous = Math.round((current - prev) / 1000); // seconds
  }
  
  return {
    total_steps: timeline.length,
    first_step: timeline[0]?.timestamp || null,
    last_step: timeline[timeline.length - 1]?.timestamp || null,
    build_duration: timeline.length >= 2 
      ? Math.round((new Date(timeline[timeline.length - 1].timestamp).getTime() - new Date(timeline[0].timestamp).getTime()) / 1000)
      : 0,
    steps: timeline,
  };
}

/**
 * Reconstruct Dockerfile from history
 */
function reconstructDockerfile(history: any[]): any {
  const dockerfileLines: string[] = [];
  let confidence = 'medium';
  
  dockerfileLines.push('# Reconstructed Dockerfile from image history');
  dockerfileLines.push('# This is an approximation and may not match the original exactly');
  dockerfileLines.push('');
  
  for (const step of history) {
    if (step.instruction === 'METADATA' && step.created_by.includes('#(nop)')) {
      // Extract metadata instructions
      const match = step.created_by.match(/#\(nop\)\s*(.+)/);
      if (match) {
        dockerfileLines.push(match[1].trim());
      }
    } else if (step.instruction === 'RUN' && !step.empty_layer) {
      // Extract RUN commands
      const command = step.created_by.replace(/^\/bin\/sh -c\s*/, '');
      if (command && command !== step.created_by) {
        dockerfileLines.push(`RUN ${command}`);
      }
    } else if (step.created_by && !step.created_by.includes('#(nop)')) {
      // For other instructions, try to format them
      dockerfileLines.push(`# ${step.created_by}`);
    }
  }
  
  // If reconstruction seems poor, lower confidence
  if (dockerfileLines.filter(line => !line.startsWith('#')).length < history.length / 2) {
    confidence = 'low';
  }
  
  return {
    dockerfile: dockerfileLines.join('\n'),
    confidence,
    total_lines: dockerfileLines.length,
    instruction_lines: dockerfileLines.filter(line => !line.startsWith('#')).length,
    notes: [
      'This reconstruction is based on image history and may not be identical to the original Dockerfile',
      'Some build context and comments from the original Dockerfile are not preserved',
      'Multi-stage build details may be approximated',
    ],
  };
}

/**
 * Estimate build duration
 */
function estimateBuildDuration(history: any[]): string {
  const timestamps = history.filter(step => step.created).map(step => new Date(step.created).getTime());
  
  if (timestamps.length < 2) {
    return 'Unable to estimate';
  }
  
  const duration = (Math.max(...timestamps) - Math.min(...timestamps)) / 1000; // seconds
  
  if (duration < 60) return `${Math.round(duration)} seconds`;
  if (duration < 3600) return `${Math.round(duration / 60)} minutes`;
  return `${(duration / 3600).toFixed(1)} hours`;
}

/**
 * Generate optimization insights
 */
function generateOptimizationInsights(history: any[]): string[] {
  const insights: string[] = [];
  
  const runSteps = history.filter(step => step.instruction === 'RUN');
  if (runSteps.length > 10) {
    insights.push(`High number of RUN instructions (${runSteps.length}) - consider consolidating to reduce layers`);
  }
  
  const largeSteps = history.filter(step => step.size > 50 * 1024 * 1024); // > 50MB
  if (largeSteps.length > 0) {
    insights.push(`${largeSteps.length} layers are larger than 50MB - investigate for optimization opportunities`);
  }
  
  const emptyLayers = history.filter(step => step.empty_layer);
  if (emptyLayers.length > 5) {
    insights.push(`${emptyLayers.length} empty layers detected - these are metadata-only layers`);
  }
  
  // Check for cache-busting patterns
  const cacheOptimization = history.some(step => 
    step.created_by.includes('--no-cache') || 
    step.created_by.includes('rm -rf')
  );
  if (cacheOptimization) {
    insights.push('Cache optimization patterns detected in build process');
  }
  
  if (insights.length === 0) {
    insights.push('Build history appears reasonably optimized');
  }
  
  return insights;
}

/**
 * Analyze layer efficiency
 */
function analyzeLayerEfficiency(history: any[]): any {
  const dataLayers = history.filter(step => !step.empty_layer && step.size > 0);
  const totalSize = dataLayers.reduce((sum, step) => sum + step.size, 0);
  
  return {
    efficiency_score: calculateEfficiencyScore(history),
    layer_utilization: {
      data_layers: dataLayers.length,
      empty_layers: history.filter(step => step.empty_layer).length,
      utilization_ratio: dataLayers.length / history.length,
    },
    size_efficiency: {
      average_layer_size: dataLayers.length > 0 ? Math.round(totalSize / dataLayers.length) : 0,
      size_variance: calculateSizeVariance(dataLayers),
      largest_to_smallest_ratio: dataLayers.length > 1 ? Math.max(...dataLayers.map(l => l.size)) / Math.min(...dataLayers.map(l => l.size)) : 1,
    },
  };
}

/**
 * Calculate efficiency score
 */
function calculateEfficiencyScore(history: any[]): number {
  let score = 100;
  
  const runCount = history.filter(step => step.instruction === 'RUN').length;
  if (runCount > 10) score -= (runCount - 10) * 2;
  
  const emptyLayerRatio = history.filter(step => step.empty_layer).length / history.length;
  if (emptyLayerRatio > 0.5) score -= 20;
  
  return Math.max(0, score);
}

/**
 * Calculate size variance
 */
function calculateSizeVariance(layers: any[]): string {
  if (layers.length < 2) return 'N/A';
  
  const sizes = layers.map(l => l.size);
  const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / mean) * 100;
  
  if (coefficientOfVariation < 50) return 'Low (consistent layer sizes)';
  if (coefficientOfVariation < 100) return 'Medium (moderate variation)';
  return 'High (significant size differences)';
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
