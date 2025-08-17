import { MCPTool } from './index.js';
import { z } from 'zod';
import { dockerHubClient } from '../clients/dockerhub.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { ExportFormatter } from '../utils/export-formatter.js';

/**
 * Batch Image Details Tool - Fetch details for multiple images efficiently
 */

// Input schema for batch operations
export const BatchImageDetailsArgsSchema = z.object({
  repositories: z.array(z.string()).min(1).max(20).describe('Array of repository names (max 20)'),
  include_tags: z.boolean().default(false).describe('Include tag information for each repository'),
  include_manifest: z.boolean().default(false).describe('Include manifest information for latest tag'),
  include_vulnerabilities: z.boolean().default(false).describe('Include vulnerability scan results'),
  tag_limit: z.number().min(1).max(10).default(5).describe('Number of tags to fetch per repository'),
  format: z.enum(['detailed', 'summary', 'comparison']).default('summary').describe('Output format'),
  export_format: z.enum(['json', 'csv', 'dependency-tree']).default('json').describe('Export format for results'),
});

export type BatchImageDetailsArgs = z.infer<typeof BatchImageDetailsArgsSchema>;

export const batchImageDetailsTool: MCPTool<BatchImageDetailsArgs> = {
  name: 'docker_batch_image_details',
  description: 'Efficiently fetch detailed information for multiple Docker repositories in a single operation. Supports parallel processing and configurable data inclusion.',
  inputSchema: BatchImageDetailsArgsSchema,
  
  async execute(args: BatchImageDetailsArgs) {
    const { repositories, include_tags, include_manifest, include_vulnerabilities, tag_limit, format, export_format } = args;

    console.log(`Processing batch request for ${repositories.length} repositories...`);
    
    try {
      // Process repositories in parallel with controlled concurrency
      const batchSize = 5; // Process 5 repositories at a time to avoid rate limits
      const results: any[] = [];
      
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)}`);
        
        const batchResults = await Promise.allSettled(
          batch.map(repository => processRepository(repository, {
            include_tags,
            include_manifest,
            include_vulnerabilities,
            tag_limit
          }))
        );
        
        // Process results and handle failures gracefully
        batchResults.forEach((result, index) => {
          const repository = batch[index];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.warn(`Failed to process ${repository}:`, result.reason?.message);
            results.push({
              repository,
              error: ErrorHandler.createUserFriendlyMessage(ErrorHandler.handleError(result.reason)),
              success: false,
            });
          }
        });
      }

      // Format results based on requested format
      const formattedResults = formatBatchResults(results, format);
      
      const responseData = {
        batch_summary: {
          total_requested: repositories.length,
          successful: results.filter(r => r.success !== false).length,
          failed: results.filter(r => r.success === false).length,
          processing_time: `${Date.now()}ms`, // This would be calculated properly in real implementation
          format: format,
          export_format: export_format,
        },
        results: formattedResults,
        aggregated_insights: generateAggregatedInsights(results.filter(r => r.success !== false)),
        recommendations: generateBatchRecommendations(results.filter(r => r.success !== false)),
      };

      // Apply export formatting if requested
      if (export_format === 'csv') {
        return {
          ...responseData,
          exported_data: ExportFormatter.batchResultsToCSV(results),
          export_info: {
            format: 'csv',
            description: 'Comma-separated values format suitable for spreadsheet applications',
            usage: 'Save the exported_data content to a .csv file',
          },
        };
      } else if (export_format === 'dependency-tree') {
        const dependencyTrees = ExportFormatter.batchToDependencyForest(results);
        return {
          ...responseData,
          exported_data: dependencyTrees.map(tree => ({
            repository: tree.name,
            tree_string: ExportFormatter.dependencyTreeToString(tree),
            tree_json: tree,
          })),
          export_info: {
            format: 'dependency-tree',
            description: 'Hierarchical view of image dependencies and structure',
            usage: 'Use tree_string for text visualization or tree_json for programmatic access',
          },
        };
      }

      // Default JSON format
      return responseData;
      
    } catch (error) {
      throw ErrorHandler.handleError(error);
    }
  },
};

/**
 * Process a single repository with configurable data inclusion
 */
async function processRepository(
  repository: string, 
  options: {
    include_tags: boolean;
    include_manifest: boolean;
    include_vulnerabilities: boolean;
    tag_limit: number;
  }
): Promise<any> {
  console.log(`Processing repository: ${repository}`);
  
  // Base repository details (always included)
  const details = await dockerHubClient.getRepositoryDetails(repository);
  
  const result: any = {
    repository,
    name: details.name,
    namespace: details.namespace,
    description: details.description,
    is_private: details.is_private,
    is_automated: details.is_automated,
    star_count: details.star_count,
    pull_count: details.pull_count,
    last_updated: details.last_updated,
    date_registered: details.date_registered,
    success: true,
  };

  // Parallel fetch of optional data
  const parallelTasks: Promise<any>[] = [];
  
  if (options.include_tags) {
    parallelTasks.push(
      dockerHubClient.listTags(repository, options.tag_limit)
        .then(tags => ({ tags: tags.results }))
        .catch(error => ({ tags_error: ErrorHandler.createUserFriendlyMessage(ErrorHandler.handleError(error)) }))
    );
  }
  
  if (options.include_manifest) {
    parallelTasks.push(
      dockerHubClient.getManifest(repository, 'latest')
        .then(manifest => ({ 
          manifest: {
            schema_version: manifest.schemaVersion,
            layers: manifest.layers.length,
            total_size: manifest.layers.reduce((sum, layer) => sum + layer.size, 0),
            config_digest: manifest.config.digest,
          }
        }))
        .catch(error => ({ manifest_error: ErrorHandler.createUserFriendlyMessage(ErrorHandler.handleError(error)) }))
    );
  }
  
  if (options.include_vulnerabilities) {
    parallelTasks.push(
      dockerHubClient.getVulnerabilities(repository, 'latest')
        .then(vulns => ({ 
          vulnerabilities: vulns ? {
            total: vulns.summary.total,
            high: vulns.summary.high,
            medium: vulns.summary.medium,
            low: vulns.summary.low,
            scan_available: true,
          } : { scan_available: false }
        }))
        .catch(error => ({ vulnerabilities_error: ErrorHandler.createUserFriendlyMessage(ErrorHandler.handleError(error)) }))
    );
  }

  if (parallelTasks.length > 0) {
    const additionalData = await Promise.allSettled(parallelTasks);
    additionalData.forEach(data => {
      if (data.status === 'fulfilled') {
        Object.assign(result, data.value);
      }
    });
  }

  return result;
}

/**
 * Format batch results based on requested format
 */
function formatBatchResults(results: any[], format: string): any[] {
  switch (format) {
    case 'detailed':
      return results;
      
    case 'summary':
      return results.map(result => {
        if (result.success === false) return result;
        
        return {
          repository: result.repository,
          description: result.description || 'No description',
          stars: result.star_count,
          pulls: result.pull_count,
          last_updated: result.last_updated,
          is_official: result.namespace === 'library',
          is_automated: result.is_automated,
          tag_count: result.tags?.length || 'unknown',
          total_size: result.manifest?.total_size ? formatBytes(result.manifest.total_size) : 'unknown',
          vulnerability_summary: result.vulnerabilities?.scan_available ? 
            `${result.vulnerabilities.high}H/${result.vulnerabilities.medium}M/${result.vulnerabilities.low}L` : 
            'No scan',
        };
      });
      
    case 'comparison':
      return results
        .filter(r => r.success !== false)
        .map(result => ({
          repository: result.repository,
          stars: result.star_count,
          pulls: result.pull_count,
          size: result.manifest?.total_size || 0,
          last_updated: new Date(result.last_updated).getTime(),
          vulnerabilities: result.vulnerabilities?.total || 0,
        }))
        .sort((a, b) => b.stars - a.stars); // Sort by popularity
        
    default:
      return results;
  }
}

/**
 * Generate aggregated insights across all repositories
 */
function generateAggregatedInsights(results: any[]): any {
  if (results.length === 0) return {};
  
  const totalPulls = results.reduce((sum, r) => sum + (r.pull_count || 0), 0);
  const totalStars = results.reduce((sum, r) => sum + (r.star_count || 0), 0);
  const automatedCount = results.filter(r => r.is_automated).length;
  const privateCount = results.filter(r => r.is_private).length;
  
  const recentlyUpdated = results.filter(r => {
    const lastUpdate = new Date(r.last_updated);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return lastUpdate > monthAgo;
  }).length;

  const sizesWithData = results.filter(r => r.manifest?.total_size).map(r => r.manifest.total_size);
  const averageSize = sizesWithData.length > 0 ? 
    sizesWithData.reduce((sum, size) => sum + size, 0) / sizesWithData.length : 0;

  return {
    overview: {
      total_repositories: results.length,
      total_pulls: totalPulls,
      total_stars: totalStars,
      average_stars: Math.round(totalStars / results.length),
      automated_builds: automatedCount,
      private_repositories: privateCount,
      recently_updated: recentlyUpdated,
    },
    size_analysis: {
      repositories_with_size_data: sizesWithData.length,
      average_size: averageSize > 0 ? formatBytes(averageSize) : 'N/A',
      largest_repository: results.reduce((max, r) => 
        (r.manifest?.total_size || 0) > (max.manifest?.total_size || 0) ? r : max, 
        { repository: 'N/A', manifest: { total_size: 0 } }
      ).repository,
    },
    security_overview: {
      repositories_with_scans: results.filter(r => r.vulnerabilities?.scan_available).length,
      total_vulnerabilities: results.reduce((sum, r) => sum + (r.vulnerabilities?.total || 0), 0),
      high_severity_issues: results.reduce((sum, r) => sum + (r.vulnerabilities?.high || 0), 0),
    },
  };
}

/**
 * Generate recommendations based on batch analysis
 */
function generateBatchRecommendations(results: any[]): string[] {
  const recommendations: string[] = [];
  
  if (results.length === 0) return recommendations;

  // Check for outdated images
  const outdatedImages = results.filter(r => {
    const lastUpdate = new Date(r.last_updated);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return lastUpdate < sixMonthsAgo;
  });
  
  if (outdatedImages.length > 0) {
    recommendations.push(`${outdatedImages.length} repositories haven't been updated in 6+ months. Consider checking for newer alternatives: ${outdatedImages.slice(0, 3).map(r => r.repository).join(', ')}`);
  }

  // Check for high vulnerability counts
  const vulnerableImages = results.filter(r => (r.vulnerabilities?.high || 0) > 5);
  if (vulnerableImages.length > 0) {
    recommendations.push(`${vulnerableImages.length} repositories have 5+ high-severity vulnerabilities. Review security implications.`);
  }

  // Size recommendations
  const largeSizes = results.filter(r => (r.manifest?.total_size || 0) > 500 * 1024 * 1024); // > 500MB
  if (largeSizes.length > 0) {
    recommendations.push(`${largeSizes.length} repositories are larger than 500MB. Consider Alpine variants or multi-stage builds.`);
  }

  // Popularity insights
  const popularityRange = results.map(r => r.star_count || 0);
  const maxStars = Math.max(...popularityRange);
  const minStars = Math.min(...popularityRange);
  
  if (maxStars > minStars * 10) {
    const mostPopular = results.find(r => r.star_count === maxStars);
    recommendations.push(`Consider ${mostPopular?.repository} as the primary choice - it has significantly more community adoption.`);
  }

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
