import { MCPTool } from './index.js';
import { GetImageDetailsArgs, GetImageDetailsArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Get detailed information about a Docker image repository
 */
export const getImageDetailsTool: MCPTool<GetImageDetailsArgs> = {
  name: 'docker_get_image_details',
  description: 'Get comprehensive details about a Docker repository including description, statistics, and metadata.',
  inputSchema: GetImageDetailsArgsSchema,
  
  async execute(args: GetImageDetailsArgs) {
    const { repository } = args;

    const repoDetails = await dockerHubClient.getRepositoryDetails(repository);

    // Get additional tag information
    const tagsResponse = await dockerHubClient.listTags(repository, 10); // Get first 10 tags
    const popularTags = tagsResponse.results
      .sort((a, b) => new Date(b.tag_last_pulled).getTime() - new Date(a.tag_last_pulled).getTime())
      .slice(0, 5)
      .map(tag => ({
        name: tag.name,
        size: tag.full_size,
        last_pulled: tag.tag_last_pulled,
        last_pushed: tag.tag_last_pushed,
        architectures: tag.images.map(img => img.architecture),
      }));

    return {
      repository: {
        name: repoDetails.name,
        namespace: repoDetails.namespace,
        full_name: `${repoDetails.namespace}/${repoDetails.name}`,
        description: repoDetails.description,
        short_description: repoDetails.description?.split('\n')[0] || '',
      },
      metadata: {
        is_private: repoDetails.is_private,
        is_automated: repoDetails.is_automated,
        can_edit: repoDetails.can_edit,
        repository_type: repoDetails.repository_type,
        status: repoDetails.status,
      },
      statistics: {
        star_count: repoDetails.star_count,
        pull_count: repoDetails.pull_count,
        total_tags: tagsResponse.count,
      },
      dates: {
        last_updated: repoDetails.last_updated,
        date_registered: repoDetails.date_registered,
      },
      content_info: {
        media_types: repoDetails.media_types || [],
        content_types: repoDetails.content_types || [],
        categories: repoDetails.categories || [],
      },
      popular_tags: popularTags,
      affiliation: repoDetails.affiliation,
      recommendations: [
        repoDetails.is_automated ? 'This is an automated build repository' : 'Manual build repository',
        repoDetails.star_count > 100 ? 'Popular repository with high community trust' : 'Consider checking reviews and documentation',
        popularTags.length > 0 ? `Most recent tag: ${popularTags[0].name}` : 'No recent tags found',
        repoDetails.pull_count > 1000000 ? 'High usage repository' : 'Moderate usage repository',
      ],
    };
  },
};
