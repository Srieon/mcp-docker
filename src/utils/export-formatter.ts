import { ImageConfig, DockerManifest } from '../types.js';

/**
 * Export formatting utilities for various output formats
 */

export interface ExportData {
  repository: string;
  [key: string]: any;
}

export interface DependencyNode {
  name: string;
  version?: string;
  size?: number;
  children?: DependencyNode[];
  metadata?: Record<string, any>;
}

export class ExportFormatter {
  
  /**
   * Convert data to CSV format
   */
  static toCSV(data: ExportData[], columns?: string[]): string {
    if (data.length === 0) {
      return 'No data available\n';
    }

    // Auto-detect columns if not provided
    const detectedColumns = columns || this.detectColumns(data);
    
    // Create CSV header
    const header = detectedColumns.join(',');
    
    // Create CSV rows
    const rows = data.map(item => {
      return detectedColumns.map(column => {
        const value = this.getNestedValue(item, column);
        return this.escapeCSVValue(value);
      }).join(',');
    });
    
    return [header, ...rows].join('\n') + '\n';
  }

  /**
   * Convert batch results to CSV format
   */
  static batchResultsToCSV(results: any[]): string {
    const csvData = results
      .filter(r => r.success !== false)
      .map(result => ({
        repository: result.repository,
        name: result.name || '',
        namespace: result.namespace || '',
        description: this.cleanDescription(result.description || ''),
        stars: result.star_count || 0,
        pulls: result.pull_count || 0,
        last_updated: result.last_updated || '',
        is_official: result.namespace === 'library' ? 'Yes' : 'No',
        is_automated: result.is_automated ? 'Yes' : 'No',
        is_private: result.is_private ? 'Yes' : 'No',
        tag_count: result.tags?.length || 0,
        total_size_bytes: result.manifest?.total_size || 0,
        total_size_formatted: result.manifest?.total_size ? this.formatBytes(result.manifest.total_size) : '',
        layer_count: result.manifest?.layers || 0,
        vulnerability_total: result.vulnerabilities?.total || 0,
        vulnerability_high: result.vulnerabilities?.high || 0,
        vulnerability_medium: result.vulnerabilities?.medium || 0,
        vulnerability_low: result.vulnerabilities?.low || 0,
        scan_available: result.vulnerabilities?.scan_available ? 'Yes' : 'No',
      }));

    const columns = [
      'repository', 'name', 'namespace', 'description', 'stars', 'pulls',
      'last_updated', 'is_official', 'is_automated', 'is_private',
      'tag_count', 'total_size_bytes', 'total_size_formatted', 'layer_count',
      'vulnerability_total', 'vulnerability_high', 'vulnerability_medium',
      'vulnerability_low', 'scan_available'
    ];

    return this.toCSV(csvData, columns);
  }

  /**
   * Convert layer analysis to dependency tree format
   */
  static layersToDependencyTree(
    repository: string,
    manifest: DockerManifest,
    imageConfig: ImageConfig
  ): DependencyNode {
    // Root node represents the image
    const rootNode: DependencyNode = {
      name: repository,
      version: 'latest',
      size: manifest.layers.reduce((sum, layer) => sum + layer.size, 0),
      children: [],
      metadata: {
        type: 'docker-image',
        architecture: imageConfig.architecture,
        os: imageConfig.os,
        total_layers: manifest.layers.length,
        working_dir: imageConfig.config?.WorkingDir || '/',
        exposed_ports: Object.keys(imageConfig.config?.ExposedPorts || {}),
      },
    };

    // Detect base image
    const baseImage = this.detectBaseImage(imageConfig);
    if (baseImage && baseImage !== 'unknown') {
      rootNode.children!.push({
        name: baseImage,
        metadata: {
          type: 'base-image',
          detected: true,
        },
      });
    }

    // Add layer dependencies
    const layerNode: DependencyNode = {
      name: 'layers',
      metadata: {
        type: 'layer-group',
        count: manifest.layers.length,
      },
      children: manifest.layers.map((layer, index) => {
        const historyEntry = imageConfig.history?.[index];
        return {
          name: `layer-${index + 1}`,
          size: layer.size,
          metadata: {
            type: 'layer',
            digest: layer.digest,
            media_type: layer.mediaType,
            instruction: this.extractDockerInstruction(historyEntry?.created_by || ''),
            created_by: historyEntry?.created_by || 'unknown',
            created: historyEntry?.created || null,
            empty_layer: historyEntry?.empty_layer || false,
          },
        };
      }),
    };

    rootNode.children!.push(layerNode);

    // Add environment dependencies
    const envVars = imageConfig.config?.Env || [];
    if (envVars.length > 0) {
      const envNode: DependencyNode = {
        name: 'environment',
        metadata: {
          type: 'environment-group',
          count: envVars.length,
        },
        children: envVars.map(env => {
          const [key, ...valueParts] = env.split('=');
          return {
            name: key,
            version: valueParts.join('='),
            metadata: {
              type: 'environment-variable',
            },
          };
        }),
      };
      rootNode.children!.push(envNode);
    }

    // Add label dependencies
    const labels = imageConfig.config?.Labels || {};
    const labelKeys = Object.keys(labels);
    if (labelKeys.length > 0) {
      const labelNode: DependencyNode = {
        name: 'labels',
        metadata: {
          type: 'label-group',
          count: labelKeys.length,
        },
        children: labelKeys.map(key => ({
          name: key,
          version: labels[key],
          metadata: {
            type: 'label',
          },
        })),
      };
      rootNode.children!.push(labelNode);
    }

    return rootNode;
  }

  /**
   * Convert dependency tree to various formats
   */
  static dependencyTreeToString(node: DependencyNode, indent: string = '', isLast: boolean = true): string {
    const prefix = indent + (isLast ? '└── ' : '├── ');
    const sizeInfo = node.size ? ` (${this.formatBytes(node.size)})` : '';
    const versionInfo = node.version ? `@${node.version}` : '';
    
    let result = `${prefix}${node.name}${versionInfo}${sizeInfo}\n`;
    
    if (node.children && node.children.length > 0) {
      const newIndent = indent + (isLast ? '    ' : '│   ');
      node.children.forEach((child, index) => {
        const childIsLast = index === node.children!.length - 1;
        result += this.dependencyTreeToString(child, newIndent, childIsLast);
      });
    }
    
    return result;
  }

  /**
   * Convert dependency tree to JSON
   */
  static dependencyTreeToJSON(node: DependencyNode): string {
    return JSON.stringify(node, null, 2);
  }

  /**
   * Convert multiple repositories to dependency forest
   */
  static batchToDependencyForest(results: any[]): DependencyNode[] {
    return results
      .filter(r => r.success !== false && r.manifest)
      .map(result => this.layersToDependencyTree(
        result.repository,
        result.manifest,
        result // Using result as imageConfig since it should contain the config data
      ));
  }

  /**
   * Auto-detect columns from data
   */
  private static detectColumns(data: ExportData[]): string[] {
    const columnSet = new Set<string>();
    
    data.forEach(item => {
      this.addKeysRecursively(item, '', columnSet);
    });
    
    return Array.from(columnSet).sort();
  }

  /**
   * Recursively add keys to column set
   */
  private static addKeysRecursively(obj: any, prefix: string, columnSet: Set<string>): void {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        // For nested objects, add both the parent key and recurse
        columnSet.add(fullKey);
        this.addKeysRecursively(obj[key], fullKey, columnSet);
      } else {
        columnSet.add(fullKey);
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : '';
    }, obj);
  }

  /**
   * Escape CSV value
   */
  private static escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains comma, newline, or quote, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Clean description for CSV
   */
  private static cleanDescription(description: string): string {
    return description
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Format bytes to human readable format
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Detect base image from configuration
   */
  private static detectBaseImage(imageConfig: any): string {
    const history = imageConfig.history || [];
    
    // Look for FROM instruction in early history
    for (const entry of history.slice(0, 3)) {
      const createdBy = entry.created_by || '';
      if (createdBy.includes('FROM')) {
        const match = createdBy.match(/FROM\s+([^\s]+)/);
        if (match) return match[1];
      }
    }
    
    // Alpine indicators
    if (history.some((h: any) => h.created_by?.includes('alpine'))) return 'alpine (detected)';
    
    // Ubuntu indicators  
    if (history.some((h: any) => h.created_by?.includes('ubuntu') || h.created_by?.includes('apt-get'))) return 'ubuntu (detected)';
    
    return 'unknown';
  }

  /**
   * Extract Docker instruction from created_by field
   */
  private static extractDockerInstruction(createdBy: string): string {
    const match = createdBy.match(/(?:#\(nop\)\s*)?(\w+)/);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }
}
