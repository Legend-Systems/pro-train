import { Injectable, Logger } from '@nestjs/common';
import { ErrorCategorizer, CategorizedError, ErrorCategory } from '../types/error-types';

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    exponentialBackoff?: boolean;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
    context?: {
        testId?: number;
        attemptId?: number;
        userId?: string;
        questionId?: number;
        operation?: string;
    };
}

interface CircuitBreakerState {
    failures: number;
    lastFailureTime: Date;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class RetryService {
    private readonly logger = new Logger(RetryService.name);
    private circuitBreakers = new Map<string, CircuitBreakerState>();
    
    // Circuit breaker configuration
    private readonly FAILURE_THRESHOLD = 5;
    private readonly TIMEOUT_WINDOW = 60000; // 1 minute
    private readonly HALF_OPEN_MAX_CALLS = 3;

    private readonly defaultShouldRetry = (error: Error, context?: RetryOptions['context']): boolean => {
        const categorizedError = ErrorCategorizer.categorize(error, context);
        
        // Log the categorized error for better debugging
        this.logger.warn(ErrorCategorizer.formatErrorForLogging(categorizedError));
        
        return categorizedError.isRetryable;
    };

    private getCircuitBreakerKey(context?: RetryOptions['context']): string {
        if (!context) return 'default';
        return `${context.operation || 'unknown'}_${context.testId || 'any'}_${context.userId || 'any'}`;
    }

    private checkCircuitBreaker(key: string): boolean {
        const state = this.circuitBreakers.get(key);
        
        if (!state) {
            this.circuitBreakers.set(key, {
                failures: 0,
                lastFailureTime: new Date(),
                state: 'CLOSED'
            });
            return true;
        }

        const now = new Date();
        const timeSinceLastFailure = now.getTime() - state.lastFailureTime.getTime();

        switch (state.state) {
            case 'CLOSED':
                return true;
                
            case 'OPEN':
                if (timeSinceLastFailure > this.TIMEOUT_WINDOW) {
                    state.state = 'HALF_OPEN';
                    state.failures = 0;
                    this.logger.log(`Circuit breaker ${key} moving to HALF_OPEN state`);
                    return true;
                }
                this.logger.warn(`Circuit breaker ${key} is OPEN, rejecting request`);
                return false;
                
            case 'HALF_OPEN':
                return state.failures < this.HALF_OPEN_MAX_CALLS;
                
            default:
                return true;
        }
    }

    private recordSuccess(key: string): void {
        const state = this.circuitBreakers.get(key);
        if (state) {
            state.failures = 0;
            state.state = 'CLOSED';
            this.logger.debug(`Circuit breaker ${key} reset to CLOSED state`);
        }
    }

    private recordFailure(key: string): void {
        const state = this.circuitBreakers.get(key);
        if (!state) return;

        state.failures++;
        state.lastFailureTime = new Date();

        if (state.failures >= this.FAILURE_THRESHOLD) {
            state.state = 'OPEN';
            this.logger.error(
                `Circuit breaker ${key} opened after ${state.failures} failures`
            );
        } else if (state.state === 'HALF_OPEN') {
            state.state = 'OPEN';
            this.logger.error(
                `Circuit breaker ${key} opened from HALF_OPEN after failure`
            );
        }
    }

    /**
     * Executes an operation with retry logic and circuit breaker protection
     * @param operation - The async operation to retry
     * @param options - Retry configuration options
     * @returns Promise that resolves to the operation result
     */
    async execute<T>(
        operation: () => Promise<T>,
        options: RetryOptions = {},
    ): Promise<T> {
        const {
            maxRetries = 5,
            initialDelay = 2000,
            exponentialBackoff = true,
            shouldRetry = (error: Error) => this.defaultShouldRetry(error, options.context),
            onRetry,
            context
        } = options;

        const circuitBreakerKey = this.getCircuitBreakerKey(context);
        const operationContext = context ? 
            `[${Object.entries(context).map(([k, v]) => `${k}:${v}`).join(', ')}]` : 
            '[No Context]';

        // Check circuit breaker
        if (!this.checkCircuitBreaker(circuitBreakerKey)) {
            throw new Error(`Circuit breaker is OPEN for operation: ${circuitBreakerKey}`);
        }

        let lastError: Error | undefined;
        let delay = initialDelay;
        const startTime = new Date();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                
                // Record success for circuit breaker
                this.recordSuccess(circuitBreakerKey);
                
                const endTime = new Date();
                const duration = endTime.getTime() - startTime.getTime();
                
                if (attempt > 1) {
                    this.logger.log(
                        `${operationContext} Operation succeeded on attempt ${attempt} after ${duration}ms`
                    );
                }
                
                return result;
            } catch (error) {
                lastError = error as Error;
                const categorizedError = ErrorCategorizer.categorize(lastError, context);

                // Enhanced logging with categorization
                this.logger.warn(
                    `${operationContext} Operation failed on attempt ${attempt}/${maxRetries}: ${ErrorCategorizer.formatErrorForLogging(categorizedError)}`
                );

                // Record failure for circuit breaker
                this.recordFailure(circuitBreakerKey);

                // Check if we should retry this error
                if (!shouldRetry(lastError)) {
                    this.logger.error(
                        `${operationContext} Non-retryable error encountered: ${categorizedError.message}`
                    );
                    if (categorizedError.suggestions && categorizedError.suggestions.length > 0) {
                        this.logger.error(
                            `${operationContext} Suggestions: ${categorizedError.suggestions.join(', ')}`
                        );
                    }
                    throw lastError;
                }

                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    const endTime = new Date();
                    const totalDuration = endTime.getTime() - startTime.getTime();
                    
                    this.logger.error(
                        `${operationContext} Max retries (${maxRetries}) exceeded after ${totalDuration}ms. Final error: ${categorizedError.message}`
                    );
                    if (categorizedError.suggestions && categorizedError.suggestions.length > 0) {
                        this.logger.error(
                            `${operationContext} Suggestions: ${categorizedError.suggestions.join(', ')}`
                        );
                    }
                    throw lastError;
                }

                // Call retry callback if provided
                if (onRetry) {
                    onRetry(attempt, lastError);
                }

                // Log retry attempt with enhanced context
                this.logger.debug(
                    `${operationContext} Waiting ${delay}ms before retry attempt ${attempt + 1}. Error category: ${categorizedError.category}`
                );
                await new Promise(resolve => setTimeout(resolve, delay));

                // Apply exponential backoff with jitter to prevent thundering herd
                if (exponentialBackoff) {
                    delay = Math.min(delay * 2, 30000); // Cap at 30 seconds
                    // Add jitter (±20% randomness)
                    const jitter = delay * 0.2 * (Math.random() - 0.5);
                    delay = Math.round(delay + jitter);
                }
            }
        }

        // This should never be reached, but included for completeness
        throw lastError || new Error('Max retries exceeded');
    }

    /**
     * Convenience method for database operations with enhanced retry settings for connection issues
     */
    async executeDatabase<T>(
        operation: () => Promise<T>,
        context?: RetryOptions['context']
    ): Promise<T> {
        return this.execute(operation, {
            maxRetries: 7,
            initialDelay: 3000,
            exponentialBackoff: true,
            context: {
                operation: 'database_operation',
                ...context
            },
            shouldRetry: (error: Error) => {
                const categorizedError = ErrorCategorizer.categorize(error, context);
                // Allow retries for network, timeout, and some system errors
                return categorizedError.category === ErrorCategory.NETWORK ||
                       categorizedError.category === ErrorCategory.TIMEOUT ||
                       (categorizedError.category === ErrorCategory.UNKNOWN && 
                        categorizedError.isRetryable);
            }
        });
    }

    /**
     * Convenience method for API operations with common retry settings
     */
    async executeApi<T>(operation: () => Promise<T>): Promise<T> {
        return this.execute(operation, {
            maxRetries: 2,
            initialDelay: 500,
            exponentialBackoff: true,
            shouldRetry: (error: Error) => {
                // Retry on network errors and 5xx server errors
                return (
                    this.defaultShouldRetry(error) ||
                    error.message.includes('500') ||
                    error.message.includes('502') ||
                    error.message.includes('503') ||
                    error.message.includes('504')
                );
            },
        });
    }

    /**
     * Convenience method for file operations with common retry settings
     */
    async executeFile<T>(operation: () => Promise<T>): Promise<T> {
        return this.execute(operation, {
            maxRetries: 2,
            initialDelay: 250,
            exponentialBackoff: false,
            shouldRetry: (error: Error) => {
                // Retry on file system errors
                return (
                    error.message.includes('EBUSY') ||
                    error.message.includes('EMFILE') ||
                    error.message.includes('ENFILE') ||
                    error.message.includes('EAGAIN')
                );
            },
        });
    }

    /**
     * Get circuit breaker status for monitoring
     */
    getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
        return new Map(this.circuitBreakers);
    }

    /**
     * Reset a specific circuit breaker (for administrative purposes)
     */
    resetCircuitBreaker(key: string): void {
        this.circuitBreakers.delete(key);
        this.logger.log(`Circuit breaker ${key} manually reset`);
    }

    /**
     * Reset all circuit breakers
     */
    resetAllCircuitBreakers(): void {
        const count = this.circuitBreakers.size;
        this.circuitBreakers.clear();
        this.logger.log(`All ${count} circuit breakers manually reset`);
    }
}
