import { MCPTool } from './index.js';
import { SearchImagesArgs, SearchImagesArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Search Docker Hub for images
 */
export const searchImagesTool: MCPTool<SearchImagesArgs> = {
  name: 'docker_search_images',
  description: 'Search Docker Hub for images by query. Returns a list of images with metadata including stars, pulls, and descriptions.',
  inputSchema: SearchImagesArgsSchema,
  
  async execute(args: SearchImagesArgs) {
    const { query, limit, page, is_official, is_automated } = args;

    const response = await dockerHubClient.searchImages(
      query,
      limit,
      page,
      is_official,
      is_automated
    );

    const results = response.results.map(image => ({
      name: image.name,
      description: image.short_description || image.description,
      stars: image.star_count,
      pulls: image.pull_count,
      owner: image.repo_owner,
      is_official: image.is_official,
      is_automated: image.is_automated,
      is_trusted: image.is_trusted,
      last_updated: image.last_updated,
    }));

    return {
      query,
      total_count: response.count,
      page,
      page_size: limit,
      total_pages: Math.ceil(response.count / limit),
      has_next: !!response.next,
      has_previous: !!response.previous,
      results,
      summary: {
        total_results: response.count,
        official_images: results.filter(r => r.is_official).length,
        automated_builds: results.filter(r => r.is_automated).length,
        average_stars: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.stars, 0) / results.length) : 0,
      },
    };
  },
};
