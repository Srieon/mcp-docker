import axios, { AxiosInstance } from 'axios';
import { AuthCredentials, RegistryAuth, AuthenticationError } from '../types.js';
import { config } from '../config.js';
import { ErrorHandler } from '../utils/error-handler.js';

interface DockerHubAuthResponse {
  token: string;
  expires_in?: number;
  issued_at?: string;
}

interface AuthTokenInfo {
  token: string;
  expiresAt: number;
}

/**
 * Manages authentication for Docker Hub and private registries
 */
export class AuthManager {
  private tokenCache = new Map<string, AuthTokenInfo>();
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': `${config.server.name}/${config.server.version}`,
      },
    });
  }

  /**
   * Get authentication token for Docker Hub
   */
  async getDockerHubToken(scope?: string): Promise<string | null> {
    const credentials = config.dockerhub;
    
    // If access token is provided, use it directly
    if (credentials.accessToken) {
      return credentials.accessToken;
    }

    // If no username/password, return null (anonymous access)
    if (!credentials.username || !credentials.password) {
      return null;
    }

    // Check cache first
    const cacheKey = `dockerhub:${scope || 'default'}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    try {
      // Request new token
      const response = await this.httpClient.post<DockerHubAuthResponse>(
        'https://auth.docker.io/token',
        new URLSearchParams({
          service: 'registry.docker.io',
          ...(scope && { scope }),
        }),
        {
          auth: {
            username: credentials.username,
            password: credentials.password,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { token, expires_in } = response.data;
      const expiresAt = Date.now() + (expires_in || 3600) * 1000; // Default 1 hour

      // Cache the token
      this.tokenCache.set(cacheKey, { token, expiresAt });

      return token;
    } catch (error) {
      const dockerHubError = ErrorHandler.handleError(error);
      ErrorHandler.logError(dockerHubError, 'DockerHub Authentication');
      
      if (dockerHubError instanceof AuthenticationError) {
        throw dockerHubError;
      }
      
      // For non-auth errors, log and return null (fallback to anonymous)
      console.warn('Failed to authenticate with Docker Hub, falling back to anonymous access');
      return null;
    }
  }

  /**
   * Get authentication token for private registry
   */
  async getPrivateRegistryToken(registryAuth: RegistryAuth, scope?: string): Promise<string | null> {
    const { url, credentials } = registryAuth;
    
    if (!credentials.username || !credentials.password) {
      return null;
    }

    // Try to detect auth endpoint
    const authUrl = await this.discoverAuthEndpoint(url);
    if (!authUrl) {
      throw new AuthenticationError(`Could not discover authentication endpoint for ${url}`);
    }

    const cacheKey = `registry:${url}:${scope || 'default'}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    try {
      const response = await this.httpClient.post<DockerHubAuthResponse>(
        authUrl,
        new URLSearchParams({
          service: new URL(url).hostname,
          ...(scope && { scope }),
        }),
        {
          auth: {
            username: credentials.username,
            password: credentials.password,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { token, expires_in } = response.data;
      const expiresAt = Date.now() + (expires_in || 3600) * 1000;

      this.tokenCache.set(cacheKey, { token, expiresAt });

      return token;
    } catch (error) {
      const dockerHubError = ErrorHandler.handleError(error);
      ErrorHandler.logError(dockerHubError, 'Private Registry Authentication');
      throw dockerHubError;
    }
  }

  /**
   * Create authenticated headers for API requests
   */
  async createAuthHeaders(registryAuth?: RegistryAuth, scope?: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    let token: string | null = null;

    if (registryAuth) {
      // Private registry authentication
      token = await this.getPrivateRegistryToken(registryAuth, scope);
    } else {
      // Docker Hub authentication
      token = await this.getDockerHubToken(scope);
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Validate credentials by attempting authentication
   */
  async validateCredentials(credentials: AuthCredentials): Promise<boolean> {
    if (credentials.accessToken) {
      // For access tokens, try a simple API call
      try {
        await this.httpClient.get('https://hub.docker.com/v2/user/', {
          headers: {
            Authorization: `JWT ${credentials.accessToken}`,
          },
        });
        return true;
      } catch {
        return false;
      }
    }

    if (credentials.username && credentials.password) {
      try {
        await this.getDockerHubToken();
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Clear cached tokens
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Clear tokens for specific registry
   */
  clearRegistryTokens(registryUrl?: string): void {
    if (!registryUrl) {
      // Clear Docker Hub tokens
      for (const key of this.tokenCache.keys()) {
        if (key.startsWith('dockerhub:')) {
          this.tokenCache.delete(key);
        }
      }
    } else {
      // Clear specific registry tokens
      for (const key of this.tokenCache.keys()) {
        if (key.startsWith(`registry:${registryUrl}:`)) {
          this.tokenCache.delete(key);
        }
      }
    }
  }

  /**
   * Discover authentication endpoint for private registry
   */
  private async discoverAuthEndpoint(registryUrl: string): Promise<string | null> {
    try {
      // Try to get auth info from registry API
      const response = await this.httpClient.get(`${registryUrl}/v2/`, {
        validateStatus: (status) => status === 401, // We expect 401 with auth challenge
      });

      const wwwAuth = response.headers['www-authenticate'];
      if (wwwAuth) {
        // Parse WWW-Authenticate header
        // Example: Bearer realm="https://auth.docker.io/token",service="registry.docker.io"
        const match = wwwAuth.match(/realm="([^"]+)"/);
        if (match) {
          return match[1];
        }
      }

      // Fallback: assume auth endpoint based on registry URL
      const url = new URL(registryUrl);
      return `${url.protocol}//auth.${url.hostname}/token`;
    } catch (error) {
      console.warn(`Failed to discover auth endpoint for ${registryUrl}:`, error);
      return null;
    }
  }

  /**
   * Get token info for debugging
   */
  getTokenInfo(): Record<string, { expiresAt: string; valid: boolean }> {
    const info: Record<string, { expiresAt: string; valid: boolean }> = {};
    
    for (const [key, tokenInfo] of this.tokenCache.entries()) {
      info[key] = {
        expiresAt: new Date(tokenInfo.expiresAt).toISOString(),
        valid: tokenInfo.expiresAt > Date.now(),
      };
    }
    
    return info;
  }
}

// Export singleton instance
export const authManager = new AuthManager();
