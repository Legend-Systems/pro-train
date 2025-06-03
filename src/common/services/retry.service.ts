import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    exponentialBackoff?: boolean;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
}

@Injectable()
export class RetryService {
    private readonly logger = new Logger(RetryService.name);

    private readonly defaultShouldRetry = (error: Error): boolean => {
        // Default retry logic for common connection/timeout errors
        return (
            error.message.includes('ECONNRESET') ||
            error.message.includes('Connection lost') ||
            error.message.includes('connect ETIMEDOUT') ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout') ||
            error.message.includes('ESOCKETTIMEDOUT')
        );
    };

    /**
     * Executes an operation with retry logic
     * @param operation - The async operation to retry
     * @param options - Retry configuration options
     * @returns Promise that resolves to the operation result
     */
    async execute<T>(
        operation: () => Promise<T>,
        options: RetryOptions = {},
    ): Promise<T> {
        const {
            maxRetries = 3,
            initialDelay = 1000,
            exponentialBackoff = true,
            shouldRetry = this.defaultShouldRetry,
            onRetry,
        } = options;

        let lastError: Error | undefined;
        let delay = initialDelay;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                // Log the error
                this.logger.warn(
                    `Operation failed on attempt ${attempt}/${maxRetries}: ${lastError.message}`,
                );

                // Check if we should retry this error
                if (!shouldRetry(lastError)) {
                    this.logger.error(
                        `Non-retryable error encountered: ${lastError.message}`,
                    );
                    throw lastError;
                }

                // If this was the last attempt, throw the error
                if (attempt === maxRetries) {
                    this.logger.error(
                        `Max retries (${maxRetries}) exceeded. Last error: ${lastError.message}`,
                    );
                    throw lastError;
                }

                // Call retry callback if provided
                if (onRetry) {
                    onRetry(attempt, lastError);
                }

                // Wait before retrying
                this.logger.debug(
                    `Waiting ${delay}ms before retry attempt ${attempt + 1}`,
                );
                await new Promise(resolve => setTimeout(resolve, delay));

                // Apply exponential backoff if enabled
                if (exponentialBackoff) {
                    delay *= 2;
                }
            }
        }

        // This should never be reached, but included for completeness
        throw lastError || new Error('Max retries exceeded');
    }

    /**
     * Convenience method for database operations with common retry settings
     */
    async executeDatabase<T>(operation: () => Promise<T>): Promise<T> {
        return this.execute(operation, {
            maxRetries: 3,
            initialDelay: 1000,
            exponentialBackoff: true,
            shouldRetry: this.defaultShouldRetry,
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
}
