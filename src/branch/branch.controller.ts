import {
    Controller,
    Get,
    Put,
    Body,
    Param,
    Delete,
    HttpStatus,
    Logger,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
    ApiHeader,
    ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BranchService } from './branch.service';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('🏪 Branch Management')
@Controller('branches')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class BranchController {
    private readonly logger = new Logger(BranchController.name);

    constructor(private readonly branchService: BranchService) {}

    @Get()
    @ApiOperation({
        summary: '📋 List All Branches',
        description: `
        **Retrieves all branches across all organizations**
        
        **🏪 Complete Branch Directory:**
        - All branches from every organization on the platform
        - Branch details including contact information and management
        - Associated organization information for context
        - Operational status and availability data
        
        **📊 Data Included:**
        - Branch profiles and contact details
        - Operating hours and management information
        - Parent organization relationships
        - Geographic distribution insights
        
        **🎯 Administrative Use Cases:**
        - **Platform Management**: Monitor all branch locations globally
        - **Resource Planning**: Understand total capacity across platform
        - **Support Operations**: Route inquiries to appropriate branches
        - **Analytics**: Generate cross-organizational reports
        - **Compliance**: Ensure all locations meet standards
        
        **💡 Business Intelligence:**
        - Geographic distribution analysis
        - Branch density and coverage assessment
        - Resource allocation optimization
        - Performance benchmarking across organizations
        `,
        operationId: 'getAllBranches',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branches retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success status',
                },
                message: {
                    type: 'string',
                    example: 'All branches retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'array',
                    description: 'List of all branches across organizations',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                                description: 'Branch identifier',
                            },
                            name: {
                                type: 'string',
                                example: 'Medical Center Campus',
                                description: 'Branch name',
                            },
                            address: {
                                type: 'string',
                                example: '450 Medical Plaza Drive, CA 90095',
                                description: 'Branch address',
                            },
                            contactNumber: {
                                type: 'string',
                                example: '+1-310-825-9111',
                                description: 'Branch contact phone',
                            },
                            email: {
                                type: 'string',
                                example: 'medcenter@university.edu',
                                description: 'Branch email',
                            },
                            managerName: {
                                type: 'string',
                                example: 'Dr. Sarah Johnson',
                                description: 'Branch manager',
                            },
                            isActive: {
                                type: 'boolean',
                                example: true,
                                description: 'Branch status',
                            },
                            organization: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        example:
                                            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                    },
                                    name: {
                                        type: 'string',
                                        example: 'Stanford University',
                                    },
                                    isActive: {
                                        type: 'boolean',
                                        example: true,
                                    },
                                },
                            },
                            createdAt: {
                                type: 'string',
                                example: '2024-01-01T00:00:00.000Z',
                                description: 'Creation timestamp',
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during data retrieval',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async findAll() {
        this.logger.log('Retrieving all branches');
        return await this.branchService.findAll();
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Branch by ID',
        description: `
        **Retrieves a specific branch with organization context**
        
        **🏢 Detailed Branch Information:**
        - Complete branch profile and contact details
        - Operating hours and management information
        - Associated organization details and context
        - Operational status and availability
        
        **📋 Essential Data:**
        - Branch location and contact information
        - Management personnel and responsibilities
        - Operating schedules and availability windows
        - Parent organization relationship
        
        **🎯 Use Cases:**
        - **User Assignment**: Determine branch affiliation for users
        - **Exam Scheduling**: Plan tests based on operating hours
        - **Support Routing**: Direct inquiries to appropriate contacts
        - **Resource Planning**: Understand branch capacity and capabilities
        - **Compliance**: Verify branch meets operational requirements
        `,
        operationId: 'getBranchById',
    })
    @ApiParam({
        name: 'id',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Branch retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Complete branch data with organization',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                            description: 'Branch identifier',
                        },
                        name: {
                            type: 'string',
                            example: 'Medical Center Campus',
                            description: 'Branch name',
                        },
                        address: {
                            type: 'string',
                            example:
                                '450 Medical Plaza Drive, Health Sciences District, CA 90095',
                            description: 'Branch address',
                        },
                        contactNumber: {
                            type: 'string',
                            example: '+1-310-825-9111',
                            description: 'Branch contact phone',
                        },
                        email: {
                            type: 'string',
                            example: 'medcenter@university.edu',
                            description: 'Branch email address',
                        },
                        managerName: {
                            type: 'string',
                            example: 'Dr. Sarah Johnson',
                            description: 'Branch manager name',
                        },
                        operatingHours: {
                            type: 'object',
                            example: {
                                opening: '07:00',
                                closing: '19:00',
                                days: [
                                    'Monday',
                                    'Tuesday',
                                    'Wednesday',
                                    'Thursday',
                                    'Friday',
                                    'Saturday',
                                ],
                            },
                            description: 'Branch operating schedule',
                        },
                        isActive: {
                            type: 'boolean',
                            example: true,
                            description: 'Branch active status',
                        },
                        organization: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    example:
                                        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                },
                                name: {
                                    type: 'string',
                                    example: 'Stanford University',
                                },
                                isActive: { type: 'boolean', example: true },
                                logoUrl: {
                                    type: 'string',
                                    example:
                                        'https://cdn.stanford.edu/logo.png',
                                },
                                website: {
                                    type: 'string',
                                    example: 'https://www.stanford.edu',
                                },
                            },
                        },
                        createdAt: {
                            type: 'string',
                            example: '2024-01-01T00:00:00.000Z',
                            description: 'Creation timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid branch ID format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Invalid UUID format' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Branch with ID b1c2d3e4-f5g6-7890-bcde-fg1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during data retrieval',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async findOne(@Param('id') id: string) {
        this.logger.log(`Retrieving branch: ${id}`);
        return await this.branchService.findById(id);
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Branch Information',
        description: `
        **Updates branch information directly**
        
        **🔄 Updatable Information:**
        - Branch contact information and address changes
        - Operating hours and schedule modifications
        - Management personnel updates
        - Service availability and status changes
        
        **🎯 Why Branch Updates Matter:**
        - **User Experience**: Accurate contact and location information
        - **Operational Efficiency**: Current schedules for exam planning
        - **Emergency Preparedness**: Up-to-date contact information
        - **Regulatory Compliance**: Maintain accurate records
        - **Quality Assurance**: Reflect current management and capabilities
        
        **📋 Common Update Scenarios:**
        - Facility relocations or address changes
        - Management personnel transitions
        - Operating hour adjustments for seasonal changes
        - Contact information updates for better communication
        - Status changes for temporary closures or maintenance
        `,
        operationId: 'updateBranch',
    })
    @ApiParam({
        name: 'id',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiBody({
        type: UpdateBranchDto,
        description: 'Branch update data (all fields optional)',
        examples: {
            'contact-update': {
                summary: '📞 Contact Information Update',
                description: 'Update branch contact details',
                value: {
                    contactNumber: '+1-310-825-9999',
                    email: 'new.contact@university.edu',
                    managerName: 'Dr. Michael Thompson',
                },
            },
            'address-change': {
                summary: '🏢 Address Change',
                description: 'Update branch location',
                value: {
                    address: '500 New Medical Plaza Drive, CA 90095',
                },
            },
            'hours-update': {
                summary: '⏰ Operating Hours Update',
                description: 'Modify branch operating schedule',
                value: {
                    operatingHours: {
                        opening: '08:00',
                        closing: '18:00',
                        days: [
                            'Monday',
                            'Tuesday',
                            'Wednesday',
                            'Thursday',
                            'Friday',
                        ],
                    },
                },
            },
            'status-change': {
                summary: '⚡ Status Change',
                description: 'Activate or deactivate branch',
                value: {
                    isActive: false,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch updated successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Update operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Branch updated successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Updated branch data',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                            description: 'Branch identifier',
                        },
                        name: {
                            type: 'string',
                            example: 'Medical Center Campus',
                            description: 'Branch name',
                        },
                        address: {
                            type: 'string',
                            example: '500 New Medical Plaza Drive, CA 90095',
                            description: 'Updated branch address',
                        },
                        contactNumber: {
                            type: 'string',
                            example: '+1-310-825-9999',
                            description: 'Updated contact phone',
                        },
                        email: {
                            type: 'string',
                            example: 'new.contact@university.edu',
                            description: 'Updated email address',
                        },
                        managerName: {
                            type: 'string',
                            example: 'Dr. Michael Thompson',
                            description: 'Updated manager name',
                        },
                        isActive: {
                            type: 'boolean',
                            example: true,
                            description: 'Updated active status',
                        },
                        updatedAt: {
                            type: 'string',
                            example: '2024-01-15T10:45:30.567Z',
                            description: 'Update timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or branch ID format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Email must be a valid email address',
                        'Branch name must be at least 2 characters long',
                        'Invalid UUID format',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Branch with ID b1c2d3e4-f5g6-7890-bcde-fg1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during branch update',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async update(
        @Param('id') id: string,
        @Body() updateBranchDto: UpdateBranchDto,
    ) {
        this.logger.log(`Updating branch: ${id}`);
        return await this.branchService.update(id, updateBranchDto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Branch',
        description: `
        **Permanently removes a branch from the system**
        
        **⚠️ Critical Operation Warning:**
        - Irreversibly deletes the branch record
        - May cascade delete associated user assignments
        - Affects operational capacity and resource allocation
        - Cannot be undone without data recovery procedures
        
        **📋 Pre-deletion Considerations:**
        - Verify no active users are assigned to this branch
        - Ensure no ongoing exams or training sessions
        - Confirm alternative branch assignments for affected users
        - Review organizational structure impact
        
        **🎯 Use Cases:**
        - **Branch Closure**: Permanent facility shutdown
        - **Organizational Restructuring**: Merging or consolidating branches
        - **Data Cleanup**: Removing test or invalid branch records
        - **Compliance**: Meeting regulatory closure requirements
        
        **⚡ Best Practices:**
        - Archive branch data before deletion
        - Notify affected users and administrators
        - Update routing and assignment logic
        - Document business justification for audit trails
        `,
        operationId: 'deleteBranch',
    })
    @ApiParam({
        name: 'id',
        description: 'Branch unique identifier to delete',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Deletion operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Branch deleted successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Deletion confirmation details',
                    properties: {
                        deletedBranchId: {
                            type: 'string',
                            example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                            description: 'ID of the deleted branch',
                        },
                        deletedAt: {
                            type: 'string',
                            example: '2024-01-15T10:45:30.567Z',
                            description: 'Deletion timestamp',
                        },
                        affectedRecords: {
                            type: 'object',
                            properties: {
                                userAssignments: {
                                    type: 'number',
                                    example: 0,
                                    description:
                                        'Number of user assignments affected',
                                },
                                activeExams: {
                                    type: 'number',
                                    example: 0,
                                    description:
                                        'Number of active exams affected',
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid branch ID format or deletion constraints',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'string',
                    example:
                        'Cannot delete branch with active user assignments',
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
                error: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Branch with ID b1c2d3e4-f5g6-7890-bcde-fg1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description:
            '⚠️ Conflict - Branch has dependencies that prevent deletion',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: {
                    type: 'string',
                    example:
                        'Cannot delete branch: 15 active user assignments and 3 ongoing exams',
                },
                error: { type: 'string', example: 'Conflict' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during branch deletion',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
                error: { type: 'string', example: 'Internal Server Error' },
            },
        },
    })
    async remove(@Param('id') id: string) {
        this.logger.log(`Deleting branch: ${id}`);
        return await this.branchService.remove(id);
    }
}
