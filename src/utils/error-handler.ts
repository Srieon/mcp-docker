import { AxiosError } from 'axios';
import { DockerHubError, RateLimitError, AuthenticationError } from '../types.js';
import { config } from '../config.js';

/**
 * Enhanced error handling utilities for Docker Hub API
 */
export class ErrorHandler {
  
  /**
   * Convert various error types to standardized DockerHubError
   */
  static handleError(error: unknown): DockerHubError {
    if (error instanceof DockerHubError) {
      return error;
    }

    if (error instanceof AxiosError) {
      return this.handleAxiosError(error);
    }

    if (error instanceof Error) {
      return new DockerHubError(error.message);
    }

    return new DockerHubError('Unknown error occurred');
  }

  /**
   * Handle Axios-specific errors
   */
  private static handleAxiosError(error: AxiosError): DockerHubError {
    const { response, request, message } = error;

    if (!response) {
      if (request) {
        return new DockerHubError('Network error: Unable to reach Docker Hub API');
      }
      return new DockerHubError(`Request setup error: ${message}`);
    }

    const { status, data, headers } = response;

    // Extract error message from response
    let errorMessage = message;
    if (data && typeof data === 'object') {
      const responseData = data as any;
      if (responseData.message) {
        errorMessage = responseData.message;
      } else if (responseData.detail) {
        errorMessage = responseData.detail;
      } else if (responseData.error) {
        errorMessage = responseData.error;
      } else if (responseData.errors && Array.isArray(responseData.errors)) {
        errorMessage = responseData.errors.map((e: any) => e.message || e).join(', ');
      }
    }

    // Handle specific HTTP status codes
    switch (status) {
      case 401:
        return new AuthenticationError(errorMessage || 'Authentication failed');
      
      case 403:
        return new DockerHubError(
          errorMessage || 'Access forbidden. Check your permissions.',
          status,
          data
        );
      
      case 404:
        return new DockerHubError(
          errorMessage || 'Resource not found',
          status,
          data
        );
      
      case 429:
        const resetHeader = headers?.['x-ratelimit-reset'] || headers?.['ratelimit-reset'];
        const resetTime = resetHeader ? parseInt(resetHeader, 10) * 1000 : Date.now() + 3600000;
        return new RateLimitError(
          errorMessage || 'Rate limit exceeded',
          resetTime
        );
      
      case 500:
        return new DockerHubError(
          'Docker Hub internal server error',
          status,
          data
        );
      
      case 502:
      case 503:
      case 504:
        return new DockerHubError(
          'Docker Hub service temporarily unavailable',
          status,
          data
        );
      
      default:
        return new DockerHubError(
          errorMessage || `HTTP ${status} error`,
          status,
          data
        );
    }
  }

  /**
   * Log error with appropriate log level
   */
  static logError(error: DockerHubError, context?: string): void {
    const prefix = context ? `[${context}]` : '';
    const logLevel = this.getLogLevel(error);

    const errorInfo = {
      message: error.message,
      statusCode: error.statusCode,
      name: error.name,
      ...(error.response && { response: error.response }),
    };

    switch (logLevel) {
      case 'error':
        console.error(`${prefix} Error:`, errorInfo);
        break;
      case 'warn':
        console.warn(`${prefix} Warning:`, errorInfo);
        break;
      case 'info':
        console.info(`${prefix} Info:`, errorInfo);
        break;
      case 'debug':
        if (config.logLevel === 'debug') {
          console.debug(`${prefix} Debug:`, errorInfo);
        }
        break;
    }
  }

  /**
   * Determine appropriate log level for error
   */
  private static getLogLevel(error: DockerHubError): 'error' | 'warn' | 'info' | 'debug' {
    if (error instanceof RateLimitError) {
      return 'warn';
    }

    if (error instanceof AuthenticationError) {
      return 'error';
    }

    if (error.statusCode) {
      if (error.statusCode >= 500) {
        return 'error';
      }
      if (error.statusCode >= 400) {
        return 'warn';
      }
      return 'info';
    }

    return 'error';
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: DockerHubError): boolean {
    if (error instanceof RateLimitError) {
      return true;
    }

    if (error instanceof AuthenticationError) {
      return false;
    }

    if (error.statusCode) {
      // Retry on server errors and some client errors
      return error.statusCode >= 500 || error.statusCode === 429;
    }

    return false;
  }

  /**
   * Get retry delay for retryable errors (in milliseconds)
   */
  static getRetryDelay(error: DockerHubError, attempt: number): number {
    if (error instanceof RateLimitError) {
      return Math.max(0, error.resetTime - Date.now());
    }

    // Exponential backoff for other retryable errors
    return Math.min(30000, 1000 * Math.pow(2, attempt - 1));
  }

  /**
   * Wrap async function with error handling and optional retry logic
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>,
    context?: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: DockerHubError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = this.handleError(error);
        
        if (context) {
          this.logError(lastError, `${context} (attempt ${attempt}/${maxRetries})`);
        }

        // Don't retry on the last attempt or if error is not retryable
        if (attempt === maxRetries || !this.isRetryable(lastError)) {
          throw lastError;
        }

        // Wait before retrying
        const delay = this.getRetryDelay(lastError, attempt);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Create user-friendly error message for MCP clients
   */
  static createUserFriendlyMessage(error: DockerHubError): string {
    if (error instanceof AuthenticationError) {
      return 'Authentication failed. Please check your Docker Hub credentials.';
    }

    if (error instanceof RateLimitError) {
      const resetTime = new Date(error.resetTime).toLocaleTimeString();
      return `Rate limit exceeded. Please try again after ${resetTime}.`;
    }

    if (error.statusCode === 404) {
      return 'The requested Docker image or repository was not found.';
    }

    if (error.statusCode === 403) {
      return 'Access denied. You may not have permission to access this resource.';
    }

    if (error.statusCode && error.statusCode >= 500) {
      return 'Docker Hub service is temporarily unavailable. Please try again later.';
    }

    return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Decorator for automatic error handling
 */
export function handleErrors(context?: string, maxRetries?: number) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor?: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    if (!descriptor) {
      return;
    }

    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = async function (...args: T): Promise<R> {
      return ErrorHandler.withErrorHandling(
        () => originalMethod.apply(this, args),
        context || `${target.constructor.name}.${propertyKey}`,
        maxRetries
      );
    };

    return descriptor;
  };
}
