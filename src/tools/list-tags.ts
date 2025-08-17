import { MCPTool } from './index.js';
import { ListTagsArgs, ListTagsArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * List all tags for a Docker repository
 */
export const listTagsTool: MCPTool<ListTagsArgs> = {
  name: 'docker_list_tags',
  description: 'List all available tags for a Docker repository with detailed information about each tag including size, architectures, and timestamps.',
  inputSchema: ListTagsArgsSchema,
  
  async execute(args: ListTagsArgs) {
    const { repository, limit, page } = args;

    const response = await dockerHubClient.listTags(repository, limit, page);

    const tags = response.results.map(tag => {
      // Calculate total size across all architectures
      const totalSize = tag.images.reduce((sum, img) => sum + img.size, 0);
      
      // Get unique architectures
      const architectures = [...new Set(tag.images.map(img => img.architecture))];
      
      // Get operating systems
      const operatingSystems = [...new Set(tag.images.map(img => img.os))];
      
      // Find the largest variant (usually amd64)
      const primaryImage = tag.images.find(img => img.architecture === 'amd64') || tag.images[0];

      return {
        name: tag.name,
        size: {
          full_size: tag.full_size,
          total_size: totalSize,
          formatted_size: formatBytes(tag.full_size),
          largest_variant: primaryImage ? {
            architecture: primaryImage.architecture,
            size: primaryImage.size,
            formatted_size: formatBytes(primaryImage.size),
          } : null,
        },
        metadata: {
          digest: tag.digest,
          media_type: tag.media_type,
          content_type: tag.content_type,
          tag_status: tag.tag_status,
          v2: tag.v2,
        },
        timestamps: {
          last_pushed: tag.tag_last_pushed,
          last_pulled: tag.tag_last_pulled,
          last_pushed_relative: getRelativeTime(tag.tag_last_pushed),
          last_pulled_relative: getRelativeTime(tag.tag_last_pulled),
        },
        platforms: {
          architectures,
          operating_systems: operatingSystems,
          total_variants: tag.images.length,
        },
        images: tag.images.map(img => ({
          architecture: img.architecture,
          os: img.os,
          size: img.size,
          formatted_size: formatBytes(img.size),
          digest: img.digest,
          status: img.status,
          features: img.features,
          variant: img.variant,
          os_version: img.os_version,
          os_features: img.os_features,
        })),
      };
    });

    // Sort tags by last pushed date (most recent first)
    tags.sort((a, b) => new Date(b.timestamps.last_pushed).getTime() - new Date(a.timestamps.last_pushed).getTime());

    return {
      repository,
      pagination: {
        page,
        page_size: limit,
        total_count: response.count,
        total_pages: Math.ceil(response.count / limit),
        has_next: !!response.next,
        has_previous: !!response.previous,
      },
      tags,
      summary: {
        total_tags: response.count,
        tags_on_page: tags.length,
        total_size: tags.reduce((sum, tag) => sum + tag.size.full_size, 0),
        average_size: tags.length > 0 ? Math.round(tags.reduce((sum, tag) => sum + tag.size.full_size, 0) / tags.length) : 0,
        most_recent_tag: tags[0]?.name || null,
        architecture_coverage: {
          amd64: tags.filter(t => t.platforms.architectures.includes('amd64')).length,
          arm64: tags.filter(t => t.platforms.architectures.includes('arm64')).length,
          arm: tags.filter(t => t.platforms.architectures.includes('arm')).length,
          '386': tags.filter(t => t.platforms.architectures.includes('386')).length,
        },
        os_coverage: {
          linux: tags.filter(t => t.platforms.operating_systems.includes('linux')).length,
          windows: tags.filter(t => t.platforms.operating_systems.includes('windows')).length,
        },
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
