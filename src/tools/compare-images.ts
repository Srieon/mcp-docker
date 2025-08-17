import { MCPTool } from './index.js';
import { CompareImagesArgs, CompareImagesArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Compare two Docker images for differences in size, layers, and composition
 */
export const compareImagesTool: MCPTool<CompareImagesArgs> = {
  name: 'docker_compare_images',
  description: 'Compare two Docker images to analyze differences in layers, sizes, base images, and provide optimization recommendations.',
  inputSchema: CompareImagesArgsSchema,
  
  async execute(args: CompareImagesArgs) {
    const { repository1, tag1, repository2, tag2 } = args;

    // Get manifests and configs for both images
    const [manifest1, manifest2, config1, config2] = await Promise.all([
      dockerHubClient.getManifest(repository1, tag1),
      dockerHubClient.getManifest(repository2, tag2),
      dockerHubClient.getImageConfig(repository1, tag1),
      dockerHubClient.getImageConfig(repository2, tag2),
    ]);

    // Calculate sizes
    const size1 = manifest1.layers.reduce((sum, layer) => sum + layer.size, 0);
    const size2 = manifest2.layers.reduce((sum, layer) => sum + layer.size, 0);
    const sizeDifference = size2 - size1;
    const sizeDifferencePercentage = size1 > 0 ? ((sizeDifference / size1) * 100) : 0;

    // Analyze layers
    const layerAnalysis = compareLayerStructure(manifest1, manifest2);
    
    // Compare configurations
    const configComparison = compareConfigurations(config1, config2);
    
    // Detect base images
    const baseImage1 = detectBaseImage(config1);
    const baseImage2 = detectBaseImage(config2);
    
    // Generate recommendations
    const recommendations = generateComparisonRecommendations(
      { manifest: manifest1, config: config1, size: size1 },
      { manifest: manifest2, config: config2, size: size2 },
      layerAnalysis
    );

    return {
      comparison_summary: {
        image1: {
          repository: repository1,
          tag: tag1,
          size: size1,
          formatted_size: formatBytes(size1),
          layers: manifest1.layers.length,
          base_image: baseImage1,
        },
        image2: {
          repository: repository2,
          tag: tag2,
          size: size2,
          formatted_size: formatBytes(size2),
          layers: manifest2.layers.length,
          base_image: baseImage2,
        },
        differences: {
          size_difference: sizeDifference,
          formatted_size_difference: formatBytes(Math.abs(sizeDifference)),
          size_difference_percentage: parseFloat(sizeDifferencePercentage.toFixed(2)),
          layer_count_difference: manifest2.layers.length - manifest1.layers.length,
          same_base_image: baseImage1 === baseImage2,
          winner: sizeDifference < 0 ? 'image1_smaller' : sizeDifference > 0 ? 'image2_smaller' : 'same_size',
        },
      },
      layer_analysis: layerAnalysis,
      configuration_differences: configComparison,
      shared_characteristics: {
        architecture: config1.architecture === config2.architecture ? config1.architecture : 'different',
        os: config1.os === config2.os ? config1.os : 'different',
        same_base_image: baseImage1 === baseImage2,
        common_layers: layerAnalysis.common_layers,
        total_unique_layers: layerAnalysis.unique_to_image1 + layerAnalysis.unique_to_image2,
      },
      recommendations,
      detailed_breakdown: {
        image1_unique_layers: analyzeUniqueLayersForImage(manifest1, config1, 1),
        image2_unique_layers: analyzeUniqueLayersForImage(manifest2, config2, 2),
        common_layer_analysis: analyzeCommonLayers(manifest1, manifest2),
      },
    };
  },
};

/**
 * Compare layer structures between two images
 */
function compareLayerStructure(manifest1: any, manifest2: any): any {
  const layers1 = manifest1.layers.map((l: any) => l.digest);
  const layers2 = manifest2.layers.map((l: any) => l.digest);
  
  const commonLayers = layers1.filter((digest: string) => layers2.includes(digest));
  const uniqueToImage1 = layers1.filter((digest: string) => !layers2.includes(digest));
  const uniqueToImage2 = layers2.filter((digest: string) => !layers1.includes(digest));
  
  // Calculate size impact
  const commonLayerSize = manifest1.layers
    .filter((l: any) => commonLayers.includes(l.digest))
    .reduce((sum: number, l: any) => sum + l.size, 0);
    
  const uniqueSize1 = manifest1.layers
    .filter((l: any) => uniqueToImage1.includes(l.digest))
    .reduce((sum: number, l: any) => sum + l.size, 0);
    
  const uniqueSize2 = manifest2.layers
    .filter((l: any) => uniqueToImage2.includes(l.digest))
    .reduce((sum: number, l: any) => sum + l.size, 0);

  return {
    total_layers_image1: layers1.length,
    total_layers_image2: layers2.length,
    common_layers: commonLayers.length,
    unique_to_image1: uniqueToImage1.length,
    unique_to_image2: uniqueToImage2.length,
    layer_similarity_percentage: ((commonLayers.length / Math.max(layers1.length, layers2.length)) * 100).toFixed(2),
    size_breakdown: {
      common_layer_size: commonLayerSize,
      formatted_common_size: formatBytes(commonLayerSize),
      unique_size_image1: uniqueSize1,
      formatted_unique_size_image1: formatBytes(uniqueSize1),
      unique_size_image2: uniqueSize2,
      formatted_unique_size_image2: formatBytes(uniqueSize2),
    },
  };
}

/**
 * Compare image configurations
 */
function compareConfigurations(config1: any, config2: any): any {
  const env1 = config1.config?.Env || [];
  const env2 = config2.config?.Env || [];
  const labels1 = config1.config?.Labels || {};
  const labels2 = config2.config?.Labels || {};
  const ports1 = Object.keys(config1.config?.ExposedPorts || {});
  const ports2 = Object.keys(config2.config?.ExposedPorts || {});

  return {
    architecture: {
      image1: config1.architecture,
      image2: config2.architecture,
      same: config1.architecture === config2.architecture,
    },
    operating_system: {
      image1: config1.os,
      image2: config2.os,
      same: config1.os === config2.os,
    },
    working_directory: {
      image1: config1.config?.WorkingDir || '/',
      image2: config2.config?.WorkingDir || '/',
      same: (config1.config?.WorkingDir || '/') === (config2.config?.WorkingDir || '/'),
    },
    environment_variables: {
      image1_count: env1.length,
      image2_count: env2.length,
      common_vars: env1.filter((v: string) => env2.includes(v)).length,
      unique_to_image1: env1.filter((v: string) => !env2.includes(v)).length,
      unique_to_image2: env2.filter((v: string) => !env1.includes(v)).length,
    },
    exposed_ports: {
      image1: ports1,
      image2: ports2,
      common_ports: ports1.filter(p => ports2.includes(p)),
      unique_to_image1: ports1.filter(p => !ports2.includes(p)),
      unique_to_image2: ports2.filter(p => !ports1.includes(p)),
    },
    labels: {
      image1_count: Object.keys(labels1).length,
      image2_count: Object.keys(labels2).length,
      common_labels: Object.keys(labels1).filter(key => key in labels2 && labels1[key] === labels2[key]).length,
    },
  };
}

/**
 * Detect base image from configuration
 */
function detectBaseImage(config: any): string {
  const history = config.history || [];
  
  // Look for FROM instruction in early history
  for (const entry of history.slice(0, 3)) {
    const createdBy = entry.created_by || '';
    if (createdBy.includes('FROM')) {
      const match = createdBy.match(/FROM\s+([^\s]+)/);
      if (match) return match[1];
    }
  }
  
  return 'unknown';
}

/**
 * Analyze unique layers for a specific image
 */
function analyzeUniqueLayersForImage(manifest: any, config: any, _imageNumber: number): any {
  const layers = manifest.layers.map((layer: any, index: number) => {
    const historyEntry = config.history?.[index];
    return {
      index,
      digest: layer.digest,
      size: layer.size,
      formatted_size: formatBytes(layer.size),
      instruction: extractDockerInstruction(historyEntry?.created_by || ''),
      created_by: historyEntry?.created_by || 'Unknown',
    };
  });

  const totalSize = layers.reduce((sum: number, l: any) => sum + l.size, 0);
  const largestLayer = layers.reduce((max: any, layer: any) => 
    layer.size > max.size ? layer : max, layers[0] || { size: 0 });

  return {
    total_layers: layers.length,
    total_size: totalSize,
    formatted_total_size: formatBytes(totalSize),
    largest_layer: {
      index: largestLayer.index,
      size: largestLayer.size,
      formatted_size: largestLayer.formatted_size,
      instruction: largestLayer.instruction,
    },
    instruction_breakdown: layers.reduce((acc: any, layer: any) => {
      acc[layer.instruction] = (acc[layer.instruction] || 0) + 1;
      return acc;
    }, {}),
    layers: layers.slice(0, 5), // Show first 5 layers for brevity
  };
}

/**
 * Analyze common layers between images
 */
function analyzeCommonLayers(manifest1: any, manifest2: any): any {
  const layers1 = manifest1.layers;
  const layers2 = manifest2.layers;
  const layers1Digests = layers1.map((l: any) => l.digest);
  const layers2Digests = layers2.map((l: any) => l.digest);
  
  const commonDigests = layers1Digests.filter((digest: string) => layers2Digests.includes(digest));
  const commonLayers = layers1.filter((l: any) => commonDigests.includes(l.digest));
  
  const totalCommonSize = commonLayers.reduce((sum: number, l: any) => sum + l.size, 0);
  
  return {
    count: commonLayers.length,
    total_size: totalCommonSize,
    formatted_total_size: formatBytes(totalCommonSize),
    percentage_of_image1: ((totalCommonSize / layers1.reduce((s: number, l: any) => s + l.size, 0)) * 100).toFixed(2),
    percentage_of_image2: ((totalCommonSize / layers2.reduce((s: number, l: any) => s + l.size, 0)) * 100).toFixed(2),
    likely_base_layers: commonLayers.slice(0, 3).map((l: any) => ({
      digest: l.digest.slice(0, 16) + '...',
      size: formatBytes(l.size),
    })),
  };
}

/**
 * Generate comparison recommendations
 */
function generateComparisonRecommendations(image1: any, image2: any, layerAnalysis: any): string[] {
  const recommendations: string[] = [];
  
  // Size recommendations
  const sizeDiff = Math.abs(image2.size - image1.size);
  if (sizeDiff > 100 * 1024 * 1024) { // > 100MB difference
    const smaller = image1.size < image2.size ? 'first' : 'second';
    recommendations.push(`Significant size difference (${formatBytes(sizeDiff)}). Consider using the ${smaller} image as a base if functionality allows.`);
  }
  
  // Layer recommendations
  if (layerAnalysis.common_layers < 3) {
    recommendations.push('Images share very few layers. Consider using a common base image for better layer caching.');
  } else if (layerAnalysis.common_layers > 10) {
    recommendations.push('Images share many layers, indicating good layer reuse and caching efficiency.');
  }
  
  // Architectural recommendations
  if (image1.config.architecture !== image2.config.architecture) {
    recommendations.push('Images have different architectures. Ensure compatibility with your target deployment platform.');
  }
  
  // Layer count recommendations
  const layerDiff = Math.abs(image1.manifest.layers.length - image2.manifest.layers.length);
  if (layerDiff > 10) {
    const fewer = image1.manifest.layers.length < image2.manifest.layers.length ? 'first' : 'second';
    recommendations.push(`The ${fewer} image has significantly fewer layers, which may result in better pull performance.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Images appear to be similarly optimized. Choose based on functionality and security requirements.');
  }
  
  return recommendations;
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
