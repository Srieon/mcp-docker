import { MCPTool } from './index.js';
import { EstimatePullSizeArgs, EstimatePullSizeArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Estimate the actual download size for pulling a Docker image (bonus tool)
 */
export const estimatePullSizeTool: MCPTool<EstimatePullSizeArgs> = {
  name: 'docker_estimate_pull_size',
  description: 'Calculate the estimated download size for pulling a Docker image, considering layer deduplication, compression, and existing cached layers. Useful for planning deployments and bandwidth requirements.',
  inputSchema: EstimatePullSizeArgsSchema,
  
  async execute(args: EstimatePullSizeArgs) {
    const { repository, tag, architecture } = args;

    // Get manifest and image configuration
    const [manifest] = await Promise.all([
      dockerHubClient.getManifest(repository, tag),
      dockerHubClient.getImageConfig(repository, tag),
    ]);

    // Get tag information for size details
    const tagsResponse = await dockerHubClient.listTags(repository, 100);
    const targetTag = tagsResponse.results.find(t => t.name === tag);
    
    if (!targetTag) {
      throw new Error(`Tag ${tag} not found for repository ${repository}`);
    }

    // Find architecture-specific image info
    const archImage = targetTag.images.find(img => img.architecture === architecture);
    
    // Calculate various size estimates
    const sizeAnalysis = calculateSizeEstimates(manifest, targetTag, archImage, architecture);
    
    // Estimate layer deduplication savings
    const deduplicationAnalysis = estimateLayerDeduplication(manifest.layers);
    
    // Calculate bandwidth and time estimates
    const downloadEstimates = calculateDownloadEstimates(sizeAnalysis);
    
    // Analyze layer sharing potential
    const layerSharingAnalysis = analyzeLayerSharing(manifest.layers, repository);

    return {
      repository,
      tag,
      architecture,
      size_breakdown: {
        manifest_size: sizeAnalysis.manifestSize,
        formatted_manifest_size: formatBytes(sizeAnalysis.manifestSize),
        compressed_size: sizeAnalysis.compressedSize,
        formatted_compressed_size: formatBytes(sizeAnalysis.compressedSize),
        uncompressed_size: sizeAnalysis.uncompressedSize,
        formatted_uncompressed_size: formatBytes(sizeAnalysis.uncompressedSize),
        architecture_specific_size: sizeAnalysis.architectureSpecificSize,
        formatted_arch_size: formatBytes(sizeAnalysis.architectureSpecificSize),
      },
      download_estimates: {
        best_case_scenario: {
          size: sizeAnalysis.bestCaseSize,
          formatted_size: formatBytes(sizeAnalysis.bestCaseSize),
          description: 'All layers already cached locally',
        },
        worst_case_scenario: {
          size: sizeAnalysis.worstCaseSize,
          formatted_size: formatBytes(sizeAnalysis.worstCaseSize),
          description: 'No layers cached, fresh download',
        },
        typical_scenario: {
          size: sizeAnalysis.typicalSize,
          formatted_size: formatBytes(sizeAnalysis.typicalSize),
          description: 'Some common base layers cached',
        },
        first_time_pull: {
          size: sizeAnalysis.firstTimePull,
          formatted_size: formatBytes(sizeAnalysis.firstTimePull),
          description: 'Complete download with no existing layers',
        },
      },
      layer_analysis: {
        total_layers: manifest.layers.length,
        unique_layers: deduplicationAnalysis.uniqueLayers,
        potentially_cached_layers: deduplicationAnalysis.potentiallyCachedLayers,
        layer_sizes: manifest.layers.map((layer, index) => ({
          index,
          digest: layer.digest.slice(0, 16) + '...',
          size: layer.size,
          formatted_size: formatBytes(layer.size),
          media_type: layer.mediaType,
          cache_likelihood: estimateLayerCacheLikelihood(layer, index),
        })),
        largest_layers: manifest.layers
          .map((layer, index) => ({ ...layer, index }))
          .sort((a, b) => b.size - a.size)
          .slice(0, 5)
          .map(layer => ({
            index: layer.index,
            size: layer.size,
            formatted_size: formatBytes(layer.size),
            percentage_of_total: ((layer.size / sizeAnalysis.uncompressedSize) * 100).toFixed(2) + '%',
          })),
      },
      bandwidth_requirements: downloadEstimates,
      optimization_insights: {
        compression_ratio: sizeAnalysis.compressionRatio,
        deduplication_savings: deduplicationAnalysis.potentialSavings,
        formatted_deduplication_savings: formatBytes(deduplicationAnalysis.potentialSavings),
        layer_sharing_potential: layerSharingAnalysis,
        recommendations: generateOptimizationRecommendations(sizeAnalysis, deduplicationAnalysis, manifest),
      },
      comparison_metrics: {
        size_category: categorizeSizeForArchitecture(sizeAnalysis.architectureSpecificSize, architecture),
        relative_size: compareToTypicalSizes(sizeAnalysis.architectureSpecificSize, repository),
        efficiency_score: calculateEfficiencyScore(sizeAnalysis, manifest.layers.length),
      },
      pull_strategy_recommendations: generatePullStrategyRecommendations(sizeAnalysis, deduplicationAnalysis),
    };
  },
};

/**
 * Calculate various size estimates for the image
 */
function calculateSizeEstimates(manifest: any, _targetTag: any, archImage: any, _architecture: string): any {
  // Basic sizes from manifest
  const manifestSize = manifest.layers.reduce((sum: number, layer: any) => sum + layer.size, 0);
  
  // Architecture-specific size
  const architectureSpecificSize = archImage ? archImage.size : manifestSize;
  
  // Estimate compression (Docker typically compresses at ~70% of original size)
  const compressionRatio = 0.7;
  const compressedSize = Math.round(manifestSize * compressionRatio);
  
  // Size estimates for different scenarios
  const bestCaseSize = Math.round(manifestSize * 0.1); // Assume 90% cached
  const worstCaseSize = compressedSize;
  const typicalSize = Math.round(compressedSize * 0.6); // Assume 40% of layers cached
  const firstTimePull = compressedSize;

  return {
    manifestSize,
    compressedSize,
    uncompressedSize: manifestSize,
    architectureSpecificSize,
    bestCaseSize,
    worstCaseSize,
    typicalSize,
    firstTimePull,
    compressionRatio,
  };
}

/**
 * Estimate layer deduplication potential
 */
function estimateLayerDeduplication(layers: any[]): any {
  const uniqueDigests = new Set(layers.map(layer => layer.digest));
  const uniqueLayers = uniqueDigests.size;
  const totalLayers = layers.length;
  
  // Estimate common base layers (first few layers are often from base images)
  const potentiallyCachedLayers = Math.min(3, Math.floor(layers.length * 0.3));
  const cachedLayerSize = layers.slice(0, potentiallyCachedLayers)
    .reduce((sum, layer) => sum + layer.size, 0);
  
  return {
    uniqueLayers,
    totalLayers,
    duplicatedLayers: totalLayers - uniqueLayers,
    potentiallyCachedLayers,
    potentialSavings: cachedLayerSize,
    deduplicationRatio: uniqueLayers / totalLayers,
  };
}

/**
 * Calculate download time and bandwidth estimates
 */
function calculateDownloadEstimates(sizeAnalysis: any): any {
  const bandwidthSpeeds = [
    { name: 'Slow (1 Mbps)', speed: 125000 }, // bytes per second
    { name: 'Broadband (10 Mbps)', speed: 1250000 },
    { name: 'Fast (100 Mbps)', speed: 12500000 },
    { name: 'Fiber (1 Gbps)', speed: 125000000 },
    { name: 'Enterprise (10 Gbps)', speed: 1250000000 },
  ];

  const scenarios = [
    { name: 'Best Case', size: sizeAnalysis.bestCaseSize },
    { name: 'Typical', size: sizeAnalysis.typicalSize },
    { name: 'Worst Case', size: sizeAnalysis.worstCaseSize },
  ];

  const estimates = scenarios.map(scenario => ({
    scenario: scenario.name,
    size: scenario.size,
    formatted_size: formatBytes(scenario.size),
    download_times: bandwidthSpeeds.map(bandwidth => ({
      connection: bandwidth.name,
      time_seconds: Math.ceil(scenario.size / bandwidth.speed),
      formatted_time: formatDuration(Math.ceil(scenario.size / bandwidth.speed)),
    })),
  }));

  return {
    size_scenarios: estimates,
    bandwidth_recommendations: generateBandwidthRecommendations(sizeAnalysis),
  };
}

/**
 * Estimate layer cache likelihood
 */
function estimateLayerCacheLikelihood(layer: any, index: number): string {
  // Base layers (first few) are more likely to be cached
  if (index < 3) return 'High (likely base image layer)';
  
  // Very small layers are often metadata and may be cached
  if (layer.size < 1024 * 1024) return 'Medium (small metadata layer)';
  
  // Large application layers are less likely to be cached
  if (layer.size > 100 * 1024 * 1024) return 'Low (large application layer)';
  
  return 'Medium (application layer)';
}

/**
 * Analyze layer sharing potential
 */
function analyzeLayerSharing(layers: any[], repository: string): any {
  // Estimate sharing potential based on layer characteristics
  const baseLayers = layers.slice(0, Math.min(5, Math.floor(layers.length * 0.4)));
  const appLayers = layers.slice(baseLayers.length);
  
  const baseLayerSize = baseLayers.reduce((sum, layer) => sum + layer.size, 0);
  const appLayerSize = appLayers.reduce((sum, layer) => sum + layer.size, 0);
  
  return {
    base_layers: {
      count: baseLayers.length,
      size: baseLayerSize,
      formatted_size: formatBytes(baseLayerSize),
      sharing_potential: 'High (common base image layers)',
    },
    application_layers: {
      count: appLayers.length,
      size: appLayerSize,
      formatted_size: formatBytes(appLayerSize),
      sharing_potential: repository.includes('official') ? 'Medium' : 'Low',
    },
    overall_sharing_score: calculateSharingScore(baseLayers.length, appLayers.length, repository),
  };
}

/**
 * Calculate layer sharing score
 */
function calculateSharingScore(baseLayers: number, appLayers: number, repository: string): string {
  let score = 0;
  
  // More base layers = better sharing
  score += Math.min(baseLayers * 2, 10);
  
  // Official images often have better sharing
  if (repository.includes('library/') || repository.includes('official')) score += 3;
  
  // Fewer app layers = better sharing potential
  if (appLayers < 5) score += 2;
  
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Fair';
  return 'Poor';
}

/**
 * Categorize image size for architecture
 */
function categorizeSizeForArchitecture(size: number, architecture: string): string {
  // Adjust thresholds based on architecture
  const multiplier = architecture === 'arm64' ? 1.1 : 1.0; // ARM images might be slightly larger
  
  const thresholds = {
    tiny: 10 * 1024 * 1024 * multiplier,      // 10MB
    small: 50 * 1024 * 1024 * multiplier,     // 50MB
    medium: 200 * 1024 * 1024 * multiplier,   // 200MB
    large: 500 * 1024 * 1024 * multiplier,    // 500MB
    huge: 1024 * 1024 * 1024 * multiplier,    // 1GB
  };

  if (size < thresholds.tiny) return 'Tiny';
  if (size < thresholds.small) return 'Small';
  if (size < thresholds.medium) return 'Medium';
  if (size < thresholds.large) return 'Large';
  if (size < thresholds.huge) return 'Very Large';
  return 'Huge';
}

/**
 * Compare to typical sizes for similar images
 */
function compareToTypicalSizes(size: number, repository: string): string {
  // Rough estimates based on common image types
  const typicalSizes: { [key: string]: number } = {
    alpine: 5 * 1024 * 1024,        // ~5MB
    nginx: 25 * 1024 * 1024,        // ~25MB  
    node: 300 * 1024 * 1024,        // ~300MB
    python: 200 * 1024 * 1024,      // ~200MB
    ubuntu: 80 * 1024 * 1024,       // ~80MB
    postgres: 150 * 1024 * 1024,    // ~150MB
  };

  // Find matching base image type
  for (const [type, typicalSize] of Object.entries(typicalSizes)) {
    if (repository.toLowerCase().includes(type)) {
      const ratio = size / typicalSize;
      if (ratio < 0.5) return `Much smaller than typical ${type} image`;
      if (ratio < 0.8) return `Smaller than typical ${type} image`;
      if (ratio < 1.2) return `Similar to typical ${type} image`;
      if (ratio < 2.0) return `Larger than typical ${type} image`;
      return `Much larger than typical ${type} image`;
    }
  }

  // Generic comparison
  if (size < 50 * 1024 * 1024) return 'Compact for containerized application';
  if (size < 200 * 1024 * 1024) return 'Average size for containerized application';
  if (size < 500 * 1024 * 1024) return 'Large for containerized application';
  return 'Very large for containerized application';
}

/**
 * Calculate efficiency score
 */
function calculateEfficiencyScore(sizeAnalysis: any, layerCount: number): number {
  let score = 100;
  
  // Penalize large sizes
  const sizeMB = sizeAnalysis.architectureSpecificSize / (1024 * 1024);
  if (sizeMB > 500) score -= 20;
  else if (sizeMB > 200) score -= 10;
  else if (sizeMB > 100) score -= 5;
  
  // Penalize many layers
  if (layerCount > 20) score -= 15;
  else if (layerCount > 15) score -= 10;
  else if (layerCount > 10) score -= 5;
  
  // Reward good compression
  if (sizeAnalysis.compressionRatio < 0.6) score += 10;
  else if (sizeAnalysis.compressionRatio < 0.7) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(
  sizeAnalysis: any, 
  deduplicationAnalysis: any, 
  manifest: any
): string[] {
  const recommendations: string[] = [];
  
  // Size-based recommendations
  const sizeMB = sizeAnalysis.architectureSpecificSize / (1024 * 1024);
  if (sizeMB > 500) {
    recommendations.push('Image is very large (>500MB) - consider using multi-stage builds to reduce size');
  } else if (sizeMB > 200) {
    recommendations.push('Image is large (>200MB) - review if all components are necessary');
  }
  
  // Layer-based recommendations  
  if (manifest.layers.length > 15) {
    recommendations.push('Many layers detected - consider consolidating RUN commands to reduce layer count');
  }
  
  // Deduplication recommendations
  if (deduplicationAnalysis.deduplicationRatio < 0.8) {
    recommendations.push('Low layer deduplication - ensure you\'re using common base images');
  }
  
  // Compression recommendations
  if (sizeAnalysis.compressionRatio > 0.8) {
    recommendations.push('Poor compression ratio - large files may benefit from pre-compression');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Image size and structure appear well-optimized');
  }
  
  return recommendations;
}

/**
 * Generate bandwidth recommendations
 */
function generateBandwidthRecommendations(sizeAnalysis: any): string[] {
  const recommendations: string[] = [];
  const sizeMB = sizeAnalysis.typicalSize / (1024 * 1024);
  
  if (sizeMB > 500) {
    recommendations.push('For images >500MB, consider dedicated high-bandwidth connections for deployment');
    recommendations.push('Implement image layer caching strategies in your deployment pipeline');
  } else if (sizeMB > 100) {
    recommendations.push('Broadband connection (10+ Mbps) recommended for reasonable pull times');
  } else {
    recommendations.push('Image size is reasonable for most network connections');
  }
  
  return recommendations;
}

/**
 * Generate pull strategy recommendations
 */
function generatePullStrategyRecommendations(
  sizeAnalysis: any, 
  deduplicationAnalysis: any
): string[] {
  const recommendations: string[] = [];
  
  if (deduplicationAnalysis.potentiallyCachedLayers > 0) {
    recommendations.push('Pre-pull common base images to reduce download time for subsequent pulls');
  }
  
  const sizeMB = sizeAnalysis.worstCaseSize / (1024 * 1024);
  if (sizeMB > 1000) {
    recommendations.push('Consider implementing image streaming or lazy loading for very large images');
    recommendations.push('Use image registries with good CDN coverage for global deployments');
  }
  
  if (sizeAnalysis.compressionRatio < 0.7) {
    recommendations.push('Good compression detected - network bandwidth is the primary factor');
  }
  
  recommendations.push('Use `docker pull` with `--quiet` flag to reduce output overhead during automated deployments');
  
  return recommendations;
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
 * Format duration in seconds to readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours}h ${minutes}m ${secs}s`;
}
