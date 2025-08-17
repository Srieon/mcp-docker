import { MCPTool } from './index.js';
import { GetDockerfileArgs, GetDockerfileArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Attempt to retrieve Dockerfile content for an image
 */
export const getDockerfileTool: MCPTool<GetDockerfileArgs> = {
  name: 'docker_get_dockerfile',
  description: 'Attempt to retrieve the Dockerfile content for a Docker image. Note: This is only available for automated builds and may not be accessible for all repositories.',
  inputSchema: GetDockerfileArgsSchema,
  
  async execute(args: GetDockerfileArgs) {
    const { repository, tag } = args;

    // First check if the repository exists and get basic info
    const repoDetails = await dockerHubClient.getRepositoryDetails(repository);
    
    // Try to get Dockerfile content
    const dockerfileContent = await dockerHubClient.getDockerfile(repository, tag);
    
    if (!dockerfileContent) {
      // If no Dockerfile available, try to reconstruct from image history
      const reconstructed = await reconstructDockerfileFromHistory(repository, tag);
      
      return {
        repository,
        tag,
        dockerfile_available: false,
        is_automated_build: repoDetails.is_automated,
        message: repoDetails.is_automated 
          ? 'Dockerfile content is not publicly available for this automated build'
          : 'This is not an automated build, so Dockerfile content is not available',
        reconstructed_dockerfile: reconstructed.dockerfile,
        reconstruction_confidence: reconstructed.confidence,
        reconstruction_notes: reconstructed.notes,
        alternative_suggestions: [
          'Check the repository\'s source code if it\'s linked to GitHub/Bitbucket',
          'Look for Dockerfile in the project\'s version control system',
          'Check the repository description for build instructions',
          'Use image analysis tools to understand layer composition',
        ],
      };
    }

    // Parse and analyze the Dockerfile
    const analysis = analyzeDockerfile(dockerfileContent);

    return {
      repository,
      tag,
      dockerfile_available: true,
      is_automated_build: repoDetails.is_automated,
      dockerfile_content: dockerfileContent,
      analysis,
      metadata: {
        content_length: dockerfileContent.length,
        line_count: dockerfileContent.split('\n').length,
        estimated_complexity: analysis.complexity_score,
      },
      recommendations: generateDockerfileRecommendations(analysis),
    };
  },
};

/**
 * Attempt to reconstruct Dockerfile from image history
 */
async function reconstructDockerfileFromHistory(repository: string, tag: string): Promise<{
  dockerfile: string;
  confidence: 'low' | 'medium' | 'high';
  notes: string[];
}> {
  try {
    const imageConfig = await dockerHubClient.getImageConfig(repository, tag);
    const history = imageConfig.history || [];
    
    const dockerfileLines: string[] = [];
    const notes: string[] = [];
    let confidence: 'low' | 'medium' | 'high' = 'low';
    
    // Try to detect base image
    const baseImage = detectBaseImageFromHistory(history);
    if (baseImage) {
      dockerfileLines.push(`# Reconstructed Dockerfile (estimated)`);
      dockerfileLines.push(`FROM ${baseImage}`);
      dockerfileLines.push('');
      confidence = 'medium';
    } else {
      dockerfileLines.push('# Unable to determine base image');
      notes.push('Base image could not be determined from history');
    }
    
    // Process history entries
    for (const entry of history) {
      const createdBy = entry.created_by || '';
      
      // Skip empty layers
      if (entry.empty_layer) continue;
      
      // Try to extract meaningful commands
      const instruction = extractInstructionFromHistory(createdBy);
      if (instruction) {
        dockerfileLines.push(instruction);
        
        // Increase confidence if we can extract clear instructions
        if (instruction.startsWith('RUN') || instruction.startsWith('COPY') || instruction.startsWith('ENV')) {
          confidence = 'medium';
        }
      } else {
        dockerfileLines.push(`# Unknown instruction: ${createdBy.slice(0, 80)}...`);
      }
    }
    
    // Add image config information
    if (imageConfig.config) {
      const config = imageConfig.config;
      
      if (config.WorkingDir && config.WorkingDir !== '/') {
        dockerfileLines.push(`WORKDIR ${config.WorkingDir}`);
      }
      
      if (config.Env && config.Env.length > 0) {
        dockerfileLines.push('# Environment variables:');
        config.Env.forEach(env => {
          dockerfileLines.push(`ENV ${env}`);
        });
      }
      
      if (config.ExposedPorts && Object.keys(config.ExposedPorts).length > 0) {
        const ports = Object.keys(config.ExposedPorts);
        dockerfileLines.push(`EXPOSE ${ports.join(' ')}`);
      }
      
      if (config.Cmd && config.Cmd.length > 0) {
        dockerfileLines.push(`CMD ${JSON.stringify(config.Cmd)}`);
      }
    }
    
    if (dockerfileLines.length > 3) { // More than just comments and FROM
      confidence = confidence === 'low' ? 'medium' : 'high';
    }
    
    notes.push(`Reconstructed from ${history.length} history entries`);
    notes.push('This is an estimation and may not reflect the actual Dockerfile used');
    
    return {
      dockerfile: dockerfileLines.join('\n'),
      confidence,
      notes,
    };
    
  } catch (error) {
    return {
      dockerfile: '# Unable to reconstruct Dockerfile from image history',
      confidence: 'low',
      notes: ['Failed to access image configuration for reconstruction'],
    };
  }
}

/**
 * Detect base image from history entries
 */
function detectBaseImageFromHistory(history: any[]): string | null {
  for (const entry of history.slice(0, 5)) {
    const createdBy = entry.created_by || '';
    
    if (createdBy.includes('FROM')) {
      const match = createdBy.match(/FROM\s+([^\s]+)/);
      if (match) return match[1];
    }
    
    // Common base image indicators
    if (createdBy.includes('alpine')) return 'alpine';
    if (createdBy.includes('ubuntu')) return 'ubuntu';
    if (createdBy.includes('debian')) return 'debian';
    if (createdBy.includes('centos')) return 'centos';
    if (createdBy.includes('node:')) return 'node';
    if (createdBy.includes('python:')) return 'python';
  }
  
  return null;
}

/**
 * Extract Dockerfile instruction from history entry
 */
function extractInstructionFromHistory(createdBy: string): string | null {
  // Handle nop instructions
  if (createdBy.includes('#(nop)')) {
    const match = createdBy.match(/#\(nop\)\s*(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Handle shell commands
  if (createdBy.startsWith('/bin/sh -c')) {
    const command = createdBy.replace('/bin/sh -c', '').trim();
    if (command && !command.includes('#(nop)')) {
      return `RUN ${command}`;
    }
  }
  
  // Handle direct instructions
  const instructionPattern = /^(FROM|RUN|COPY|ADD|ENV|EXPOSE|WORKDIR|USER|VOLUME|CMD|ENTRYPOINT)\s+(.+)/i;
  const match = createdBy.match(instructionPattern);
  if (match) {
    return `${match[1].toUpperCase()} ${match[2]}`;
  }
  
  return null;
}

/**
 * Analyze Dockerfile content
 */
function analyzeDockerfile(content: string): any {
  const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
  const instructions = lines.map(line => {
    const match = line.match(/^(\w+)\s+(.+)/);
    return match ? { instruction: match[1].toUpperCase(), args: match[2] } : null;
  }).filter(Boolean);
  
  const instructionCounts = instructions.reduce((acc: any, inst: any) => {
    if (inst) {
      acc[inst.instruction] = (acc[inst.instruction] || 0) + 1;
    }
    return acc;
  }, {});
  
  // Calculate complexity score
  let complexityScore = 0;
  complexityScore += (instructionCounts.RUN || 0) * 2;
  complexityScore += (instructionCounts.COPY || 0) * 1;
  complexityScore += (instructionCounts.ADD || 0) * 1;
  complexityScore += (instructionCounts.ENV || 0) * 0.5;
  
  const baseImage = instructions.find(inst => inst && inst.instruction === 'FROM')?.args || 'unknown';
  
  return {
    total_lines: content.split('\n').length,
    instruction_lines: lines.length,
    total_instructions: instructions.length,
    instruction_breakdown: instructionCounts,
    base_image: baseImage,
    complexity_score: Math.round(complexityScore),
    has_multistage: (instructionCounts.FROM || 0) > 1,
    exposed_ports: extractExposedPorts(instructions),
    environment_variables: extractEnvironmentVariables(instructions),
    working_directory: extractWorkingDirectory(instructions),
    entry_point: extractEntryPoint(instructions),
  };
}

/**
 * Extract exposed ports from instructions
 */
function extractExposedPorts(instructions: any[]): string[] {
  const exposeInstructions = instructions.filter(inst => inst && inst.instruction === 'EXPOSE');
  return exposeInstructions.flatMap(inst => inst.args.split(/\s+/));
}

/**
 * Extract environment variables from instructions
 */
function extractEnvironmentVariables(instructions: any[]): string[] {
  const envInstructions = instructions.filter(inst => inst && inst.instruction === 'ENV');
  return envInstructions.map(inst => inst.args);
}

/**
 * Extract working directory from instructions
 */
function extractWorkingDirectory(instructions: any[]): string | null {
  const workdirInstructions = instructions.filter(inst => inst && inst.instruction === 'WORKDIR');
  return workdirInstructions.length > 0 ? workdirInstructions[workdirInstructions.length - 1].args : null;
}

/**
 * Extract entry point from instructions
 */
function extractEntryPoint(instructions: any[]): string | null {
  const entryPointInst = instructions.find(inst => inst && inst.instruction === 'ENTRYPOINT');
  const cmdInst = instructions.find(inst => inst && inst.instruction === 'CMD');
  
  if (entryPointInst) return entryPointInst.args;
  if (cmdInst) return cmdInst.args;
  
  return null;
}

/**
 * Generate Dockerfile optimization recommendations
 */
function generateDockerfileRecommendations(analysis: any): string[] {
  const recommendations: string[] = [];
  
  if (analysis.complexity_score > 20) {
    recommendations.push('Consider using multi-stage builds to reduce final image size');
  }
  
  if ((analysis.instruction_breakdown.RUN || 0) > 5) {
    recommendations.push('Consider combining RUN instructions to reduce layer count');
  }
  
  if (analysis.base_image.includes('latest')) {
    recommendations.push('Consider using specific version tags instead of "latest" for reproducible builds');
  }
  
  if (!analysis.has_multistage && analysis.complexity_score > 10) {
    recommendations.push('Multi-stage builds could help reduce final image size');
  }
  
  if (!analysis.working_directory) {
    recommendations.push('Consider setting a WORKDIR for better organization');
  }
  
  if (analysis.instruction_breakdown.ADD > 0) {
    recommendations.push('Consider using COPY instead of ADD unless you need ADD\'s special features');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Dockerfile appears to follow good practices');
  }
  
  return recommendations;
}
