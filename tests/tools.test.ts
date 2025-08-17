import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toolRegistry } from '../src/tools/index.js';
import { dockerHubClient } from '../src/clients/dockerhub.js';

// Mock the Docker Hub client
vi.mock('../src/clients/dockerhub.js', () => ({
  dockerHubClient: {
    searchImages: vi.fn(),
    getRepositoryDetails: vi.fn(),
    listTags: vi.fn(),
    getManifest: vi.fn(),
    getImageConfig: vi.fn(),
    getVulnerabilities: vi.fn(),
    getDockerfile: vi.fn(),
    getImageSize: vi.fn(),
  },
}));

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Registry', () => {
    it('should have all required tools registered', () => {
      const tools = toolRegistry.getAllTools();
      const toolNames = tools.map(tool => tool.name);

      // Required tools
      expect(toolNames).toContain('docker_search_images');
      expect(toolNames).toContain('docker_get_image_details');
      expect(toolNames).toContain('docker_list_tags');
      expect(toolNames).toContain('docker_get_manifest');
      expect(toolNames).toContain('docker_analyze_layers');
      expect(toolNames).toContain('docker_compare_images');
      expect(toolNames).toContain('docker_get_dockerfile');
      expect(toolNames).toContain('docker_get_stats');

      // Bonus tools
      expect(toolNames).toContain('docker_get_vulnerabilities');
      expect(toolNames).toContain('docker_get_image_history');
      expect(toolNames).toContain('docker_estimate_pull_size');
    });

    it('should return valid tool definitions', () => {
      const tools = toolRegistry.getAllTools();
      
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      });
    });
  });

  describe('docker_search_images Tool', () => {
    it('should search for images successfully', async () => {
      const mockResponse = {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            name: 'nginx',
            short_description: 'Official build of Nginx',
            star_count: 15000,
            pull_count: 1000000000,
            repo_owner: '_',
            is_official: true,
            is_automated: false,
            is_trusted: true,
            last_updated: '2024-01-15T10:30:00Z',
          },
        ],
      };

      vi.mocked(dockerHubClient.searchImages).mockResolvedValue(mockResponse);

      const searchTool = toolRegistry.getTool('docker_search_images');
      expect(searchTool).toBeDefined();

      const result = await searchTool!.execute({
        query: 'nginx',
        limit: 1,
        page: 1,
      });

      expect(result.query).toBe('nginx');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe('nginx');
      expect(result.results[0].is_official).toBe(true);
    });

    it('should validate input parameters', () => {
      const searchTool = toolRegistry.getTool('docker_search_images');
      expect(searchTool).toBeDefined();

      // Valid parameters
      const validResult = searchTool!.inputSchema.safeParse({
        query: 'nginx',
        limit: 10,
        page: 1,
      });
      expect(validResult.success).toBe(true);

      // Invalid parameters
      const invalidResult = searchTool!.inputSchema.safeParse({
        query: '', // Empty query
        limit: -1, // Invalid limit
      });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('docker_get_image_details Tool', () => {
    it('should get image details successfully', async () => {
      const mockRepoDetails = {
        name: 'nginx',
        namespace: 'library',
        description: 'Official build of Nginx',
        is_private: false,
        is_automated: false,
        can_edit: false,
        star_count: 15000,
        pull_count: 1000000000,
        last_updated: '2024-01-15T10:30:00Z',
        date_registered: '2015-06-01T00:00:00Z',
        repository_type: 'image',
        status: 1,
        media_types: ['application/vnd.docker.distribution.manifest.v2+json'],
        content_types: ['image'],
        categories: [],
        affiliation: null,
      };

      const mockTagsResponse = {
        count: 50,
        next: null,
        previous: null,
        results: [
          {
            name: 'latest',
            full_size: 142000000,
            tag_last_pulled: '2024-01-15T12:00:00Z',
            tag_last_pushed: '2024-01-15T10:30:00Z',
            images: [
              {
                architecture: 'amd64',
                os: 'linux',
                size: 142000000,
              },
            ],
          },
        ],
      };

      vi.mocked(dockerHubClient.getRepositoryDetails).mockResolvedValue(mockRepoDetails);
      vi.mocked(dockerHubClient.listTags).mockResolvedValue(mockTagsResponse);

      const detailsTool = toolRegistry.getTool('docker_get_image_details');
      expect(detailsTool).toBeDefined();

      const result = await detailsTool!.execute({
        repository: 'library/nginx',
      });

      expect(result.repository.name).toBe('nginx');
      expect(result.repository.namespace).toBe('library');
      expect(result.statistics.star_count).toBe(15000);
      expect(result.popular_tags).toBeDefined();
    });
  });

  describe('docker_analyze_layers Tool', () => {
    it('should analyze image layers successfully', async () => {
      const mockManifest = {
        schemaVersion: 2,
        mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
        config: {
          mediaType: 'application/vnd.docker.container.image.v1+json',
          size: 1469,
          digest: 'sha256:abc123...',
        },
        layers: [
          {
            mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
            size: 7300000,
            digest: 'sha256:def456...',
          },
        ],
      };

      const mockImageConfig = {
        architecture: 'amd64',
        os: 'linux',
        config: {
          Env: ['PATH=/usr/local/bin:/usr/bin:/bin'],
          Cmd: ['nginx', '-g', 'daemon off;'],
          WorkingDir: '/',
          ExposedPorts: { '80/tcp': {} },
          Labels: {},
        },
        rootfs: {
          type: 'layers',
          diff_ids: ['sha256:layer1...'],
        },
        history: [
          {
            created: '2024-01-15T08:00:00Z',
            created_by: '/bin/sh -c #(nop) ADD file:abc123... in /',
            size: 7300000,
            empty_layer: false,
          },
        ],
      };

      vi.mocked(dockerHubClient.getManifest).mockResolvedValue(mockManifest);
      vi.mocked(dockerHubClient.getImageConfig).mockResolvedValue(mockImageConfig);

      const analyzeTool = toolRegistry.getTool('docker_analyze_layers');
      expect(analyzeTool).toBeDefined();

      const result = await analyzeTool!.execute({
        repository: 'library/alpine',
        tag: '3.18',
      });

      expect(result.repository).toBe('library/alpine');
      expect(result.tag).toBe('3.18');
      expect(result.summary.total_layers).toBe(1);
      expect(result.layers).toHaveLength(1);
      expect(result.analysis.architecture).toBe('amd64');
      expect(result.optimizations).toBeDefined();
    });
  });

  describe('docker_compare_images Tool', () => {
    it('should compare two images successfully', async () => {
      const mockManifest1 = {
        layers: [
          { digest: 'sha256:layer1...', size: 5000000, mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip' },
          { digest: 'sha256:layer2...', size: 10000000, mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip' },
        ],
      };

      const mockManifest2 = {
        layers: [
          { digest: 'sha256:layer1...', size: 5000000, mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip' }, // Same layer
          { digest: 'sha256:layer3...', size: 15000000, mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip' },
        ],
      };

      const mockConfig1 = {
        architecture: 'amd64',
        os: 'linux',
        history: [
          { created_by: 'FROM alpine:3.18' },
          { created_by: '/bin/sh -c apk add nginx' },
        ],
      };

      const mockConfig2 = {
        architecture: 'amd64', 
        os: 'linux',
        history: [
          { created_by: 'FROM alpine:3.18' },
          { created_by: '/bin/sh -c apk add nginx-extras' },
        ],
      };

      vi.mocked(dockerHubClient.getManifest)
        .mockResolvedValueOnce(mockManifest1)
        .mockResolvedValueOnce(mockManifest2);

      vi.mocked(dockerHubClient.getImageConfig)
        .mockResolvedValueOnce(mockConfig1)
        .mockResolvedValueOnce(mockConfig2);

      const compareTool = toolRegistry.getTool('docker_compare_images');
      expect(compareTool).toBeDefined();

      const result = await compareTool!.execute({
        repository1: 'library/nginx',
        tag1: 'alpine',
        repository2: 'library/nginx',
        tag2: 'alpine-slim',
      });

      expect(result.comparison_summary.image1.repository).toBe('library/nginx');
      expect(result.comparison_summary.image2.repository).toBe('library/nginx');
      expect(result.layer_analysis.common_layers).toBe(1);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(dockerHubClient.searchImages).mockRejectedValue(new Error('Network error'));

      const searchTool = toolRegistry.getTool('docker_search_images');
      expect(searchTool).toBeDefined();

      await expect(searchTool!.execute({
        query: 'nginx',
        limit: 1,
        page: 1,
      })).rejects.toThrow('Network error');
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).statusCode = 429;
      
      vi.mocked(dockerHubClient.getRepositoryDetails).mockRejectedValue(rateLimitError);

      const detailsTool = toolRegistry.getTool('docker_get_image_details');
      expect(detailsTool).toBeDefined();

      await expect(detailsTool!.execute({
        repository: 'library/nginx',
      })).rejects.toThrow('Rate limit exceeded');
    });
  });
});
