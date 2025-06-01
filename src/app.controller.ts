import { Controller, Get } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@ApiTags('📡 System Information & API Documentation')
@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        @InjectConnection() private connection: Connection,
    ) {}

    @Get()
    @ApiOperation({
        summary: '🏠 Welcome Message',
        description: 'Returns welcome message for the trainpro API system',
    })
    @ApiResponse({
        status: 200,
        description: 'Welcome message',
        schema: {
            type: 'string',
            example:
                'Welcome to trainpro API - Advanced Web-Based Examination & Marking System',
        },
    })
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('system-info')
    @ApiOperation({
        summary: '📋 System Information',
        description: `
            Comprehensive system information including:
            - System overview and description
            - Available modules and their status
            - Feature capabilities by category
            - Technical architecture details
            
            This endpoint provides a complete overview of the trainpro system
            for developers, administrators, and API consumers.
        `,
    })
    @ApiResponse({
        status: 200,
        description: 'Complete system information',
    })
    getSystemInfo() {
        return this.appService.getSystemInfo();
    }

    @Get('api-overview')
    @ApiOperation({
        summary: '🔧 API Technical Overview',
        description: `
            Technical details about the API including:
            - Base URL and versioning
            - Authentication methods
            - Response format standards
            - Error handling approach
            - Rate limiting information
            - Documentation location
            
            Essential information for API integration and development.
        `,
    })
    @ApiResponse({
        status: 200,
        description: 'API technical specifications',
    })
    getApiOverview() {
        return this.appService.getApiOverview();
    }

    @Get('database-schema')
    @ApiOperation({
        summary: '🗄️ Database Schema Information',
        description: `
            Database architecture and schema details including:
            - Schema description and design philosophy
            - Complete table listing with purposes
            - Entity relationships and foreign keys
            - Performance optimization features
            - Scalability considerations
            
            Useful for understanding data structure and relationships.
        `,
    })
    @ApiResponse({
        status: 200,
        description: 'Database schema information',
    })
    getDatabaseSchema() {
        return this.appService.getDatabaseSchema();
    }

    @Get('health')
    @ApiExcludeEndpoint() // Exclude from Swagger docs as it's internal
    async getHealth() {
        try {
            await this.connection.query('SELECT 1');
            return {
                status: 'ok',
                database: 'connected',
                timestamp: new Date().toISOString(),
            };
        } catch (error: unknown) {
            return {
                status: 'error',
                database: 'disconnected',
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unknown database error',
                timestamp: new Date().toISOString(),
            };
        }
    }
}
