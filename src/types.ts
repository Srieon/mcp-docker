import { z } from 'zod';

// Configuration schemas
export const ConfigSchema = z.object({
  dockerhub: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    accessToken: z.string().optional(),
    rateLimit: z.number().default(100),
    rateLimitWindow: z.number().default(3600),
  }),
  privateRegistry: z.object({
    url: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  cache: z.object({
    ttlSeconds: z.number().default(300),
    maxSize: z.number().default(1000),
  }),
  server: z.object({
    name: z.string().default('dockerhub-mcp-server'),
    version: z.string().default('1.0.0'),
    transport: z.enum(['stdio', 'http']).default('stdio'),
    httpPort: z.number().default(3000),
    httpHost: z.string().default('localhost'),
    cors: z.boolean().default(true),
  }),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

// Docker Hub API response types
export interface DockerHubImage {
  name: string;
  description: string;
  star_count: number;
  pull_count: number;
  repo_owner: string;
  is_automated: boolean;
  is_official: boolean;
  is_trusted: boolean;
  last_updated: string;
  short_description: string;
}

export interface DockerHubSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DockerHubImage[];
}

export interface DockerHubRepository {
  user: string;
  name: string;
  namespace: string;
  repository_type: string;
  status: number;
  description: string;
  is_private: boolean;
  is_automated: boolean;
  can_edit: boolean;
  star_count: number;
  pull_count: number;
  last_updated: string;
  date_registered: string;
  affiliation: string | null;
  media_types: string[];
  content_types: string[];
  categories: string[];
}

export interface DockerHubTag {
  name: string;
  full_size: number;
  v2: boolean;
  tag_status: string;
  tag_last_pulled: string;
  tag_last_pushed: string;
  media_type: string;
  content_type: string;
  digest: string;
  images: Array<{
    architecture: string;
    features: string;
    variant: string | null;
    digest: string;
    os: string;
    os_features: string;
    os_version: string | null;
    size: number;
    status: string;
    last_pulled: string;
    last_pushed: string;
  }>;
}

export interface DockerHubTagsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DockerHubTag[];
}

export interface DockerManifest {
  schemaVersion: number;
  mediaType: string;
  config: {
    mediaType: string;
    size: number;
    digest: string;
  };
  layers: Array<{
    mediaType: string;
    size: number;
    digest: string;
  }>;
}

export interface ImageLayer {
  digest: string;
  size: number;
  mediaType: string;
  instruction?: string;
  created_by?: string;
}

export interface ImageHistory {
  created: string;
  created_by: string;
  size: number;
  comment?: string;
  empty_layer?: boolean;
}

export interface ImageConfig {
  architecture: string;
  os: string;
  config: {
    Env: string[];
    Cmd: string[];
    WorkingDir: string;
    ExposedPorts: Record<string, {}>;
    Labels: Record<string, string>;
  };
  rootfs: {
    type: string;
    diff_ids: string[];
  };
  history: ImageHistory[];
}

export interface VulnerabilityReport {
  namespace: string;
  repository: string;
  tag: string;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  vulnerabilities: Array<{
    id: string;
    severity: 'high' | 'medium' | 'low' | 'unknown';
    title: string;
    description: string;
    package_name: string;
    package_version: string;
    fix_version?: string;
    link?: string;
  }>;
}

export interface ImageComparison {
  image1: {
    name: string;
    tag: string;
    size: number;
    layers: number;
  };
  image2: {
    name: string;
    tag: string;
    size: number;
    layers: number;
  };
  size_difference: number;
  size_difference_percentage: number;
  common_layers: number;
  unique_layers_image1: number;
  unique_layers_image2: number;
  base_image_same: boolean;
  recommendations: string[];
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Rate limiting types
export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

// Authentication types
export interface AuthCredentials {
  username?: string;
  password?: string;
  accessToken?: string;
}

export interface RegistryAuth {
  url: string;
  credentials: AuthCredentials;
}

// Error types
export class DockerHubError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'DockerHubError';
  }
}

export class RateLimitError extends DockerHubError {
  constructor(
    message: string,
    public resetTime: number
  ) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends DockerHubError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

// MCP Tool argument schemas
export const SearchImagesArgsSchema = z.object({
  query: z.string().describe('Search query for Docker images'),
  limit: z.number().min(1).max(100).default(25).describe('Number of results to return'),
  page: z.number().min(1).default(1).describe('Page number for pagination'),
  is_official: z.boolean().optional().describe('Filter for official images only'),
  is_automated: z.boolean().optional().describe('Filter for automated builds only'),
});

export const GetImageDetailsArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
});

export const ListTagsArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  limit: z.number().min(1).max(100).default(25).describe('Number of tags to return'),
  page: z.number().min(1).default(1).describe('Page number for pagination'),
});

export const GetManifestArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  tag: z.string().default('latest').describe('Image tag'),
});

export const AnalyzeLayersArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  tag: z.string().default('latest').describe('Image tag'),
});

export const CompareImagesArgsSchema = z.object({
  repository1: z.string().describe('First repository name'),
  tag1: z.string().default('latest').describe('First image tag'),
  repository2: z.string().describe('Second repository name'),
  tag2: z.string().default('latest').describe('Second image tag'),
});

export const GetDockerfileArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  tag: z.string().default('latest').describe('Image tag'),
});

export const GetStatsArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
});

export const GetVulnerabilitiesArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  tag: z.string().default('latest').describe('Image tag'),
});

export const GetImageHistoryArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  tag: z.string().default('latest').describe('Image tag'),
});

export const EstimatePullSizeArgsSchema = z.object({
  repository: z.string().describe('Repository name (e.g., "library/nginx" or "user/repo")'),
  tag: z.string().default('latest').describe('Image tag'),
  architecture: z.string().default('amd64').describe('Target architecture'),
});

export type SearchImagesArgs = z.infer<typeof SearchImagesArgsSchema>;
export type GetImageDetailsArgs = z.infer<typeof GetImageDetailsArgsSchema>;
export type ListTagsArgs = z.infer<typeof ListTagsArgsSchema>;
export type GetManifestArgs = z.infer<typeof GetManifestArgsSchema>;
export type AnalyzeLayersArgs = z.infer<typeof AnalyzeLayersArgsSchema>;
export type CompareImagesArgs = z.infer<typeof CompareImagesArgsSchema>;
export type GetDockerfileArgs = z.infer<typeof GetDockerfileArgsSchema>;
export type GetStatsArgs = z.infer<typeof GetStatsArgsSchema>;
export type GetVulnerabilitiesArgs = z.infer<typeof GetVulnerabilitiesArgsSchema>;
export type GetImageHistoryArgs = z.infer<typeof GetImageHistoryArgsSchema>;
export type EstimatePullSizeArgs = z.infer<typeof EstimatePullSizeArgsSchema>;
