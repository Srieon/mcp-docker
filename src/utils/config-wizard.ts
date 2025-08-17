#!/usr/bin/env node

import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import axios from 'axios';

/**
 * Interactive Configuration Wizard for Docker Hub MCP Server
 */

interface WizardConfig {
  dockerhub: {
    username?: string;
    password?: string;
    accessToken?: string;
    useAccessToken: boolean;
  };
  privateRegistry?: {
    url?: string;
    username?: string;
    password?: string;
  };
  server: {
    name: string;
    version: string;
    transport: 'stdio' | 'http';
    httpPort?: number;
    httpHost?: string;
    cors?: boolean;
  };
  cache: {
    ttlSeconds: number;
    maxSize: number;
  };
  performance: {
    rateLimit: number;
    rateLimitWindow: number;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ConfigurationWizard {
  private rl: any;
  private config: WizardConfig;

  constructor() {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.config = {
      dockerhub: {
        useAccessToken: false,
      },
      server: {
        name: 'dockerhub-mcp-server',
        version: '1.0.0',
        transport: 'stdio',
      },
      cache: {
        ttlSeconds: 300,
        maxSize: 1000,
      },
      performance: {
        rateLimit: 100,
        rateLimitWindow: 3600,
      },
      logLevel: 'info',
    };
  }

  /**
   * Run the interactive configuration wizard
   */
  async run(): Promise<void> {
    console.log('🐳 Docker Hub MCP Server Configuration Wizard');
    console.log('='.repeat(50));
    console.log('This wizard will help you set up your Docker Hub MCP server configuration.\n');

    try {
      // Welcome and overview
      await this.showWelcome();

      // Docker Hub authentication
      await this.configureDockerHub();

      // Private registry (optional)
      await this.configurePrivateRegistry();

      // Transport configuration
      await this.configureTransport();

      // Performance tuning
      await this.configurePerformance();

      // Advanced settings
      await this.configureAdvanced();

      // Test configuration
      await this.testConfiguration();

      // Save configuration
      await this.saveConfiguration();

      console.log('\n✅ Configuration wizard completed successfully!');
      console.log('Your .env file has been created. You can now start the MCP server.');

    } catch (error) {
      console.error('\n❌ Configuration wizard failed:', error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Show welcome message and overview
   */
  private async showWelcome(): Promise<void> {
    console.log('This wizard will configure:');
    console.log('  • Docker Hub authentication (optional but recommended)');
    console.log('  • Private registry support (optional)');
    console.log('  • Transport mode (stdio for MCP clients, HTTP for web access)');
    console.log('  • Performance and caching settings');
    console.log('  • Advanced configuration options\n');

    const proceed = await this.question('Do you want to proceed? (y/N): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
      console.log('Configuration wizard cancelled.');
      process.exit(0);
    }
    console.log();
  }

  /**
   * Configure Docker Hub authentication
   */
  private async configureDockerHub(): Promise<void> {
    console.log('📦 Docker Hub Authentication');
    console.log('-'.repeat(30));
    console.log('Docker Hub authentication is optional but recommended for:');
    console.log('  • Higher rate limits (5000 vs 100 requests/hour)');
    console.log('  • Access to private repositories');
    console.log('  • Vulnerability scanning features\n');

    const configureAuth = await this.question('Configure Docker Hub authentication? (Y/n): ');
    if (configureAuth.toLowerCase() === 'n' || configureAuth.toLowerCase() === 'no') {
      console.log('Skipping Docker Hub authentication (anonymous access only).\n');
      return;
    }

    console.log('\nChoose authentication method:');
    console.log('  1. Access Token (recommended for security)');
    console.log('  2. Username and Password');

    const authMethod = await this.question('Select option (1/2): ');

    if (authMethod === '1') {
      this.config.dockerhub.useAccessToken = true;
      console.log('\nTo generate an access token:');
      console.log('  1. Go to https://hub.docker.com/settings/security');
      console.log('  2. Click "New Access Token"');
      console.log('  3. Give it a name and select appropriate permissions');
      console.log('  4. Copy the generated token\n');

      const token = await this.question('Enter your Docker Hub access token: ', true);
      if (token.trim()) {
        this.config.dockerhub.accessToken = token.trim();
      }
    } else {
      console.log('\nNote: Using username/password is less secure than access tokens.\n');
      const username = await this.question('Docker Hub username: ');
      const password = await this.question('Docker Hub password: ', true);
      
      if (username.trim() && password.trim()) {
        this.config.dockerhub.username = username.trim();
        this.config.dockerhub.password = password.trim();
      }
    }
    console.log();
  }

  /**
   * Configure private registry support
   */
  private async configurePrivateRegistry(): Promise<void> {
    console.log('🏢 Private Registry Support');
    console.log('-'.repeat(30));
    
    const configurePrivate = await this.question('Configure a private Docker registry? (y/N): ');
    if (configurePrivate.toLowerCase() !== 'y' && configurePrivate.toLowerCase() !== 'yes') {
      console.log('Skipping private registry configuration.\n');
      return;
    }

    const url = await this.question('Private registry URL (e.g., https://registry.company.com): ');
    if (!url.trim()) {
      console.log('No URL provided, skipping private registry configuration.\n');
      return;
    }

    const username = await this.question('Registry username: ');
    const password = await this.question('Registry password: ', true);

    this.config.privateRegistry = {
      url: url.trim(),
      ...(username.trim() && { username: username.trim() }),
      ...(password.trim() && { password: password.trim() }),
    };
    console.log();
  }

  /**
   * Configure transport mode
   */
  private async configureTransport(): Promise<void> {
    console.log('🚀 Transport Configuration');
    console.log('-'.repeat(30));
    console.log('Choose how the MCP server will communicate:');
    console.log('  1. stdio - For MCP clients (Claude Desktop, Cursor, etc.)');
    console.log('  2. http - For web-based access and testing\n');

    const transport = await this.question('Select transport mode (1/2): ');

    if (transport === '2') {
      this.config.server.transport = 'http';
      
      const host = await this.question('HTTP host (default: localhost): ');
      this.config.server.httpHost = host.trim() || 'localhost';
      
      const port = await this.question('HTTP port (default: 3000): ');
      this.config.server.httpPort = parseInt(port.trim()) || 3000;
      
      const cors = await this.question('Enable CORS for web access? (Y/n): ');
      this.config.server.cors = cors.toLowerCase() !== 'n' && cors.toLowerCase() !== 'no';
      
      console.log(`\nHTTP mode configured:`);
      console.log(`  Server will run on http://${this.config.server.httpHost}:${this.config.server.httpPort}`);
      console.log(`  Health check: http://${this.config.server.httpHost}:${this.config.server.httpPort}/health`);
      console.log(`  MCP endpoint: http://${this.config.server.httpHost}:${this.config.server.httpPort}/message`);
    } else {
      this.config.server.transport = 'stdio';
      console.log('stdio mode configured for MCP client integration.');
    }
    console.log();
  }

  /**
   * Configure performance settings
   */
  private async configurePerformance(): Promise<void> {
    console.log('⚡ Performance Configuration');
    console.log('-'.repeat(30));
    
    const configurePeformance = await this.question('Customize performance settings? (y/N): ');
    if (configurePeformance.toLowerCase() !== 'y' && configurePeformance.toLowerCase() !== 'yes') {
      console.log('Using default performance settings.\n');
      return;
    }

    console.log('\nCache Configuration:');
    const ttl = await this.question(`Cache TTL in seconds (default: ${this.config.cache.ttlSeconds}): `);
    if (ttl.trim()) {
      this.config.cache.ttlSeconds = parseInt(ttl.trim()) || this.config.cache.ttlSeconds;
    }

    const maxSize = await this.question(`Max cache entries (default: ${this.config.cache.maxSize}): `);
    if (maxSize.trim()) {
      this.config.cache.maxSize = parseInt(maxSize.trim()) || this.config.cache.maxSize;
    }

    console.log('\nRate Limiting:');
    const rateLimit = await this.question(`Max requests per hour (default: ${this.config.performance.rateLimit}): `);
    if (rateLimit.trim()) {
      this.config.performance.rateLimit = parseInt(rateLimit.trim()) || this.config.performance.rateLimit;
    }
    console.log();
  }

  /**
   * Configure advanced settings
   */
  private async configureAdvanced(): Promise<void> {
    console.log('🔧 Advanced Configuration');
    console.log('-'.repeat(30));
    
    const configureAdvanced = await this.question('Configure advanced settings? (y/N): ');
    if (configureAdvanced.toLowerCase() !== 'y' && configureAdvanced.toLowerCase() !== 'yes') {
      console.log('Using default advanced settings.\n');
      return;
    }

    console.log('\nLogging Level:');
    console.log('  1. error - Only errors');
    console.log('  2. warn - Warnings and errors');
    console.log('  3. info - General information (recommended)');
    console.log('  4. debug - Detailed debugging information');

    const logLevel = await this.question('Select log level (1-4, default: 3): ');
    const logLevels = ['error', 'warn', 'info', 'debug'];
    const selectedLevel = parseInt(logLevel.trim()) - 1;
    if (selectedLevel >= 0 && selectedLevel < logLevels.length) {
      this.config.logLevel = logLevels[selectedLevel] as any;
    }

    const serverName = await this.question(`Server name (default: ${this.config.server.name}): `);
    if (serverName.trim()) {
      this.config.server.name = serverName.trim();
    }
    console.log();
  }

  /**
   * Test the configuration
   */
  private async testConfiguration(): Promise<void> {
    console.log('🧪 Configuration Testing');
    console.log('-'.repeat(30));
    
    const runTests = await this.question('Test the configuration? (Y/n): ');
    if (runTests.toLowerCase() === 'n' || runTests.toLowerCase() === 'no') {
      console.log('Skipping configuration tests.\n');
      return;
    }

    console.log('Running configuration tests...\n');

    // Test Docker Hub connectivity
    await this.testDockerHubConnectivity();

    // Test private registry if configured
    if (this.config.privateRegistry?.url) {
      await this.testPrivateRegistry();
    }

    console.log('✅ Configuration tests completed.\n');
  }

  /**
   * Test Docker Hub connectivity
   */
  private async testDockerHubConnectivity(): Promise<void> {
    console.log('  • Testing Docker Hub connectivity...');
    
    try {
      const response = await axios.get('https://hub.docker.com/v2/repositories/library/nginx/', {
        timeout: 10000,
      });
      
      if (response.status === 200) {
        console.log('    ✅ Docker Hub is accessible');
      } else {
        console.log('    ⚠️  Docker Hub response unexpected');
      }
    } catch (error) {
      console.log('    ❌ Docker Hub connectivity test failed');
      console.log(`    Error: ${error}`);
    }

    // Test authentication if configured
    if (this.config.dockerhub.accessToken || (this.config.dockerhub.username && this.config.dockerhub.password)) {
      console.log('  • Testing Docker Hub authentication...');
      
      try {
        let authHeaders: any = {};
        
        if (this.config.dockerhub.accessToken) {
          authHeaders['Authorization'] = `JWT ${this.config.dockerhub.accessToken}`;
        }
        
        const response = await axios.get('https://hub.docker.com/v2/user/', {
          headers: authHeaders,
          timeout: 10000,
        });
        
        if (response.status === 200) {
          console.log('    ✅ Docker Hub authentication successful');
        } else {
          console.log('    ⚠️  Docker Hub authentication response unexpected');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.log('    ❌ Docker Hub authentication failed - invalid credentials');
        } else {
          console.log('    ❌ Docker Hub authentication test failed');
          console.log(`    Error: ${error.message}`);
        }
      }
    }
  }

  /**
   * Test private registry connectivity
   */
  private async testPrivateRegistry(): Promise<void> {
    if (!this.config.privateRegistry?.url) return;

    console.log('  • Testing private registry connectivity...');
    
    try {
      const response = await axios.get(`${this.config.privateRegistry.url}/v2/`, {
        timeout: 10000,
        validateStatus: (status) => status === 200 || status === 401, // 401 is expected for auth challenge
      });
      
      if (response.status === 200 || response.status === 401) {
        console.log('    ✅ Private registry is accessible');
      } else {
        console.log('    ⚠️  Private registry response unexpected');
      }
    } catch (error) {
      console.log('    ❌ Private registry connectivity test failed');
      console.log(`    Error: ${error}`);
    }
  }

  /**
   * Save configuration to .env file
   */
  private async saveConfiguration(): Promise<void> {
    console.log('💾 Saving Configuration');
    console.log('-'.repeat(30));

    const envPath = resolve(process.cwd(), '.env');
    const backupPath = resolve(process.cwd(), '.env.backup');

    // Check if .env already exists
    if (existsSync(envPath)) {
      const overwrite = await this.question('.env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Configuration not saved. Exiting.');
        return;
      }

      // Create backup
      try {
        const fs = require('fs');
        fs.copyFileSync(envPath, backupPath);
        console.log(`Backup created: ${backupPath}`);
      } catch (error) {
        console.log('Warning: Could not create backup of existing .env file');
      }
    }

    // Generate .env content
    const envContent = this.generateEnvContent();

    try {
      writeFileSync(envPath, envContent);
      console.log(`✅ Configuration saved to ${envPath}`);
      
      // Show next steps
      console.log('\nNext steps:');
      console.log('  1. Review the generated .env file');
      console.log('  2. Install dependencies: npm install');
      console.log('  3. Build the project: npm run build');
      
      if (this.config.server.transport === 'stdio') {
        console.log('  4. Add to your MCP client configuration');
        console.log('  5. Start the server: npm start');
      } else {
        console.log('  4. Start the server: npm start');
        console.log(`  5. Access the server at http://${this.config.server.httpHost}:${this.config.server.httpPort}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to save configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Generate .env file content
   */
  private generateEnvContent(): string {
    const lines: string[] = [];
    
    lines.push('# Docker Hub MCP Server Configuration');
    lines.push('# Generated by Configuration Wizard');
    lines.push(`# Created: ${new Date().toISOString()}`);
    lines.push('');

    // Docker Hub Authentication
    lines.push('# Docker Hub Authentication');
    if (this.config.dockerhub.accessToken) {
      lines.push(`DOCKERHUB_ACCESS_TOKEN=${this.config.dockerhub.accessToken}`);
      lines.push('# DOCKERHUB_USERNAME=');
      lines.push('# DOCKERHUB_PASSWORD=');
    } else if (this.config.dockerhub.username && this.config.dockerhub.password) {
      lines.push(`DOCKERHUB_USERNAME=${this.config.dockerhub.username}`);
      lines.push(`DOCKERHUB_PASSWORD=${this.config.dockerhub.password}`);
      lines.push('# DOCKERHUB_ACCESS_TOKEN=');
    } else {
      lines.push('# DOCKERHUB_USERNAME=your_dockerhub_username');
      lines.push('# DOCKERHUB_PASSWORD=your_dockerhub_password');
      lines.push('# DOCKERHUB_ACCESS_TOKEN=your_dockerhub_access_token');
    }
    lines.push('');

    // Private Registry
    if (this.config.privateRegistry?.url) {
      lines.push('# Private Registry Configuration');
      lines.push(`PRIVATE_REGISTRY_URL=${this.config.privateRegistry.url}`);
      if (this.config.privateRegistry.username) {
        lines.push(`PRIVATE_REGISTRY_USERNAME=${this.config.privateRegistry.username}`);
      }
      if (this.config.privateRegistry.password) {
        lines.push(`PRIVATE_REGISTRY_PASSWORD=${this.config.privateRegistry.password}`);
      }
      lines.push('');
    }

    // Server Configuration
    lines.push('# Server Configuration');
    lines.push(`MCP_SERVER_NAME=${this.config.server.name}`);
    lines.push(`MCP_SERVER_VERSION=${this.config.server.version}`);
    lines.push('');

    // Transport Configuration
    lines.push('# Transport Configuration');
    lines.push(`MCP_TRANSPORT=${this.config.server.transport}`);
    if (this.config.server.transport === 'http') {
      lines.push(`MCP_HTTP_HOST=${this.config.server.httpHost}`);
      lines.push(`MCP_HTTP_PORT=${this.config.server.httpPort}`);
      lines.push(`MCP_CORS=${this.config.server.cors}`);
    } else {
      lines.push('# MCP_HTTP_HOST=localhost');
      lines.push('# MCP_HTTP_PORT=3000');
      lines.push('# MCP_CORS=true');
    }
    lines.push('');

    // Cache Configuration
    lines.push('# Cache Configuration');
    lines.push(`CACHE_TTL_SECONDS=${this.config.cache.ttlSeconds}`);
    lines.push(`MAX_CACHE_SIZE=${this.config.cache.maxSize}`);
    lines.push('');

    // Rate Limiting
    lines.push('# Rate Limiting');
    lines.push(`DOCKERHUB_RATE_LIMIT=${this.config.performance.rateLimit}`);
    lines.push(`DOCKERHUB_RATE_LIMIT_WINDOW=${this.config.performance.rateLimitWindow}`);
    lines.push('');

    // Logging
    lines.push('# Logging');
    lines.push(`LOG_LEVEL=${this.config.logLevel}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Ask a question and return the answer
   */
  private question(prompt: string, isPassword: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      if (isPassword) {
        // Simple password masking (not perfect but better than plain text)
        const stdin = process.stdin;
        const stdout = process.stdout;
        
        stdout.write(prompt);
        
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        
        let password = '';
        
        const onData = (char: string) => {
          char = char.toString();
          
          switch (char) {
            case '\n':
            case '\r':
            case '\u0004': // Ctrl+D
              stdin.setRawMode(false);
              stdin.pause();
              stdin.removeListener('data', onData);
              stdout.write('\n');
              resolve(password);
              break;
            case '\u0003': // Ctrl+C
              process.exit(0);
              break;
            case '\u007f': // Backspace
              if (password.length > 0) {
                password = password.slice(0, -1);
                stdout.write('\b \b');
              }
              break;
            default:
              password += char;
              stdout.write('*');
              break;
          }
        };
        
        stdin.on('data', onData);
      } else {
        this.rl.question(prompt, resolve);
      }
    });
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const wizard = new ConfigurationWizard();
  wizard.run().catch((error) => {
    console.error('Configuration wizard failed:', error);
    process.exit(1);
  });
}
