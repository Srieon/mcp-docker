import { MCPTool } from './index.js';
import { GetStatsArgs, GetStatsArgsSchema } from '../types.js';
import { dockerHubClient } from '../clients/dockerhub.js';

/**
 * Get download statistics and popularity metrics for a Docker repository
 */
export const getStatsTool: MCPTool<GetStatsArgs> = {
  name: 'docker_get_stats',
  description: 'Get comprehensive statistics for a Docker repository including pull count, star count, and popularity metrics with historical trends estimation.',
  inputSchema: GetStatsArgsSchema,
  
  async execute(args: GetStatsArgs) {
    const { repository } = args;

    // Get repository details and basic stats
    const repoDetails = await dockerHubClient.getRepositoryDetails(repository);
    
    // Get tag information to analyze usage patterns
    const tagsResponse = await dockerHubClient.listTags(repository, 50); // Get more tags for analysis
    
    // Calculate additional metrics
    const metrics = calculateAdvancedMetrics(repoDetails, tagsResponse);
    
    // Generate insights
    const insights = generateStatisticalInsights(repoDetails, tagsResponse, metrics);

    return {
      repository: {
        name: repoDetails.name,
        namespace: repoDetails.namespace,
        full_name: `${repoDetails.namespace}/${repoDetails.name}`,
        description: repoDetails.description?.slice(0, 200) + (repoDetails.description?.length > 200 ? '...' : ''),
      },
      basic_stats: {
        pull_count: repoDetails.pull_count,
        star_count: repoDetails.star_count,
        total_tags: tagsResponse.count,
        is_official: repoDetails.namespace === 'library',
        is_automated: repoDetails.is_automated,
        is_private: repoDetails.is_private,
      },
      popularity_metrics: {
        popularity_score: metrics.popularityScore,
        popularity_rank: classifyPopularity(metrics.popularityScore),
        stars_per_day: metrics.starsPerDay,
        pulls_per_day: metrics.pullsPerDay,
        engagement_ratio: metrics.engagementRatio,
        trust_indicators: {
          is_official: repoDetails.namespace === 'library',
          is_automated: repoDetails.is_automated,
          star_count_category: categorizeStarCount(repoDetails.star_count),
          pull_count_category: categorizePullCount(repoDetails.pull_count),
        },
      },
      usage_analysis: {
        total_downloads: repoDetails.pull_count,
        formatted_downloads: formatNumber(repoDetails.pull_count),
        estimated_daily_downloads: Math.round(metrics.pullsPerDay),
        formatted_daily_downloads: formatNumber(Math.round(metrics.pullsPerDay)),
        stars_to_pulls_ratio: repoDetails.pull_count > 0 ? (repoDetails.star_count / repoDetails.pull_count * 100).toFixed(4) : '0',
        usage_intensity: classifyUsageIntensity(repoDetails.pull_count, repoDetails.star_count),
      },
      tag_statistics: {
        total_tags: tagsResponse.count,
        recent_tags: tagsResponse.results.slice(0, 5).map(tag => ({
          name: tag.name,
          size: formatBytes(tag.full_size),
          last_pushed: tag.tag_last_pushed,
          last_pulled: tag.tag_last_pulled,
        })),
        tag_activity: analyzeTagActivity(tagsResponse.results),
        size_analysis: analyzeTagSizes(tagsResponse.results),
      },
      timeline: {
        created: repoDetails.date_registered,
        last_updated: repoDetails.last_updated,
        age_days: Math.floor((new Date().getTime() - new Date(repoDetails.date_registered).getTime()) / (1000 * 60 * 60 * 24)),
        days_since_update: Math.floor((new Date().getTime() - new Date(repoDetails.last_updated).getTime()) / (1000 * 60 * 60 * 24)),
        update_frequency: classifyUpdateFrequency(repoDetails.date_registered, repoDetails.last_updated, tagsResponse.count),
      },
      comparative_analysis: {
        percentile_estimates: {
          pull_count_percentile: estimatePercentile(repoDetails.pull_count, 'pulls'),
          star_count_percentile: estimatePercentile(repoDetails.star_count, 'stars'),
        },
        benchmark_comparison: generateBenchmarkComparison(repoDetails),
      },
      insights,
      recommendations: generateRecommendations(repoDetails, metrics, insights),
    };
  },
};

/**
 * Calculate advanced metrics from repository data
 */
function calculateAdvancedMetrics(repoDetails: any, _tagsResponse: any): any {
  const ageDays = Math.max(1, Math.floor((new Date().getTime() - new Date(repoDetails.date_registered).getTime()) / (1000 * 60 * 60 * 24)));
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(repoDetails.last_updated).getTime()) / (1000 * 60 * 60 * 24));
  
  // Estimate daily rates (simplified calculation)
  const starsPerDay = repoDetails.star_count / ageDays;
  const pullsPerDay = repoDetails.pull_count / ageDays;
  
  // Engagement ratio (stars relative to pulls)
  const engagementRatio = repoDetails.pull_count > 0 ? (repoDetails.star_count / repoDetails.pull_count) : 0;
  
  // Popularity score (weighted combination of metrics)
  const popularityScore = calculatePopularityScore(repoDetails, starsPerDay, pullsPerDay, ageDays, daysSinceUpdate);

  return {
    ageDays,
    daysSinceUpdate,
    starsPerDay,
    pullsPerDay,
    engagementRatio,
    popularityScore,
  };
}

/**
 * Calculate popularity score using weighted factors
 */
function calculatePopularityScore(repoDetails: any, _starsPerDay: number, _pullsPerDay: number, _ageDays: number, daysSinceUpdate: number): number {
  let score = 0;
  
  // Pull count factor (40% weight)
  if (repoDetails.pull_count > 10000000) score += 40;
  else if (repoDetails.pull_count > 1000000) score += 35;
  else if (repoDetails.pull_count > 100000) score += 30;
  else if (repoDetails.pull_count > 10000) score += 20;
  else if (repoDetails.pull_count > 1000) score += 10;
  
  // Star count factor (30% weight)
  if (repoDetails.star_count > 1000) score += 30;
  else if (repoDetails.star_count > 500) score += 25;
  else if (repoDetails.star_count > 100) score += 20;
  else if (repoDetails.star_count > 50) score += 15;
  else if (repoDetails.star_count > 10) score += 10;
  
  // Activity factor (20% weight)
  if (daysSinceUpdate < 30) score += 20;
  else if (daysSinceUpdate < 90) score += 15;
  else if (daysSinceUpdate < 365) score += 10;
  else if (daysSinceUpdate < 730) score += 5;
  
  // Quality indicators (10% weight)
  if (repoDetails.namespace === 'library') score += 5; // Official image
  if (repoDetails.is_automated) score += 3;
  if (repoDetails.description && repoDetails.description.length > 50) score += 2;
  
  return Math.min(100, Math.round(score));
}

/**
 * Classify popularity based on score
 */
function classifyPopularity(score: number): string {
  if (score >= 80) return 'Very High';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Very Low';
}

/**
 * Categorize star count
 */
function categorizeStarCount(starCount: number): string {
  if (starCount >= 1000) return 'Highly Popular';
  if (starCount >= 500) return 'Very Popular';
  if (starCount >= 100) return 'Popular';
  if (starCount >= 50) return 'Moderately Popular';
  if (starCount >= 10) return 'Some Recognition';
  return 'Limited Recognition';
}

/**
 * Categorize pull count
 */
function categorizePullCount(pullCount: number): string {
  if (pullCount >= 100000000) return 'Extremely High Usage';
  if (pullCount >= 10000000) return 'Very High Usage';
  if (pullCount >= 1000000) return 'High Usage';
  if (pullCount >= 100000) return 'Moderate Usage';
  if (pullCount >= 10000) return 'Regular Usage';
  if (pullCount >= 1000) return 'Occasional Usage';
  return 'Limited Usage';
}

/**
 * Classify usage intensity
 */
function classifyUsageIntensity(pullCount: number, starCount: number): string {
  const ratio = pullCount > 0 ? starCount / pullCount : 0;
  
  if (ratio > 0.1) return 'High Community Engagement';
  if (ratio > 0.01) return 'Good Community Engagement';
  if (ratio > 0.001) return 'Moderate Community Engagement';
  if (ratio > 0.0001) return 'Utility-Focused Usage';
  return 'Low Community Engagement';
}

/**
 * Analyze tag activity patterns
 */
function analyzeTagActivity(tags: any[]): any {
  const now = new Date();
  const last30Days = tags.filter(tag => {
    const pushDate = new Date(tag.tag_last_pushed);
    return (now.getTime() - pushDate.getTime()) / (1000 * 60 * 60 * 24) <= 30;
  });
  
  const last90Days = tags.filter(tag => {
    const pushDate = new Date(tag.tag_last_pushed);
    return (now.getTime() - pushDate.getTime()) / (1000 * 60 * 60 * 24) <= 90;
  });

  return {
    tags_last_30_days: last30Days.length,
    tags_last_90_days: last90Days.length,
    most_recent_tag: tags.length > 0 ? {
      name: tags[0].name,
      pushed: tags[0].tag_last_pushed,
      days_ago: Math.floor((now.getTime() - new Date(tags[0].tag_last_pushed).getTime()) / (1000 * 60 * 60 * 24)),
    } : null,
    activity_level: last30Days.length > 5 ? 'High' : last30Days.length > 2 ? 'Medium' : last30Days.length > 0 ? 'Low' : 'Inactive',
  };
}

/**
 * Analyze tag sizes
 */
function analyzeTagSizes(tags: any[]): any {
  const sizes = tags.map(tag => tag.full_size).filter(size => size > 0);
  
  if (sizes.length === 0) {
    return {
      average_size: 0,
      total_size: 0,
      size_range: 'No size data available',
    };
  }
  
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const average = total / sizes.length;
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  
  return {
    average_size: Math.round(average),
    formatted_average_size: formatBytes(Math.round(average)),
    total_size_all_tags: total,
    formatted_total_size: formatBytes(total),
    size_range: `${formatBytes(min)} - ${formatBytes(max)}`,
    size_category: average < 50 * 1024 * 1024 ? 'Compact' : 
                   average < 200 * 1024 * 1024 ? 'Medium' : 
                   average < 500 * 1024 * 1024 ? 'Large' : 'Very Large',
  };
}

/**
 * Classify update frequency
 */
function classifyUpdateFrequency(_created: string, lastUpdated: string, _tagCount: number): string {
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate update frequency based on age and activity
  
  if (daysSinceUpdate < 7) return 'Very Active';
  if (daysSinceUpdate < 30) return 'Active';
  if (daysSinceUpdate < 90) return 'Moderate';
  if (daysSinceUpdate < 365) return 'Infrequent';
  return 'Stale';
}

/**
 * Estimate percentile ranking (simplified estimation)
 */
function estimatePercentile(value: number, type: 'pulls' | 'stars'): string {
  const thresholds = type === 'pulls' 
    ? { 99: 10000000, 95: 1000000, 90: 100000, 75: 10000, 50: 1000 }
    : { 99: 1000, 95: 500, 90: 100, 75: 50, 50: 10 };
  
  for (const [percentile, threshold] of Object.entries(thresholds)) {
    if (value >= threshold) {
      return `Top ${100 - parseInt(percentile)}%`;
    }
  }
  
  return 'Bottom 50%';
}

/**
 * Generate benchmark comparison
 */
function generateBenchmarkComparison(repoDetails: any): any {
  return {
    category: repoDetails.namespace === 'library' ? 'Official Image' : 'Community Image',
    performance_vs_category: {
      stars: repoDetails.namespace === 'library' && repoDetails.star_count > 100 ? 'Above Average' : 
             repoDetails.namespace !== 'library' && repoDetails.star_count > 50 ? 'Above Average' : 'Average',
      pulls: repoDetails.pull_count > 1000000 ? 'Above Average' : 'Average',
    },
    notable_aspects: generateNotableAspects(repoDetails),
  };
}

/**
 * Generate notable aspects
 */
function generateNotableAspects(repoDetails: any): string[] {
  const aspects: string[] = [];
  
  if (repoDetails.namespace === 'library') aspects.push('Official Docker image');
  if (repoDetails.is_automated) aspects.push('Automated build process');
  if (repoDetails.pull_count > 10000000) aspects.push('Extremely popular (10M+ pulls)');
  else if (repoDetails.pull_count > 1000000) aspects.push('Very popular (1M+ pulls)');
  if (repoDetails.star_count > 1000) aspects.push('Highly rated by community');
  
  return aspects;
}

/**
 * Generate statistical insights
 */
function generateStatisticalInsights(repoDetails: any, _tagsResponse: any, metrics: any): string[] {
  const insights: string[] = [];
  
  // Usage patterns
  if (metrics.pullsPerDay > 10000) {
    insights.push(`High daily usage with approximately ${formatNumber(Math.round(metrics.pullsPerDay))} pulls per day`);
  }
  
  // Community engagement
  if (metrics.engagementRatio > 0.01) {
    insights.push('Strong community engagement with good star-to-pull ratio');
  } else if (repoDetails.pull_count > 1000000 && repoDetails.star_count < 100) {
    insights.push('Utility-focused image with high usage but limited community recognition');
  }
  
  // Maintenance patterns
  if (metrics.daysSinceUpdate < 30) {
    insights.push('Recently maintained with active development');
  } else if (metrics.daysSinceUpdate > 365) {
    insights.push('May be considered stable or potentially outdated - check for alternatives');
  }
  
  // Repository maturity
  if (metrics.ageDays > 1000) {
    insights.push('Mature repository with established track record');
  }
  
  return insights;
}

/**
 * Generate recommendations based on statistics
 */
function generateRecommendations(repoDetails: any, metrics: any, _insights: string[]): string[] {
  const recommendations: string[] = [];
  
  if (repoDetails.namespace === 'library') {
    recommendations.push('Official image - generally safe choice for production use');
  } else if (repoDetails.star_count < 10 && repoDetails.pull_count < 1000) {
    recommendations.push('Low community adoption - consider more popular alternatives');
  }
  
  if (metrics.daysSinceUpdate > 365) {
    recommendations.push('Repository not updated recently - verify it meets your security requirements');
  }
  
  if (repoDetails.pull_count > 1000000) {
    recommendations.push('High usage indicates community trust and stability');
  }
  
  if (metrics.popularityScore > 70) {
    recommendations.push('Highly popular and well-maintained repository');
  }
  
  return recommendations;
}

/**
 * Format large numbers for readability
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

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
