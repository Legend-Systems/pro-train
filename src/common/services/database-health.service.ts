import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DatabaseHealthService implements OnModuleInit {
    private readonly logger = new Logger(DatabaseHealthService.name);
    private isHealthy = true;
    private lastHealthCheck = new Date();
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 10;

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async onModuleInit() {
        this.logger.log('Database health monitoring initialized');
        await this.performHealthCheck();
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async performHealthCheck(): Promise<void> {
        try {
            await this.dataSource.query('SELECT 1');
            
            if (!this.isHealthy) {
                this.logger.log('Database connection restored');
                this.isHealthy = true;
                this.reconnectAttempts = 0;
            }
            
            this.lastHealthCheck = new Date();
        } catch (error) {
            this.logger.error('Database health check failed:', error);
            this.isHealthy = false;
            
            await this.handleConnectionFailure(error as Error);
        }
    }

    private async handleConnectionFailure(error: Error): Promise<void> {
        this.reconnectAttempts++;
        
        this.logger.warn(
            `Database connection issue detected (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`,
        );

        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            try {
                if (!this.dataSource.isInitialized) {
                    this.logger.log('Attempting to reinitialize database connection...');
                    await this.dataSource.initialize();
                } else {
                    this.logger.log('Attempting to reconnect to database...');
                    await this.dataSource.destroy();
                    await this.dataSource.initialize();
                }
                
                this.logger.log('Database reconnection successful');
                this.isHealthy = true;
                this.reconnectAttempts = 0;
            } catch (reconnectError) {
                this.logger.error('Database reconnection failed:', reconnectError);
                
                // Wait before next attempt with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                this.logger.log(`Waiting ${delay}ms before next reconnection attempt`);
                
                setTimeout(() => {
                    this.performHealthCheck();
                }, delay);
            }
        } else {
            this.logger.error(
                `Maximum reconnection attempts (${this.maxReconnectAttempts}) exceeded. Database connection critical failure.`
            );
        }
    }

    getHealthStatus(): {
        isHealthy: boolean;
        lastHealthCheck: Date;
        reconnectAttempts: number;
    } {
        return {
            isHealthy: this.isHealthy,
            lastHealthCheck: this.lastHealthCheck,
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    async forceHealthCheck(): Promise<void> {
        await this.performHealthCheck();
    }
} 