import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  DockerHubSearchResponse,
  DockerHubRepository,
  DockerHubTagsResponse,
  DockerManifest,
  ImageConfig,
  VulnerabilityReport,
  RegistryAuth,
} from '../types.js';
import { config } from '../config.js';
import { authManager } from '../auth/auth-manager.js';
import { cacheManager } from '../cache/cache-manager.js';
import { dockerHubRateLimiter } from '../utils/rate-limiter.js';
import { ErrorHandler } from '../utils/error-handler.js';

/**
 * Docker Hub API client with authentication, caching, and rate limiting
 */
export class DockerHubClient {
  private httpClient: AxiosInstance;
  private baseURL = 'https://hub.docker.com/v2';
  private registryURL = 'https://registry-1.docker.io/v2';

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': `${config.server.name}/${config.server.version}`,
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for rate limiting
    this.httpClient.interceptors.response.use(
      (response) => {
        // Update rate limiter with response headers
        const headers: Record<string, string> = {};
        Object.entries(response.headers).forEach(([key, value]) => {
          if (typeof value === 'string') {
            headers[key] = value;
          }
        });
        dockerHubRateLimiter.updateFromHeaders(headers);
        return response;
      },
      (error) => {
        if (error.response?.headers) {
          const headers: Record<string, string> = {};
          Object.entries(error.response.headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
              headers[key] = value;
            }
          });
          dockerHubRateLimiter.updateFromHeaders(headers);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search for Docker images
   */
  async searchImages(
    query: string,
    limit: number = 25,
    page: number = 1,
    isOfficial?: boolean,
    isAutomated?: boolean
  ): Promise<DockerHubSearchResponse> {
    return ErrorHandler.withErrorHandling(async () => {
    const params: Record<string, any> = {
      q: query,
      page_size: limit,
      page,
    };

    if (isOfficial !== undefined) {
      params.is_official = isOfficial;
    }
    if (isAutomated !== undefined) {
      params.is_automated = isAutomated;
    }

    // Check cache first
    const cached = cacheManager.getCachedApiResponse<DockerHubSearchResponse>('search', params);
    if (cached) {
      return cached;
    }

    const response = await dockerHubRateLimiter.execute(async () => {
      return this.httpClient.get<DockerHubSearchResponse>(`${this.baseURL}/search/repositories/`, {
        params,
      });
    });

    const data = response.data;
    
    // Cache the response
    cacheManager.cacheApiResponse('search', params, data, 300); // 5 minutes

    return data;
    }, 'DockerHub.searchImages');
  }

  /**
   * Get detailed information about a repository
   */
  async getRepositoryDetails(repository: string): Promise<DockerHubRepository> {
    return ErrorHandler.withErrorHandling(async () => {
      const [namespace, name] = this.parseRepository(repository);
      const endpoint = `repositories/${namespace}/${name}`;

      // Check cache first
      const cached = cacheManager.getCachedApiResponse<DockerHubRepository>(endpoint, {});
      if (cached) {
        return cached;
      }

      const response = await dockerHubRateLimiter.execute(async () => {
        const authHeaders = await authManager.createAuthHeaders();
        return this.httpClient.get<DockerHubRepository>(`${this.baseURL}/${endpoint}/`, {
          headers: authHeaders,
        });
      });

      const data = response.data;
      
      // Cache the response
      cacheManager.cacheApiResponse(endpoint, {}, data, 600); // 10 minutes

      return data;
    }, 'DockerHub.getRepositoryDetails');
  }

  /**
   * List tags for a repository
   */
  async listTags(
    repository: string,
    limit: number = 25,
    page: number = 1
  ): Promise<DockerHubTagsResponse> {
    return ErrorHandler.withErrorHandling(async () => {
      const [namespace, name] = this.parseRepository(repository);
      const endpoint = `repositories/${namespace}/${name}/tags`;
      const params = { page_size: limit, page };

      // Check cache first
      const cached = cacheManager.getCachedApiResponse<DockerHubTagsResponse>(endpoint, params);
      if (cached) {
        return cached;
      }

      const response = await dockerHubRateLimiter.execute(async () => {
        const authHeaders = await authManager.createAuthHeaders();
        return this.httpClient.get<DockerHubTagsResponse>(`${this.baseURL}/${endpoint}/`, {
          params,
          headers: authHeaders,
        });
      });

      const data = response.data;
      
      // Cache the response
      cacheManager.cacheApiResponse(endpoint, params, data, 300); // 5 minutes

      return data;
    }, 'DockerHub.listTags');
  }

  /**
   * Get image manifest from Docker Registry API
   */
  async getManifest(repository: string, tag: string = 'latest'): Promise<DockerManifest> {
    return ErrorHandler.withErrorHandling(async () => {
    const [namespace, name] = this.parseRepository(repository);
    const endpoint = `${namespace}/${name}/manifests/${tag}`;

    // Check cache first
    const cached = cacheManager.getCachedApiResponse<DockerManifest>(endpoint, {});
    if (cached) {
      return cached;
    }

    const response = await dockerHubRateLimiter.execute(async () => {
      const scope = `repository:${namespace}/${name}:pull`;
      const authHeaders = await authManager.createAuthHeaders(undefined, scope);
      
      return this.httpClient.get<DockerManifest>(`${this.registryURL}/${endpoint}`, {
        headers: {
          ...authHeaders,
          'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
        },
      });
    });

    const data = response.data;
    
    // Cache the response
    cacheManager.cacheApiResponse(endpoint, {}, data, 1800); // 30 minutes

    return data;
    }, 'DockerHub.getManifest');
  }

  /**
   * Get image configuration blob
   */
  async getImageConfig(repository: string, tag: string = 'latest'): Promise<ImageConfig> {
    return ErrorHandler.withErrorHandling(async () => {
    const manifest = await this.getManifest(repository, tag);
    const configDigest = manifest.config.digest;
    
    const [namespace, name] = this.parseRepository(repository);
    const endpoint = `${namespace}/${name}/blobs/${configDigest}`;

    // Check cache first
    const cached = cacheManager.getCachedApiResponse<ImageConfig>(endpoint, {});
    if (cached) {
      return cached;
    }

    const response = await dockerHubRateLimiter.execute(async () => {
      const scope = `repository:${namespace}/${name}:pull`;
      const authHeaders = await authManager.createAuthHeaders(undefined, scope);
      
      return this.httpClient.get<ImageConfig>(`${this.registryURL}/${endpoint}`, {
        headers: {
          ...authHeaders,
          'Accept': 'application/vnd.docker.container.image.v1+json',
        },
      });
    });

    const data = response.data;
    
    // Cache the response
    cacheManager.cacheApiResponse(endpoint, {}, data, 3600); // 1 hour

    return data;
    }, 'DockerHub.getImageConfig');
  }

  /**
   * Attempt to get Dockerfile content (limited availability)
   */
  async getDockerfile(repository: string, _tag: string = 'latest'): Promise<string | null> {
    return ErrorHandler.withErrorHandling(async () => {
      const [namespace, name] = this.parseRepository(repository);
    
      try {
        // Try to get Dockerfile from repository details if it's an automated build
        const repoDetails = await this.getRepositoryDetails(repository);
        
        if (!repoDetails.is_automated) {
          return null; // Dockerfile not available for non-automated builds
        }

        // For automated builds, try to get build details
        const endpoint = `repositories/${namespace}/${name}/dockerfile`;
        
        const response = await dockerHubRateLimiter.execute(async () => {
          const authHeaders = await authManager.createAuthHeaders();
          return this.httpClient.get(`${this.baseURL}/${endpoint}/`, {
            headers: authHeaders,
          });
        });

        return response.data.contents || null;
      } catch (error) {
        // Dockerfile access is often restricted, so we don't throw errors
        ErrorHandler.logError(ErrorHandler.handleError(error), 'DockerHub.getDockerfile');
        return null;
      }
    }, 'DockerHub.getDockerfile');
  }

  /**
   * Get vulnerability scan results (if available)
   */
  async getVulnerabilities(repository: string, tag: string = 'latest'): Promise<VulnerabilityReport | null> {
    return ErrorHandler.withErrorHandling(async () => {
      const [namespace, name] = this.parseRepository(repository);
      const endpoint = `repositories/${namespace}/${name}/tags/${tag}/scan`;

      try {
        const response = await dockerHubRateLimiter.execute(async () => {
          const authHeaders = await authManager.createAuthHeaders();
          return this.httpClient.get(`${this.baseURL}/${endpoint}/`, {
            headers: authHeaders,
          });
        });

        return this.transformScanResults(response.data, namespace, name, tag);
      } catch (error) {
        // Vulnerability scans may not be available for all images
        const dockerHubError = ErrorHandler.handleError(error);
        if (dockerHubError.statusCode === 404) {
          return null; // No scan results available
        }
        throw dockerHubError;
      }
    }, 'DockerHub.getVulnerabilities');
  }

  /**
   * Get download statistics for a repository
   */
  async getStatistics(repository: string): Promise<{ pull_count: number; star_count: number }> {
    return ErrorHandler.withErrorHandling(async () => {
      const repoDetails = await this.getRepositoryDetails(repository);
      return {
        pull_count: repoDetails.pull_count,
        star_count: repoDetails.star_count,
      };
    }, 'DockerHub.getStatistics');
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(repository: string): Promise<boolean> {
    return ErrorHandler.withErrorHandling(async () => {
      try {
        await this.getRepositoryDetails(repository);
        return true;
      } catch (error) {
        const dockerHubError = ErrorHandler.handleError(error);
        if (dockerHubError.statusCode === 404) {
          return false;
        }
        throw dockerHubError;
      }
    }, 'DockerHub.repositoryExists');
  }

  /**
   * Get image size estimation
   */
  async getImageSize(repository: string, tag: string = 'latest', architecture: string = 'amd64'): Promise<number> {
    return ErrorHandler.withErrorHandling(async () => {
      const tags = await this.listTags(repository, 100);
      const targetTag = tags.results.find(t => t.name === tag);
      
      if (!targetTag) {
        throw new Error(`Tag ${tag} not found for repository ${repository}`);
      }

      // Find the specific architecture
      const archImage = targetTag.images.find(img => img.architecture === architecture);
      if (archImage) {
        return archImage.size;
      }

      // Fallback to full size if architecture not found
      return targetTag.full_size;
    }, 'DockerHub.getImageSize');
  }

  /**
   * Parse repository string into namespace and name
   */
  private parseRepository(repository: string): [string, string] {
    const parts = repository.split('/');
    
    if (parts.length === 1) {
      // Official image (e.g., "nginx" -> "library/nginx")
      return ['library', parts[0]];
    } else if (parts.length === 2) {
      // User/organization image (e.g., "user/image")
      return [parts[0], parts[1]];
    } else {
      throw new Error(`Invalid repository format: ${repository}`);
    }
  }

  /**
   * Transform scan results to standardized format
   */
  private transformScanResults(scanData: any, namespace: string, repository: string, tag: string): VulnerabilityReport {
    // This is a simplified transformation - actual API structure may vary
    return {
      namespace,
      repository,
      tag,
      summary: {
        total: scanData.vulnerability_count || 0,
        high: scanData.high_vulnerability_count || 0,
        medium: scanData.medium_vulnerability_count || 0,
        low: scanData.low_vulnerability_count || 0,
        unknown: scanData.unknown_vulnerability_count || 0,
      },
      vulnerabilities: scanData.vulnerabilities || [],
    };
  }

  /**
   * Make authenticated request with private registry
   */
  async makePrivateRegistryRequest<T>(
    url: string,
    registryAuth: RegistryAuth,
    options: AxiosRequestConfig = {}
  ): Promise<T> {
    return dockerHubRateLimiter.execute(async () => {
      const authHeaders = await authManager.createAuthHeaders(registryAuth);
      
      const response = await this.httpClient.request<T>({
        url,
        ...options,
        headers: {
          ...authHeaders,
          ...options.headers,
        },
      });

      return response.data;
    });
  }
}

// Export singleton instance
export const dockerHubClient = new DockerHubClient();
