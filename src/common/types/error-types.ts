/**
 * Enhanced error categorization for better error handling and retry logic
 */

export enum ErrorCategory {
    DATA_INTEGRITY = 'data_integrity',
    SYSTEM_ERROR = 'system_error',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    VALIDATION = 'validation',
    NETWORK = 'network',
    RATE_LIMIT = 'rate_limit',
    TIMEOUT = 'timeout',
    UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export interface CategorizedError {
    category: ErrorCategory;
    severity: ErrorSeverity;
    isRetryable: boolean;
    originalError: Error;
    context?: {
        testId?: number;
        attemptId?: number;
        userId?: string;
        questionId?: number;
        operation?: string;
        timestamp?: Date;
    };
    message: string;
    suggestions?: string[];
}

export class ErrorCategorizer {
    static categorize(error: Error, context?: CategorizedError['context']): CategorizedError {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.constructor.name.toLowerCase();

        // Data integrity errors
        if (errorMessage.includes('not found') || 
            errorMessage.includes('does not exist') ||
            errorMessage.includes('no matching record') ||
            errorMessage.includes('foreign key constraint')) {
            return {
                category: ErrorCategory.DATA_INTEGRITY,
                severity: ErrorSeverity.HIGH,
                isRetryable: false,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Data integrity issue: ${error.message}`,
                suggestions: [
                    'Verify that referenced records exist in the database',
                    'Check for race conditions during record deletion',
                    'Ensure proper data validation before operations'
                ]
            };
        }

        // Network/connection errors
        if (errorMessage.includes('econnreset') ||
            errorMessage.includes('connection lost') ||
            errorMessage.includes('connect etimedout') ||
            errorMessage.includes('enotfound') ||
            errorMessage.includes('econnrefused') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('esockettimedout') ||
            errorMessage.includes('connection terminated') ||
            errorMessage.includes('server has gone away') ||
            errorMessage.includes('connection was killed') ||
            errorMessage.includes('read econnreset') ||
            errorMessage.includes('write econnreset') ||
            errorMessage.includes('socket hang up') ||
            errorMessage.includes('network error')) {
            return {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.MEDIUM,
                isRetryable: true,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Network connectivity issue: ${error.message}`,
                suggestions: [
                    'Check network connectivity',
                    'Verify database server is running',
                    'Review connection pool settings'
                ]
            };
        }

        // Authentication errors
        if (errorMessage.includes('unauthorized') ||
            errorMessage.includes('invalid token') ||
            errorMessage.includes('token expired') ||
            errorName.includes('unauthorized')) {
            return {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH,
                isRetryable: false,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Authentication failed: ${error.message}`,
                suggestions: [
                    'Verify user credentials',
                    'Check token validity and expiration',
                    'Ensure proper authentication flow'
                ]
            };
        }

        // Authorization errors
        if (errorMessage.includes('forbidden') ||
            errorMessage.includes('access denied') ||
            errorMessage.includes('permission') ||
            errorName.includes('forbidden')) {
            return {
                category: ErrorCategory.AUTHORIZATION,
                severity: ErrorSeverity.HIGH,
                isRetryable: false,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Access denied: ${error.message}`,
                suggestions: [
                    'Verify user permissions',
                    'Check role-based access controls',
                    'Ensure proper scope validation'
                ]
            };
        }

        // Validation errors
        if (errorMessage.includes('validation') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('required') ||
            errorMessage.includes('bad request') ||
            errorName.includes('validation') ||
            errorName.includes('badrequest')) {
            return {
                category: ErrorCategory.VALIDATION,
                severity: ErrorSeverity.MEDIUM,
                isRetryable: false,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Validation error: ${error.message}`,
                suggestions: [
                    'Check input data format and constraints',
                    'Verify required fields are provided',
                    'Review validation rules'
                ]
            };
        }

        // Rate limiting errors
        if (errorMessage.includes('rate limit') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('throttle')) {
            return {
                category: ErrorCategory.RATE_LIMIT,
                severity: ErrorSeverity.MEDIUM,
                isRetryable: true,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Rate limit exceeded: ${error.message}`,
                suggestions: [
                    'Implement exponential backoff',
                    'Review rate limiting policies',
                    'Consider request batching'
                ]
            };
        }

        // Timeout errors
        if (errorMessage.includes('timeout') ||
            errorMessage.includes('timed out') ||
            errorName.includes('timeout')) {
            return {
                category: ErrorCategory.TIMEOUT,
                severity: ErrorSeverity.MEDIUM,
                isRetryable: true,
                originalError: error,
                context: { ...context, timestamp: new Date() },
                message: `Operation timed out: ${error.message}`,
                suggestions: [
                    'Increase timeout values',
                    'Optimize query performance',
                    'Check system resources'
                ]
            };
        }

        // Default categorization for unknown errors
        return {
            category: ErrorCategory.UNKNOWN,
            severity: ErrorSeverity.MEDIUM,
            isRetryable: false,
            originalError: error,
            context: { ...context, timestamp: new Date() },
            message: `Unknown error: ${error.message}`,
            suggestions: [
                'Review error details for more context',
                'Check system logs for additional information',
                'Consider implementing specific error handling'
            ]
        };
    }

    static formatErrorForLogging(categorizedError: CategorizedError): string {
        const { category, severity, context, message } = categorizedError;
        const contextStr = context ? 
            `[${Object.entries(context).map(([k, v]) => `${k}:${v}`).join(', ')}]` : 
            '';
        
        return `[${category.toUpperCase()}/${severity.toUpperCase()}] ${contextStr} ${message}`;
    }
}
