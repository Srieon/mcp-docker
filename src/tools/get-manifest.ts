import { MCPTool } from './index.js';
import { GetManifestArgs, GetManifestArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Get Docker image manifest with detailed layer information
 */
export const getManifestTool: MCPTool<GetManifestArgs> = {
  name: 'docker_get_manifest',
  description: 'Retrieve the Docker image manifest containing layer information, configuration details, and metadata for a specific tag.',
  inputSchema: GetManifestArgsSchema,
  
  async execute(args: GetManifestArgs) {
    const { repository, tag } = args;

    const manifest = await dockerHubClient.getManifest(repository, tag);

    // Calculate total size of all layers
    const totalSize = manifest.layers.reduce((sum, layer) => sum + layer.size, 0);

    // Analyze layers
    const layers = manifest.layers.map((layer, index) => ({
      index,
      digest: layer.digest,
      size: layer.size,
      formatted_size: formatBytes(layer.size),
      media_type: layer.mediaType,
      percentage_of_total: ((layer.size / totalSize) * 100).toFixed(2),
    }));

    // Sort layers by size (largest first)
    const layersBySize = [...layers].sort((a, b) => b.size - a.size);

    return {
      repository,
      tag,
      manifest: {
        schema_version: manifest.schemaVersion,
        media_type: manifest.mediaType,
        digest: manifest.config.digest,
      },
      config: {
        media_type: manifest.config.mediaType,
        size: manifest.config.size,
        formatted_size: formatBytes(manifest.config.size),
        digest: manifest.config.digest,
      },
      layers: {
        total_layers: manifest.layers.length,
        total_size: totalSize,
        formatted_total_size: formatBytes(totalSize),
        largest_layer: {
          index: layersBySize[0]?.index || 0,
          size: layersBySize[0]?.size || 0,
          formatted_size: layersBySize[0]?.formatted_size || '0 B',
          percentage: layersBySize[0]?.percentage_of_total || '0',
        },
        smallest_layer: {
          index: layersBySize[layersBySize.length - 1]?.index || 0,
          size: layersBySize[layersBySize.length - 1]?.size || 0,
          formatted_size: layersBySize[layersBySize.length - 1]?.formatted_size || '0 B',
          percentage: layersBySize[layersBySize.length - 1]?.percentage_of_total || '0',
        },
        details: layers,
      },
      size_analysis: {
        total_size: totalSize,
        formatted_total_size: formatBytes(totalSize),
        average_layer_size: layers.length > 0 ? Math.round(totalSize / layers.length) : 0,
        formatted_average_layer_size: layers.length > 0 ? formatBytes(Math.round(totalSize / layers.length)) : '0 B',
        size_distribution: {
          large_layers: layers.filter(l => l.size > totalSize * 0.1).length, // > 10% of total
          medium_layers: layers.filter(l => l.size > totalSize * 0.01 && l.size <= totalSize * 0.1).length, // 1-10% of total
          small_layers: layers.filter(l => l.size <= totalSize * 0.01).length, // <= 1% of total
        },
      },
      recommendations: generateRecommendations(layers, totalSize),
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
 * Generate optimization recommendations based on layer analysis
 */
function generateRecommendations(layers: any[], totalSize: number): string[] {
  const recommendations: string[] = [];

  // Check for large layers
  const largeLayers = layers.filter(l => l.size > totalSize * 0.2);
  if (largeLayers.length > 0) {
    recommendations.push(`Consider optimizing ${largeLayers.length} large layer(s) that make up more than 20% of the image size each`);
  }

  // Check for many small layers
  const smallLayers = layers.filter(l => l.size < 1024 * 1024); // < 1MB
  if (smallLayers.length > 5) {
    recommendations.push(`Consider consolidating ${smallLayers.length} small layers to reduce layer count and improve pull performance`);
  }

  // Check total layers count
  if (layers.length > 15) {
    recommendations.push(`High layer count (${layers.length}). Consider using multi-stage builds to reduce layers`);
  }

  // Check total size
  if (totalSize > 1024 * 1024 * 1024) { // > 1GB
    recommendations.push('Large image size. Consider using a smaller base image or removing unnecessary components');
  } else if (totalSize < 10 * 1024 * 1024) { // < 10MB
    recommendations.push('Very compact image - good for microservices and minimal deployments');
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('Image structure looks well-optimized for size and layer count');
  }

  return recommendations;
}
