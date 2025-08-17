# API Documentation

This document provides comprehensive documentation for all MCP tools available in the Docker Hub MCP Server.

## Tool Categories

- [Core Tools](#core-tools) - Essential Docker Hub operations
- [Analysis Tools](#analysis-tools) - Deep image analysis and comparison  
- [Bonus Tools](#bonus-tools) - Advanced features like security scanning

---

## Core Tools

### docker_search_images

Search Docker Hub for images with advanced filtering capabilities.

**Parameters:**
- `query` (string, required): Search query for Docker images
- `limit` (number, optional): Number of results to return (1-100, default: 25)
- `page` (number, optional): Page number for pagination (default: 1)
- `is_official` (boolean, optional): Filter for official images only
- `is_automated` (boolean, optional): Filter for automated builds only

**Example:**
```json
{
  "tool": "docker_search_images",
  "arguments": {
    "query": "nginx",
    "limit": 10,
    "is_official": true
  }
}
```

**Response Structure:**
```json
{
  "query": "nginx",
  "total_count": 50000,
  "page": 1,
  "page_size": 10,
  "results": [
    {
      "name": "nginx",
      "description": "Official build of Nginx",
      "stars": 15000,
      "pulls": 1000000000,
      "owner": "_",
      "is_official": true,
      "is_automated": false,
      "last_updated": "2024-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "total_results": 50000,
    "official_images": 5,
    "automated_builds": 3,
    "average_stars": 1500
  }
}
```

---

### docker_get_image_details

Get comprehensive details about a Docker repository including statistics and metadata.

**Parameters:**
- `repository` (string, required): Repository name (e.g., "library/nginx" or "user/repo")

**Example:**
```json
{
  "tool": "docker_get_image_details", 
  "arguments": {
    "repository": "library/nginx"
  }
}
```

**Response Structure:**
```json
{
  "repository": {
    "name": "nginx",
    "namespace": "library",
    "full_name": "library/nginx",
    "description": "Official build of Nginx",
    "short_description": "Official build of Nginx"
  },
  "metadata": {
    "is_private": false,
    "is_automated": false,
    "is_official": true,
    "repository_type": "image"
  },
  "statistics": {
    "star_count": 15000,
    "pull_count": 1000000000,
    "total_tags": 50
  },
  "dates": {
    "last_updated": "2024-01-15T10:30:00Z",
    "date_registered": "2015-06-01T00:00:00Z"
  },
  "popular_tags": [
    {
      "name": "latest",
      "size": 142000000,
      "last_pulled": "2024-01-15T12:00:00Z",
      "architectures": ["amd64", "arm64"]
    }
  ]
}
```

---

### docker_list_tags

List all available tags for a Docker repository with detailed metadata.

**Parameters:**
- `repository` (string, required): Repository name
- `limit` (number, optional): Number of tags to return (1-100, default: 25)
- `page` (number, optional): Page number for pagination (default: 1)

**Example:**
```json
{
  "tool": "docker_list_tags",
  "arguments": {
    "repository": "library/nginx",
    "limit": 5
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/nginx",
  "pagination": {
    "page": 1,
    "page_size": 5,
    "total_count": 50,
    "has_next": true
  },
  "tags": [
    {
      "name": "latest",
      "size": {
        "full_size": 142000000,
        "formatted_size": "135.42 MB"
      },
      "timestamps": {
        "last_pushed": "2024-01-15T10:30:00Z",
        "last_pulled": "2024-01-15T12:00:00Z",
        "last_pushed_relative": "2 hours ago"
      },
      "platforms": {
        "architectures": ["amd64", "arm64", "arm/v7"],
        "operating_systems": ["linux"],
        "total_variants": 3
      },
      "images": [
        {
          "architecture": "amd64",
          "os": "linux", 
          "size": 142000000,
          "digest": "sha256:abc123..."
        }
      ]
    }
  ]
}
```

---

### docker_get_manifest

Retrieve Docker image manifest containing detailed layer information.

**Parameters:**
- `repository` (string, required): Repository name
- `tag` (string, optional): Image tag (default: "latest")

**Example:**
```json
{
  "tool": "docker_get_manifest",
  "arguments": {
    "repository": "library/alpine",
    "tag": "3.18"
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/alpine",
  "tag": "3.18",
  "manifest": {
    "schema_version": 2,
    "media_type": "application/vnd.docker.distribution.manifest.v2+json"
  },
  "config": {
    "media_type": "application/vnd.docker.container.image.v1+json",
    "size": 1469,
    "digest": "sha256:abc123..."
  },
  "layers": {
    "total_layers": 1,
    "total_size": 7300000,
    "formatted_total_size": "6.96 MB",
    "details": [
      {
        "index": 0,
        "digest": "sha256:def456...",
        "size": 7300000,
        "formatted_size": "6.96 MB",
        "media_type": "application/vnd.docker.image.rootfs.diff.tar.gzip",
        "percentage_of_total": "100.00"
      }
    ]
  },
  "recommendations": [
    "Very compact image - good for microservices"
  ]
}
```

---

## Analysis Tools

### docker_analyze_layers

Analyze image layers to understand composition and identify optimization opportunities.

**Parameters:**
- `repository` (string, required): Repository name
- `tag` (string, optional): Image tag (default: "latest")

**Example:**
```json
{
  "tool": "docker_analyze_layers",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine"
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/node",
  "tag": "18-alpine",
  "summary": {
    "total_layers": 8,
    "total_size": 170000000,
    "formatted_total_size": "162.12 MB",
    "empty_layers": 4,
    "data_layers": 4
  },
  "layers": [
    {
      "index": 0,
      "digest": "sha256:abc123...",
      "size": 7300000,
      "instruction": "FROM",
      "created_by": "/bin/sh -c #(nop) ADD file:abc123... in /",
      "empty_layer": false
    }
  ],
  "analysis": {
    "instruction_distribution": {
      "RUN": 3,
      "COPY": 2,
      "FROM": 1
    },
    "base_image": "alpine:3.18",
    "architecture": "amd64",
    "os": "linux"
  },
  "optimizations": [
    "Consider combining 3 RUN instructions to reduce layer count",
    "Layer structure appears well-optimized"
  ]
}
```

---

### docker_compare_images

Compare two Docker images for differences in layers, sizes, and composition.

**Parameters:**
- `repository1` (string, required): First repository name
- `tag1` (string, optional): First image tag (default: "latest")
- `repository2` (string, required): Second repository name
- `tag2` (string, optional): Second image tag (default: "latest")

**Example:**
```json
{
  "tool": "docker_compare_images",
  "arguments": {
    "repository1": "library/node",
    "tag1": "18-alpine",
    "repository2": "library/node",
    "tag2": "18-slim"
  }
}
```

**Response Structure:**
```json
{
  "comparison_summary": {
    "image1": {
      "repository": "library/node",
      "tag": "18-alpine",
      "size": 170000000,
      "layers": 8,
      "base_image": "alpine:3.18"
    },
    "image2": {
      "repository": "library/node", 
      "tag": "18-slim",
      "size": 240000000,
      "layers": 12,
      "base_image": "debian:bullseye-slim"
    },
    "differences": {
      "size_difference": 70000000,
      "size_difference_percentage": 41.18,
      "layer_count_difference": 4,
      "same_base_image": false,
      "winner": "image1_smaller"
    }
  },
  "layer_analysis": {
    "common_layers": 2,
    "unique_to_image1": 6,
    "unique_to_image2": 10,
    "layer_similarity_percentage": "16.67"
  },
  "recommendations": [
    "Alpine-based image is significantly smaller (70MB difference)",
    "Consider using the first image as a base if functionality allows",
    "Images share very few layers - consider using a common base image"
  ]
}
```

---

### docker_get_dockerfile

Attempt to retrieve Dockerfile content for a Docker image.

**Parameters:**
- `repository` (string, required): Repository name
- `tag` (string, optional): Image tag (default: "latest")

**Example:**
```json
{
  "tool": "docker_get_dockerfile",
  "arguments": {
    "repository": "library/nginx",
    "tag": "alpine"
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/nginx",
  "tag": "alpine",
  "dockerfile_available": false,
  "is_automated_build": false,
  "message": "This is not an automated build, so Dockerfile content is not available",
  "reconstructed_dockerfile": "# Reconstructed Dockerfile (estimated)\nFROM alpine:3.18\nRUN apk add --no-cache nginx\nEXPOSE 80\nCMD [\"nginx\", \"-g\", \"daemon off;\"]",
  "reconstruction_confidence": "medium",
  "alternative_suggestions": [
    "Check the repository's source code if it's linked to GitHub/Bitbucket",
    "Look for Dockerfile in the project's version control system"
  ]
}
```

---

### docker_get_stats

Get comprehensive statistics and popularity metrics for a Docker repository.

**Parameters:**
- `repository` (string, required): Repository name

**Example:**
```json
{
  "tool": "docker_get_stats",
  "arguments": {
    "repository": "library/nginx"
  }
}
```

**Response Structure:**
```json
{
  "repository": {
    "name": "nginx",
    "namespace": "library",
    "full_name": "library/nginx"
  },
  "basic_stats": {
    "pull_count": 1000000000,
    "star_count": 15000,
    "total_tags": 50,
    "is_official": true
  },
  "popularity_metrics": {
    "popularity_score": 95,
    "popularity_rank": "Very High",
    "stars_per_day": 10.5,
    "pulls_per_day": 500000,
    "engagement_ratio": 0.000015
  },
  "usage_analysis": {
    "total_downloads": 1000000000,
    "formatted_downloads": "1.0B",
    "estimated_daily_downloads": 500000,
    "usage_intensity": "Utility-Focused Usage"
  },
  "insights": [
    "High daily usage with approximately 500K pulls per day",
    "Utility-focused image with high usage but limited community recognition"
  ],
  "recommendations": [
    "Official image - generally safe choice for production use",
    "High usage indicates community trust and stability"
  ]
}
```

---

## Bonus Tools

### docker_get_vulnerabilities

Retrieve security vulnerability scan results for a Docker image.

**Parameters:**
- `repository` (string, required): Repository name
- `tag` (string, optional): Image tag (default: "latest")

**Example:**
```json
{
  "tool": "docker_get_vulnerabilities",
  "arguments": {
    "repository": "library/ubuntu",
    "tag": "20.04"
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/ubuntu",
  "tag": "20.04",
  "scan_available": true,
  "scan_summary": {
    "total_vulnerabilities": 25,
    "critical": 2,
    "high": 5,
    "medium": 15,
    "low": 3
  },
  "risk_assessment": {
    "overall_risk": "Medium",
    "risk_score": 45,
    "production_ready": true,
    "key_concerns": [
      "5 high severity vulnerabilities found"
    ]
  },
  "vulnerability_breakdown": {
    "top_vulnerabilities": [
      {
        "id": "CVE-2023-1234",
        "title": "Buffer overflow in libssl",
        "severity": "high",
        "package": "libssl1.1",
        "current_version": "1.1.1f-1ubuntu2",
        "fix_version": "1.1.1f-1ubuntu2.19"
      }
    ],
    "affected_packages": [
      {
        "package_name": "libssl1.1",
        "vulnerability_count": 3,
        "highest_severity": "high",
        "fixable_ratio": "100.0%"
      }
    ]
  },
  "recommendations": [
    "Address all high severity vulnerabilities before production use",
    "Most vulnerabilities have fixes available - update affected packages"
  ]
}
```

---

### docker_get_image_history

Retrieve detailed build history and layer creation timeline.

**Parameters:**
- `repository` (string, required): Repository name
- `tag` (string, optional): Image tag (default: "latest")

**Example:**
```json
{
  "tool": "docker_get_image_history",
  "arguments": {
    "repository": "library/python",
    "tag": "3.11-slim"
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/python",
  "tag": "3.11-slim",
  "image_info": {
    "architecture": "amd64",
    "os": "linux",
    "total_layers": 8,
    "total_history_entries": 12
  },
  "build_history": {
    "total_steps": 12,
    "total_size": 125000000,
    "formatted_total_size": "119.21 MB",
    "build_duration_estimate": "15 minutes",
    "empty_layers": 4,
    "data_layers": 8
  },
  "detailed_history": [
    {
      "step": 1,
      "created": "2024-01-10T08:00:00Z",
      "instruction": "FROM",
      "command": "/bin/sh -c #(nop) ADD file:abc123... in /",
      "size": 80000000,
      "formatted_size": "76.29 MB",
      "empty_layer": false
    }
  ],
  "build_analysis": {
    "base_image": {
      "name": "debian:bullseye-slim",
      "confidence": "high"
    },
    "instruction_distribution": {
      "RUN": 5,
      "COPY": 2,
      "ENV": 3
    },
    "complexity_indicators": {
      "build_complexity": "Medium"
    }
  },
  "dockerfile_reconstruction": {
    "dockerfile": "FROM debian:bullseye-slim\nRUN apt-get update...",
    "confidence": "high",
    "total_lines": 25
  },
  "optimization_insights": [
    "Build history appears reasonably optimized"
  ]
}
```

---

### docker_estimate_pull_size

Calculate estimated download size for pulling a Docker image.

**Parameters:**
- `repository` (string, required): Repository name
- `tag` (string, optional): Image tag (default: "latest")
- `architecture` (string, optional): Target architecture (default: "amd64")

**Example:**
```json
{
  "tool": "docker_estimate_pull_size",
  "arguments": {
    "repository": "library/node",
    "tag": "18-alpine",
    "architecture": "amd64"
  }
}
```

**Response Structure:**
```json
{
  "repository": "library/node",
  "tag": "18-alpine",
  "architecture": "amd64",
  "size_breakdown": {
    "manifest_size": 170000000,
    "compressed_size": 119000000,
    "uncompressed_size": 170000000,
    "architecture_specific_size": 170000000
  },
  "download_estimates": {
    "best_case_scenario": {
      "size": 17000000,
      "formatted_size": "16.21 MB",
      "description": "All layers already cached locally"
    },
    "typical_scenario": {
      "size": 71400000,
      "formatted_size": "68.08 MB", 
      "description": "Some common base layers cached"
    },
    "worst_case_scenario": {
      "size": 119000000,
      "formatted_size": "113.49 MB",
      "description": "No layers cached, fresh download"
    }
  },
  "layer_analysis": {
    "total_layers": 8,
    "potentially_cached_layers": 3,
    "largest_layers": [
      {
        "index": 2,
        "size": 45000000,
        "formatted_size": "42.91 MB",
        "percentage_of_total": "26.47%"
      }
    ]
  },
  "bandwidth_requirements": {
    "size_scenarios": [
      {
        "scenario": "Typical",
        "download_times": [
          {
            "connection": "Broadband (10 Mbps)",
            "time_seconds": 57,
            "formatted_time": "57s"
          },
          {
            "connection": "Fiber (1 Gbps)",
            "time_seconds": 1,
            "formatted_time": "1s"
          }
        ]
      }
    ]
  },
  "optimization_insights": {
    "compression_ratio": 0.7,
    "deduplication_savings": 51000000,
    "recommendations": [
      "Image size is reasonable for most network connections",
      "Pre-pull common base images to reduce download time"
    ]
  }
}
```

---

## Error Handling

All tools return standardized error responses when issues occur:

```json
{
  "error": {
    "type": "AuthenticationError",
    "message": "Authentication failed. Please check your Docker Hub credentials.",
    "code": 401,
    "details": "Invalid username or password"
  },
  "suggestions": [
    "Verify credentials in .env file",
    "Check if 2FA is enabled (use access token instead)",
    "Ensure proper permissions for private repositories"
  ]
}
```

Common error types:
- `AuthenticationError`: Invalid credentials
- `RateLimitError`: API rate limit exceeded
- `NotFoundError`: Repository or tag not found
- `NetworkError`: Connection issues
- `ValidationError`: Invalid parameters

## Rate Limiting

The server automatically handles Docker Hub API rate limits:
- **Anonymous**: 100 requests per hour
- **Authenticated**: 200 requests per hour
- **Pro/Team**: Higher limits based on subscription

The server implements intelligent backoff and queuing to handle rate limits gracefully.
