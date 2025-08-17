import { MCPTool } from './index.js';
import { GetVulnerabilitiesArgs, GetVulnerabilitiesArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Get vulnerability scan results for a Docker image (bonus tool)
 */
export const getVulnerabilitiesTool: MCPTool<GetVulnerabilitiesArgs> = {
  name: 'docker_get_vulnerabilities',
  description: 'Retrieve security vulnerability scan results for a Docker image. Note: Vulnerability scanning may not be available for all images and may require authentication.',
  inputSchema: GetVulnerabilitiesArgsSchema,
  
  async execute(args: GetVulnerabilitiesArgs) {
    const { repository, tag } = args;

    try {
      // Attempt to get vulnerability scan results
      const vulnerabilityReport = await dockerHubClient.getVulnerabilities(repository, tag);
      
      if (!vulnerabilityReport) {
        return {
          repository,
          tag,
          scan_available: false,
          message: 'Vulnerability scan results are not available for this image',
          reasons: [
            'Image may not have been scanned',
            'Scan results may be private and require authentication',
            'Docker Hub vulnerability scanning may not be enabled for this repository',
            'Scan may be in progress',
          ],
          alternatives: [
            'Use container scanning tools like Trivy, Clair, or Anchore',
            'Check if the image maintainer provides security information',
            'Scan the image locally using security scanning tools',
            'Consider using official images which typically have better security maintenance',
          ],
          general_security_recommendations: generateGeneralSecurityRecommendations(repository, tag),
        };
      }

      // Analyze the vulnerability report
      const analysis = analyzeVulnerabilityReport(vulnerabilityReport);
      const riskAssessment = assessSecurityRisk(vulnerabilityReport);
      const recommendations = generateSecurityRecommendations(vulnerabilityReport, analysis);

      return {
        repository,
        tag,
        scan_available: true,
        scan_summary: {
          total_vulnerabilities: vulnerabilityReport.summary.total,
          critical: vulnerabilityReport.summary.high, // Docker Hub often maps critical to high
          high: vulnerabilityReport.summary.high,
          medium: vulnerabilityReport.summary.medium,
          low: vulnerabilityReport.summary.low,
          unknown: vulnerabilityReport.summary.unknown,
        },
        risk_assessment: riskAssessment,
        vulnerability_breakdown: {
          by_severity: {
            critical: vulnerabilityReport.vulnerabilities.filter(v => v.severity === 'high').length, // Treating high as critical
            high: vulnerabilityReport.vulnerabilities.filter(v => v.severity === 'high').length,
            medium: vulnerabilityReport.vulnerabilities.filter(v => v.severity === 'medium').length,
            low: vulnerabilityReport.vulnerabilities.filter(v => v.severity === 'low').length,
            unknown: vulnerabilityReport.vulnerabilities.filter(v => v.severity === 'unknown').length,
          },
          top_vulnerabilities: getTopVulnerabilities(vulnerabilityReport.vulnerabilities, 10),
          affected_packages: analyzeAffectedPackages(vulnerabilityReport.vulnerabilities),
        },
        detailed_analysis: analysis,
        recommendations,
        remediation: {
          fixable_vulnerabilities: vulnerabilityReport.vulnerabilities.filter(v => v.fix_version).length,
          fix_available_ratio: calculateFixAvailableRatio(vulnerabilityReport.vulnerabilities),
          update_recommendations: generateUpdateRecommendations(vulnerabilityReport.vulnerabilities),
        },
        compliance: {
          security_score: calculateSecurityScore(vulnerabilityReport),
          meets_basic_security: riskAssessment.overall_risk !== 'Critical',
          production_ready: riskAssessment.production_ready,
        },
      };

    } catch (error: any) {
      // Handle different types of errors gracefully
      return {
        repository,
        tag,
        scan_available: false,
        error: error.message || 'Failed to retrieve vulnerability scan results',
        message: 'Unable to access vulnerability scan data',
        alternatives: [
          'Try scanning with local tools like Trivy: trivy image ' + repository + ':' + tag,
          'Check Docker Scout (if available): docker scout cves ' + repository + ':' + tag,
          'Use Snyk container scanning',
          'Consider using Anchore Engine for vulnerability analysis',
        ],
        general_security_recommendations: generateGeneralSecurityRecommendations(repository, tag),
      };
    }
  },
};

/**
 * Analyze vulnerability report for patterns and insights
 */
function analyzeVulnerabilityReport(report: any): any {
  const vulnerabilities = report.vulnerabilities || [];
  
  // Group by package
  const packageVulns = vulnerabilities.reduce((acc: any, vuln: any) => {
    const pkg = vuln.package_name || 'unknown';
    if (!acc[pkg]) acc[pkg] = [];
    acc[pkg].push(vuln);
    return acc;
  }, {});
  
  // Most vulnerable packages
  const mostVulnerablePackages = Object.entries(packageVulns)
    .map(([pkg, vulns]: [string, any]) => ({ package: pkg, count: vulns.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Vulnerability types
  const vulnTypes = vulnerabilities.reduce((acc: any, vuln: any) => {
    // Extract vulnerability type from ID (CVE, etc.)
    const type = vuln.id.startsWith('CVE-') ? 'CVE' : 
                 vuln.id.startsWith('GHSA-') ? 'GitHub Security Advisory' :
                 vuln.id.startsWith('DSA-') ? 'Debian Security Advisory' :
                 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    total_affected_packages: Object.keys(packageVulns).length,
    most_vulnerable_packages: mostVulnerablePackages,
    vulnerability_types: vulnTypes,
    fixable_percentage: ((vulnerabilities.filter((v: any) => v.fix_version).length / vulnerabilities.length) * 100).toFixed(1),
    average_cvss_score: calculateAverageCVSS(vulnerabilities),
  };
}

/**
 * Assess overall security risk
 */
function assessSecurityRisk(report: any): any {
  const summary = report.summary;
  
  let riskScore = 0;
  let riskLevel = 'Low';
  let productionReady = true;
  
  // Calculate risk score based on vulnerability counts
  riskScore += summary.high * 10;
  riskScore += summary.medium * 3;
  riskScore += summary.low * 1;
  riskScore += summary.unknown * 2;
  
  // Determine risk level
  if (riskScore >= 50 || summary.high >= 5) {
    riskLevel = 'Critical';
    productionReady = false;
  } else if (riskScore >= 20 || summary.high >= 2) {
    riskLevel = 'High';
    productionReady = false;
  } else if (riskScore >= 10 || summary.medium >= 10) {
    riskLevel = 'Medium';
  }

  return {
    overall_risk: riskLevel,
    risk_score: riskScore,
    production_ready: productionReady,
    key_concerns: generateKeyConcerns(summary, report.vulnerabilities),
  };
}

/**
 * Generate key security concerns
 */
function generateKeyConcerns(summary: any, vulnerabilities: any[]): string[] {
  const concerns: string[] = [];
  
  if (summary.high > 0) {
    concerns.push(`${summary.high} high severity vulnerabilities found`);
  }
  
  if (summary.medium > 10) {
    concerns.push(`High number of medium severity vulnerabilities (${summary.medium})`);
  }
  
  // Check for specific types of vulnerabilities
  const criticalTypes = vulnerabilities.filter((v: any) => 
    v.title.toLowerCase().includes('remote code execution') ||
    v.title.toLowerCase().includes('privilege escalation') ||
    v.title.toLowerCase().includes('sql injection')
  );
  
  if (criticalTypes.length > 0) {
    concerns.push('Contains vulnerabilities that could lead to system compromise');
  }
  
  const unfixableHighSeverity = vulnerabilities.filter((v: any) => 
    v.severity === 'high' && !v.fix_version
  );
  
  if (unfixableHighSeverity.length > 0) {
    concerns.push(`${unfixableHighSeverity.length} high severity vulnerabilities without available fixes`);
  }
  
  return concerns;
}

/**
 * Get top vulnerabilities by severity and CVSS score
 */
function getTopVulnerabilities(vulnerabilities: any[], limit: number): any[] {
  return vulnerabilities
    .sort((a, b) => {
      // Sort by severity first, then by whether fix is available
      const severityOrder = { high: 3, medium: 2, low: 1, unknown: 0 };
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] || 0;
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] || 0;
      
      if (aSeverity !== bSeverity) return bSeverity - aSeverity;
      
      // If same severity, prioritize those with fixes available
      if (!!a.fix_version !== !!b.fix_version) {
        return a.fix_version ? -1 : 1;
      }
      
      return 0;
    })
    .slice(0, limit)
    .map(vuln => ({
      id: vuln.id,
      title: vuln.title,
      severity: vuln.severity,
      package: vuln.package_name,
      current_version: vuln.package_version,
      fix_version: vuln.fix_version || 'No fix available',
      description: vuln.description?.slice(0, 200) + (vuln.description?.length > 200 ? '...' : ''),
      link: vuln.link,
    }));
}

/**
 * Analyze affected packages
 */
function analyzeAffectedPackages(vulnerabilities: any[]): any {
  const packageStats = vulnerabilities.reduce((acc: any, vuln: any) => {
    const pkg = vuln.package_name || 'unknown';
    if (!acc[pkg]) {
      acc[pkg] = {
        package_name: pkg,
        vulnerability_count: 0,
        highest_severity: 'low',
        fixable_count: 0,
        versions_affected: new Set(),
      };
    }
    
    acc[pkg].vulnerability_count++;
    acc[pkg].versions_affected.add(vuln.package_version);
    
    if (vuln.fix_version) acc[pkg].fixable_count++;
    
    // Update highest severity
    const severityOrder = { high: 3, medium: 2, low: 1, unknown: 0 };
    if ((severityOrder[vuln.severity as keyof typeof severityOrder] || 0) > (severityOrder[acc[pkg].highest_severity as keyof typeof severityOrder] || 0)) {
      acc[pkg].highest_severity = vuln.severity;
    }
    
    return acc;
  }, {});
  
  // Convert to array and format
  return Object.values(packageStats)
    .map((pkg: any) => ({
      ...pkg,
      versions_affected: Array.from(pkg.versions_affected),
      fixable_ratio: (pkg.fixable_count / pkg.vulnerability_count * 100).toFixed(1) + '%',
    }))
    .sort((a: any, b: any) => b.vulnerability_count - a.vulnerability_count)
    .slice(0, 10);
}

/**
 * Generate security recommendations
 */
function generateSecurityRecommendations(report: any, analysis: any): string[] {
  const recommendations: string[] = [];
  const summary = report.summary;
  
  if (summary.high > 0) {
    recommendations.push('Immediate action required: Address all high severity vulnerabilities before production use');
  }
  
  if (analysis.fixable_percentage > 80) {
    recommendations.push('Most vulnerabilities have fixes available - update affected packages');
  } else if (analysis.fixable_percentage < 50) {
    recommendations.push('Many vulnerabilities lack fixes - consider using a different base image');
  }
  
  if (analysis.total_affected_packages > 20) {
    recommendations.push('Consider using a minimal base image to reduce attack surface');
  }
  
  if (summary.medium > 20) {
    recommendations.push('High number of medium severity issues - plan for systematic updates');
  }
  
  // Base image recommendations
  const baseImageRecs = generateBaseImageRecommendations(report);
  recommendations.push(...baseImageRecs);
  
  return recommendations;
}

/**
 * Generate base image recommendations
 */
function generateBaseImageRecommendations(report: any): string[] {
  const recommendations: string[] = [];
  
  if (report.summary.total > 100) {
    recommendations.push('Consider switching to a security-focused base image like Alpine or Distroless');
  }
  
  if (report.summary.high > 3) {
    recommendations.push('Evaluate using official images from Docker Hub which typically have better security maintenance');
  }
  
  recommendations.push('Implement regular vulnerability scanning in your CI/CD pipeline');
  recommendations.push('Keep base images updated with latest security patches');
  
  return recommendations;
}

/**
 * Calculate fix available ratio
 */
function calculateFixAvailableRatio(vulnerabilities: any[]): string {
  if (vulnerabilities.length === 0) return '0%';
  
  const fixableCount = vulnerabilities.filter(v => v.fix_version).length;
  return ((fixableCount / vulnerabilities.length) * 100).toFixed(1) + '%';
}

/**
 * Generate update recommendations
 */
function generateUpdateRecommendations(vulnerabilities: any[]): string[] {
  const recommendations: string[] = [];
  
  const fixableVulns = vulnerabilities.filter(v => v.fix_version);
  const packageUpdates = fixableVulns.reduce((acc: any, vuln: any) => {
    const pkg = vuln.package_name;
    if (!acc[pkg] || acc[pkg].priority < getSeverityPriority(vuln.severity)) {
      acc[pkg] = {
        current_version: vuln.package_version,
        fix_version: vuln.fix_version,
        priority: getSeverityPriority(vuln.severity),
        severity: vuln.severity,
      };
    }
    return acc;
  }, {});
  
  const highPriorityUpdates = Object.entries(packageUpdates)
    .filter(([, update]: [string, any]) => update.priority >= 3)
    .sort(([, a]: [string, any], [, b]: [string, any]) => b.priority - a.priority)
    .slice(0, 5);
  
  if (highPriorityUpdates.length > 0) {
    recommendations.push('Priority package updates:');
    highPriorityUpdates.forEach(([pkg, update]: [string, any]) => {
      recommendations.push(`  - ${pkg}: ${update.current_version} → ${update.fix_version} (${update.severity} severity)`);
    });
  }
  
  return recommendations;
}

/**
 * Get severity priority for sorting
 */
function getSeverityPriority(severity: string): number {
  const priorities: { [key: string]: number } = {
    high: 4,
    medium: 2,
    low: 1,
    unknown: 0,
  };
  return priorities[severity] || 0;
}

/**
 * Calculate average CVSS score (if available)
 */
function calculateAverageCVSS(vulnerabilities: any[]): string {
  // This is a placeholder since Docker Hub API might not provide CVSS scores
  // In a real implementation, you would extract CVSS scores from vulnerability details
  const severityScores: { [key: string]: number } = {
    high: 8.0,
    medium: 5.0,
    low: 2.0,
    unknown: 0,
  };
  
  if (vulnerabilities.length === 0) return 'N/A';
  
  const totalScore = vulnerabilities.reduce((sum, vuln) => {
    return sum + (severityScores[vuln.severity] || 0);
  }, 0);
  
  return (totalScore / vulnerabilities.length).toFixed(1);
}

/**
 * Calculate security score (0-100)
 */
function calculateSecurityScore(report: any): number {
  const summary = report.summary;
  let score = 100;
  
  // Deduct points based on vulnerability counts
  score -= summary.high * 15;
  score -= summary.medium * 3;
  score -= summary.low * 1;
  score -= summary.unknown * 2;
  
  return Math.max(0, score);
}

/**
 * Generate general security recommendations when scan is not available
 */
function generateGeneralSecurityRecommendations(_repository: string, _tag: string): string[] {
  return [
    'Use official images when possible as they typically have better security maintenance',
    'Regularly update your base images to get the latest security patches',
    'Implement vulnerability scanning in your CI/CD pipeline',
    'Consider using minimal base images like Alpine or Distroless to reduce attack surface',
    'Monitor security advisories for packages used in your images',
    'Use specific version tags instead of "latest" for reproducible and secure deployments',
    'Regularly rebuild images to incorporate security updates from base layers',
  ];
}
