import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
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
import { OrgService } from './org.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { CreateBranchDto } from '../branch/dto/create-branch.dto';
import { UpdateBranchDto } from '../branch/dto/update-branch.dto';

@ApiTags('🏢 Organization & Branch Management')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class OrgController {
    private readonly logger = new Logger(OrgController.name);

    constructor(private readonly orgService: OrgService) {}

    // Organization endpoints
    @Post()
    @ApiOperation({
        summary: '🏗️ Create New Organization',
        description: `
        **Create Organization - Foundation of the trainpro Ecosystem**
        
        Organizations are the cornerstone of the trainpro platform, enabling:
        
        **🎯 Why Organizations Matter:**
        - **Multi-tenant Architecture**: Isolate data and operations between different institutions
        - **Scalable Exam Management**: Support universities, corporations, training centers simultaneously  
        - **Brand Identity**: Custom logos, websites, and organizational profiles
        - **Administrative Control**: Centralized management of all institutional activities
        - **Compliance & Security**: Organization-level data governance and access controls
        
        **🏫 Real-world Use Cases:**
        - Universities managing multiple campuses and departments
        - Corporations with different divisions and subsidiaries  
        - Training institutes with franchises across regions
        - Government agencies with various departments
        - Educational networks with multiple member institutions
        
        **✨ Platform Benefits:**
        - **Exam Isolation**: Tests created by one org don't interfere with others
        - **User Segmentation**: Students/staff belong to specific organizations
        - **Custom Branding**: Each org maintains its unique identity
        - **Resource Management**: Dedicated courses, tests, and content per organization
        - **Analytics Separation**: Performance metrics isolated by organization
        
        **🔧 Technical Features:**
        - Unique name validation across the entire platform
        - Support for organizational branding (logos, websites)
        - Active/inactive status for temporary suspension
        - Automatic relationship management with branches
        `,
        operationId: 'createOrganization',
    })
    @ApiBody({
        type: CreateOrgDto,
        description: 'Organization creation data with unique name validation',
        examples: {
            university: {
                summary: '🎓 University Example',
                description:
                    'Large educational institution with multiple campuses',
                value: {
                    name: 'Stanford University',
                    description:
                        'Leading research university with world-class programs in technology, medicine, and business',
                    logoUrl: 'https://cdn.stanford.edu/logo.png',
                    website: 'https://www.stanford.edu',
                },
            },
            corporation: {
                summary: '🏢 Corporate Example',
                description: 'Technology company with training programs',
                value: {
                    name: 'TechCorp Industries',
                    description:
                        'Global technology company providing innovative solutions and employee training programs',
                    logoUrl: 'https://cdn.techcorp.com/brand/logo.png',
                    website: 'https://www.techcorp.com',
                },
            },
            training: {
                summary: '📚 Training Institute Example',
                description: 'Professional certification and training center',
                value: {
                    name: 'Professional Skills Academy',
                    description:
                        'Comprehensive professional development and certification programs for working professionals',
                    logoUrl: 'https://cdn.psa.edu/logo.png',
                    website: 'https://www.psa.edu',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description:
            '✅ Organization created successfully - Ready for branch creation and user assignment',
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
                    example: 'Organization created successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Created organization data',
                    properties: {
                        id: {
                            type: 'string',
                            example: '1',
                            description: 'Unique organization identifier',
                        },
                        name: {
                            type: 'string',
                            example: 'Stanford University',
                            description: 'Organization name',
                        },
                        description: {
                            type: 'string',
                            example:
                                'Leading research university with world-class programs',
                            description: 'Organization description',
                        },
                        logoUrl: {
                            type: 'string',
                            example: 'https://cdn.stanford.edu/logo.png',
                            description: 'Organization logo URL',
                        },
                        website: {
                            type: 'string',
                            example: 'https://www.stanford.edu',
                            description: 'Organization website',
                        },
                        isActive: {
                            type: 'boolean',
                            example: true,
                            description: 'Organization active status',
                        },
                        createdAt: {
                            type: 'string',
                            example: '2025-01-15T10:30:45.123Z',
                            description: 'Creation timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description:
            '❌ Invalid input data - Check name length, URL format validation',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Organization name must be at least 2 characters long',
                        'Logo URL must be a valid URL',
                        'Website must be a valid URL',
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
        status: HttpStatus.CONFLICT,
        description:
            '⚠️ Organization name already exists - Names must be unique across the platform',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: {
                    type: 'string',
                    example:
                        'Organization with name "Stanford University" already exists',
                },
                error: { type: 'string', example: 'Conflict' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during organization creation',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async createOrganization(@Body() createOrgDto: CreateOrgDto) {
        this.logger.log(`Creating organization: ${createOrgDto.name}`);
        return await this.orgService.createOrganization(createOrgDto);
    }

    @Get()
    @ApiOperation({
        summary: '📋 List All Organizations',
        description: `
        **Organization Directory - Complete Platform Overview**
        
        **🔍 What This Provides:**
        - Complete list of all organizations in the trainpro platform
        - Hierarchical view showing organizations with their branches
        - Administrative overview for platform management
        - Quick access to organizational statistics and health
        
        **📊 Data Included:**
        - Organization profiles and branding information
        - Associated branches with location details
        - Active/inactive status for each organization
        - Creation timestamps for audit and reporting
        
        **🎯 Use Cases:**
        - **Platform Administration**: Monitor all organizations on the platform
        - **Onboarding Support**: Help new organizations understand the ecosystem
        - **Analytics Dashboards**: Generate platform-wide usage reports
        - **Customer Success**: Track organizational growth and expansion
        - **Sales Intelligence**: Identify opportunities for service expansion
        `,
        operationId: 'getAllOrganizations',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description:
            '✅ Organizations retrieved successfully with branch relationships',
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
                    example: 'Organizations retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'array',
                    description: 'List of organizations with branches',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                                description: 'Organization identifier',
                            },
                            name: {
                                type: 'string',
                                example: 'Stanford University',
                                description: 'Organization name',
                            },
                            description: {
                                type: 'string',
                                example: 'Leading research university',
                                description: 'Organization description',
                            },
                            isActive: {
                                type: 'boolean',
                                example: true,
                                description: 'Organization status',
                            },
                            branches: {
                                type: 'array',
                                description: 'Associated branches',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: {
                                            type: 'string',
                                            example:
                                                'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                                        },
                                        name: {
                                            type: 'string',
                                            example: 'Medical Center Campus',
                                        },
                                        address: {
                                            type: 'string',
                                            example: '450 Medical Plaza Drive',
                                        },
                                        isActive: {
                                            type: 'boolean',
                                            example: true,
                                        },
                                    },
                                },
                            },
                            createdAt: {
                                type: 'string',
                                example: '2025-01-01T00:00:00.000Z',
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
    async findAllOrganizations() {
        this.logger.log('Retrieving all organizations');
        return await this.orgService.findAllOrganizations();
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Organization Details',
        description: `
        **Organization Profile - Complete Institutional Overview**
        
        **🏛️ Detailed Organization Information:**
        - Complete organizational profile and branding
        - Full branch network with locations and contact details
        - Operational status and administrative information
        - Historical data and institutional timeline
        
        **📍 Branch Network Overview:**
        - All physical and virtual branch locations
        - Branch-specific contact information and management
        - Operating hours and availability schedules
        - Local administrative contacts and responsibilities
        
        **🎯 Critical for Operations:**
        - **Exam Scheduling**: Understanding available locations and capacity
        - **User Assignment**: Determining which branches users belong to
        - **Resource Allocation**: Planning equipment and space requirements
        - **Communication**: Directing inquiries to appropriate branch contacts
        - **Compliance**: Ensuring all locations meet regulatory requirements
        `,
        operationId: 'getOrganizationById',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier (UUID format)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description:
            '✅ Organization retrieved successfully with complete branch network',
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
                    example: 'Organization retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Complete organization data with branches',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                            description: 'Organization identifier',
                        },
                        name: {
                            type: 'string',
                            example: 'Stanford University',
                            description: 'Organization name',
                        },
                        description: {
                            type: 'string',
                            example:
                                'Leading research university with world-class programs',
                            description: 'Organization description',
                        },
                        logoUrl: {
                            type: 'string',
                            example: 'https://cdn.stanford.edu/logo.png',
                            description: 'Organization logo URL',
                        },
                        website: {
                            type: 'string',
                            example: 'https://www.stanford.edu',
                            description: 'Organization website',
                        },
                        isActive: {
                            type: 'boolean',
                            example: true,
                            description: 'Organization active status',
                        },
                        branches: {
                            type: 'array',
                            description: 'Complete branch network',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        example:
                                            'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                                    },
                                    name: {
                                        type: 'string',
                                        example: 'Medical Center Campus',
                                    },
                                    address: {
                                        type: 'string',
                                        example:
                                            '450 Medical Plaza Drive, CA 90095',
                                    },
                                    contactNumber: {
                                        type: 'string',
                                        example: '+1-310-825-9111',
                                    },
                                    email: {
                                        type: 'string',
                                        example: 'medcenter@stanford.edu',
                                    },
                                    managerName: {
                                        type: 'string',
                                        example: 'Dr. Sarah Johnson',
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
                                    },
                                    isActive: {
                                        type: 'boolean',
                                        example: true,
                                    },
                                    createdAt: {
                                        type: 'string',
                                        example: '2025-01-01T00:00:00.000Z',
                                    },
                                },
                            },
                        },
                        createdAt: {
                            type: 'string',
                            example: '2025-01-01T00:00:00.000Z',
                            description: 'Creation timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid organization ID format',
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
        description:
            '❌ Organization not found - Invalid ID or organization may have been deleted',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Organization with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
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
    async findOrganizationById(@Param('id') id: string) {
        this.logger.log(`Retrieving organization: ${id}`);
        return await this.orgService.findOrganizationById(id);
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: '📊 Organization Analytics & Statistics',
        description: `
        **Organization Metrics - Performance & Growth Insights**
        
        **📈 Key Performance Indicators:**
        - Total branch count and geographic distribution
        - Active vs inactive branch status breakdown
        - Growth trends and expansion patterns
        - Operational efficiency metrics
        
        **🎯 Business Intelligence Value:**
        - **Capacity Planning**: Understand current infrastructure
        - **Expansion Planning**: Identify growth opportunities
        - **Resource Optimization**: Balance load across branches
        - **Performance Monitoring**: Track organizational health
        - **Compliance Reporting**: Generate regulatory reports
        
        **💡 Strategic Applications:**
        - Facility management and space utilization
        - Budget allocation and resource planning
        - Risk assessment and business continuity
        - Market analysis and competitive positioning
        `,
        operationId: 'getOrganizationStats',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier for statistics',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Organization statistics retrieved successfully',
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
                    example: 'Organization statistics retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Organization statistics and metrics',
                    properties: {
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
                            },
                        },
                        stats: {
                            type: 'object',
                            properties: {
                                totalBranches: {
                                    type: 'number',
                                    example: 15,
                                    description: 'Total number of branches',
                                },
                                activeBranches: {
                                    type: 'number',
                                    example: 12,
                                    description: 'Number of active branches',
                                },
                                inactiveBranches: {
                                    type: 'number',
                                    example: 3,
                                    description: 'Number of inactive branches',
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
        description: '❌ Invalid organization ID format',
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
        description: '❌ Organization not found - Cannot generate statistics',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Organization with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during statistics generation',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async getOrganizationStats(@Param('id') id: string) {
        this.logger.log(`Retrieving statistics for organization: ${id}`);
        return await this.orgService.getOrganizationStats(id);
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Organization Profile',
        description: `
        **Organization Management - Keep Information Current**
        
        **🔄 Updatable Information:**
        - Organizational name (with uniqueness validation)
        - Mission statement and institutional description  
        - Branding elements (logo, website)
        - Operational status (active/inactive)
        
        **🎯 Why Updates Matter:**
        - **Brand Consistency**: Maintain current logos and messaging
        - **Regulatory Compliance**: Update information per legal requirements
        - **User Experience**: Ensure accurate information across platform
        - **Business Continuity**: Manage organizational status changes
        - **Marketing Alignment**: Keep branding synchronized
        
        **⚠️ Important Considerations:**
        - Name changes affect all users and data relationships
        - Status changes impact exam access and operations
        - Branding updates reflect across all user interfaces
        - Changes are logged for audit and compliance
        `,
        operationId: 'updateOrganization',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier to update',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiBody({
        type: UpdateOrgDto,
        description: 'Organization update data (all fields optional)',
        examples: {
            'name-update': {
                summary: '📝 Organization Name Change',
                description: 'Update organization name with uniqueness check',
                value: {
                    name: 'Stanford University Medical Center',
                },
            },
            'branding-update': {
                summary: '🎨 Branding Update',
                description: 'Update logo and website information',
                value: {
                    logoUrl: 'https://cdn.stanford.edu/new-logo-2025.png',
                    website: 'https://www.stanford.edu',
                },
            },
            'full-update': {
                summary: '🔄 Complete Profile Update',
                description: 'Update all available organization fields',
                value: {
                    name: 'Stanford University',
                    description:
                        'Premier research university with cutting-edge programs in technology, medicine, and innovation',
                    logoUrl: 'https://cdn.stanford.edu/logo-updated.png',
                    website: 'https://www.stanford.edu',
                    isActive: true,
                },
            },
            'status-change': {
                summary: '⚡ Status Change',
                description: 'Activate or deactivate organization',
                value: {
                    isActive: false,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Organization updated successfully',
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
                    example: 'Organization updated successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Updated organization data',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                            description: 'Organization identifier',
                        },
                        name: {
                            type: 'string',
                            example: 'Stanford University Medical Center',
                            description: 'Updated organization name',
                        },
                        description: {
                            type: 'string',
                            example:
                                'Premier research university with cutting-edge programs',
                            description: 'Updated description',
                        },
                        logoUrl: {
                            type: 'string',
                            example:
                                'https://cdn.stanford.edu/new-logo-2025.png',
                            description: 'Updated logo URL',
                        },
                        website: {
                            type: 'string',
                            example: 'https://www.stanford.edu',
                            description: 'Updated website URL',
                        },
                        isActive: {
                            type: 'boolean',
                            example: true,
                            description: 'Updated active status',
                        },
                        updatedAt: {
                            type: 'string',
                            example: '2025-01-15T10:45:30.567Z',
                            description: 'Update timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Organization name must be at least 2 characters long',
                        'Logo URL must be a valid URL',
                        'Website must be a valid URL',
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
        description: '❌ Organization not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Organization with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Organization name already exists',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: {
                    type: 'string',
                    example:
                        'Organization with name "Stanford University Medical Center" already exists',
                },
                error: { type: 'string', example: 'Conflict' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during organization update',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async updateOrganization(
        @Param('id') id: string,
        @Body() updateOrgDto: UpdateOrgDto,
    ) {
        this.logger.log(`Updating organization: ${id}`);
        return await this.orgService.updateOrganization(id, updateOrgDto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Organization',
        description: `
        **Organization Removal - Complete Data Cleanup**
        
        ⚠️ **CRITICAL WARNING - IRREVERSIBLE ACTION**
        
        **🚨 What Gets Deleted:**
        - The organization record and all metadata
        - ALL associated branches and their data
        - User assignments and organizational relationships
        - Exams, courses, and content created under this organization
        - Historical data, reports, and analytics
        
        **💥 Cascade Effects:**
        - All users lose organizational affiliation
        - Active exams and tests become inaccessible
        - Branch-specific data and configurations removed
        - Integration connections and API access revoked
        
        **🛡️ Before Deletion Checklist:**
        - Export critical data and reports
        - Notify all users of pending closure
        - Complete any ongoing exams or assessments
        - Transfer ownership of shared content
        - Update integrations and external systems
        
        **🔄 Alternatives to Consider:**
        - Set organization as inactive instead of deletion
        - Transfer branches to another organization
        - Archive data before removal
        `,
        operationId: 'deleteOrganization',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier to delete',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description:
            '✅ Organization deleted successfully - All data permanently removed',
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
                    example: 'Organization deleted successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'null',
                    description: 'No data returned for deletion operations',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid organization ID format',
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
        description:
            '❌ Organization not found - May have been already deleted',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Organization with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description:
            '🚫 Forbidden - Organization has dependent data that prevents deletion',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: {
                    type: 'string',
                    example:
                        'Cannot delete organization with active branches or users',
                },
                error: { type: 'string', example: 'Forbidden' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during organization deletion',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async deleteOrganization(@Param('id') id: string) {
        this.logger.log(`Deleting organization: ${id}`);
        await this.orgService.deleteOrganization(id);
    }

    // Branch endpoints
    @Post(':organizationId/branches')
    @ApiOperation({
        summary: '🏪 Create Branch Location',
        description: `
        **Branch Creation - Expand Organizational Reach**
        
        **🌍 Why Branches Are Essential:**
        Branches represent the physical and operational divisions within organizations:
        
        **🏫 Educational Institutions:**
        - Multiple campuses (Main Campus, Medical Center, Law School)
        - Departments (Engineering, Business, Arts & Sciences)
        - Regional centers and satellite locations
        - Research facilities and specialized labs
        
        **🏢 Corporate Organizations:**
        - Regional offices (North America, Europe, Asia-Pacific)
        - Business units (Sales, Engineering, Customer Support)
        - Training centers and learning facilities
        - Remote work hubs and co-working spaces
        
        **🎯 Operational Benefits:**
        - **Localized Management**: Branch-specific administrators and policies
        - **Geographic Distribution**: Serve users across different locations
        - **Resource Allocation**: Dedicated equipment and facility management
        - **Scheduling Optimization**: Location-specific exam scheduling
        - **Compliance Alignment**: Meet local regulatory requirements
        
        **📊 Exam Management Value:**
        - Users assigned to specific branches for better organization
        - Proctored exams can be location-specific
        - Resource planning based on branch capacity
        - Local support and technical assistance
        - Branch-level reporting and analytics
        `,
        operationId: 'createBranch',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Parent organization identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: 'string',
        format: 'uuid',
    })
    @ApiBody({
        type: CreateBranchDto,
        description: 'Branch creation data with operational details',
        examples: {
            campus: {
                summary: '🏫 University Campus',
                description: 'Educational institution campus branch',
                value: {
                    name: 'Medical Center Campus',
                    address:
                        '450 Medical Plaza Drive, Health Sciences District, CA 90095',
                    contactNumber: '+1-310-825-9111',
                    email: 'medcenter@university.edu',
                    managerName: 'Dr. Sarah Johnson',
                    operatingHours: {
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
                },
            },
            office: {
                summary: '🏢 Corporate Office',
                description: 'Corporate regional office branch',
                value: {
                    name: 'Pacific Northwest Regional Office',
                    address:
                        '1200 Tech Tower, Innovation District, Seattle, WA 98101',
                    contactNumber: '+1-206-555-0199',
                    email: 'pnw.office@techcorp.com',
                    managerName: 'Michael Chen',
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
            training: {
                summary: '📚 Training Center',
                description:
                    'Professional development and certification center',
                value: {
                    name: 'Downtown Training Center',
                    address: '789 Learning Avenue, Business District, NY 10001',
                    contactNumber: '+1-212-555-0167',
                    email: 'downtown@skillsacademy.edu',
                    managerName: 'Lisa Rodriguez',
                    operatingHours: {
                        opening: '09:00',
                        closing: '21:00',
                        days: [
                            'Monday',
                            'Tuesday',
                            'Wednesday',
                            'Thursday',
                            'Friday',
                            'Saturday',
                        ],
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description:
            '✅ Branch created successfully - Ready for user assignment and exam scheduling',
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
                    example: 'Branch created successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Created branch data',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
                            description: 'Unique branch identifier',
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
                        createdAt: {
                            type: 'string',
                            example: '2025-01-15T10:30:45.123Z',
                            description: 'Creation timestamp',
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
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or organization ID format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Branch name must be at least 2 characters long',
                        'Email must be a valid email address',
                        'Invalid UUID format for organization ID',
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
        description:
            '❌ Organization not found - Cannot create branch without valid parent organization',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example:
                        'Organization with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal server error during branch creation',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
            },
        },
    })
    async createBranch(
        @Param('organizationId') organizationId: string,
        @Body() createBranchDto: CreateBranchDto,
    ) {
        this.logger.log(
            `Creating branch "${createBranchDto.name}" in organization: ${organizationId}`,
        );
        return await this.orgService.createBranch(
            organizationId,
            createBranchDto,
        );
    }

    @Get(':organizationId/branches')
    @ApiOperation({
        summary: '🏪 List Organization Branches',
        description: `
        **Branch Directory - Complete Location Network**
        
        **🗺️ Comprehensive Branch Overview:**
        - All branches within the organization
        - Geographic distribution and location details
        - Contact information and local management
        - Operational status and availability
        
        **📋 Essential for Operations:**
        - **User Assignment**: Determine where users should be allocated
        - **Exam Scheduling**: Plan test sessions across locations
        - **Resource Planning**: Allocate equipment and personnel
        - **Communication**: Route inquiries to appropriate branches
        - **Compliance**: Ensure all locations meet standards
        
        **🎯 Management Applications:**
        - Facility utilization and capacity planning
        - Regional performance analysis and comparison
        - Emergency preparedness and business continuity
        - Quality assurance and standardization efforts
        `,
        operationId: 'getOrganizationBranches',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Organization identifier to list branches',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description:
            '✅ Branches retrieved successfully with operational details',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found - Cannot list branches',
    })
    async findAllBranches(@Param('organizationId') organizationId: string) {
        this.logger.log(
            `Retrieving branches for organization: ${organizationId}`,
        );
        return await this.orgService.findAllBranches(organizationId);
    }

    @Get(':organizationId/branches/:branchId')
    @ApiOperation({
        summary: '🔍 Get Branch Details',
        description: `
        **Branch Profile - Complete Location Information**
        
        **🏢 Detailed Branch Information:**
        - Complete branch profile and contact details
        - Operating schedules and availability windows
        - Local management and administrative contacts
        - Parent organization context and relationships
        
        **🎯 Critical Operational Data:**
        - **Scheduling**: Plan exams during operating hours
        - **Support**: Direct users to appropriate contacts
        - **Logistics**: Coordinate equipment and resource delivery
        - **Emergency**: Access location and contact information
        - **Compliance**: Verify operational standards and requirements
        `,
        operationId: 'getBranchById',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Parent organization identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'branchId',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch retrieved successfully with complete details',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch or organization not found',
    })
    async findBranchById(
        @Param('organizationId') organizationId: string,
        @Param('branchId') branchId: string,
    ) {
        this.logger.log(
            `Retrieving branch ${branchId} from organization: ${organizationId}`,
        );
        return await this.orgService.findBranchById(organizationId, branchId);
    }

    @Put(':organizationId/branches/:branchId')
    @ApiOperation({
        summary: '✏️ Update Branch Information',
        description: `
        **Branch Management - Keep Location Data Current**
        
        **🔄 Updatable Branch Information:**
        - Contact details and address changes
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
        name: 'organizationId',
        description: 'Parent organization identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'branchId',
        description: 'Branch unique identifier to update',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiBody({
        type: UpdateBranchDto,
        description: 'Branch update data (all fields optional)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch updated successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch or organization not found',
    })
    async updateBranch(
        @Param('organizationId') organizationId: string,
        @Param('branchId') branchId: string,
        @Body() updateBranchDto: UpdateBranchDto,
    ) {
        this.logger.log(
            `Updating branch ${branchId} in organization: ${organizationId}`,
        );
        return await this.orgService.updateBranch(
            organizationId,
            branchId,
            updateBranchDto,
        );
    }

    @Delete(':organizationId/branches/:branchId')
    @ApiOperation({
        summary: '🗑️ Delete Branch',
        description: `
        **Branch Removal - Location Closure**
        
        ⚠️ **Important Considerations Before Deletion:**
        
        **🚨 Impact Assessment:**
        - Users currently assigned to this branch
        - Active exams scheduled at this location
        - Equipment and resources allocated to the branch
        - Historical data and performance records
        
        **📋 Pre-deletion Checklist:**
        - Transfer users to alternative branches
        - Reschedule or relocate pending examinations
        - Reassign equipment and physical resources
        - Archive important branch-specific data
        - Update organizational directory and communications
        
        **🔄 Alternative Approaches:**
        - Set branch as inactive instead of permanent deletion
        - Merge with another branch location
        - Convert to remote/virtual branch status
        
        **💡 Data Preservation:**
        - Export branch-specific reports and analytics
        - Document closure reason for compliance
        - Maintain contact information for reference
        `,
        operationId: 'deleteBranch',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Parent organization identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'branchId',
        description: 'Branch unique identifier to delete',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description:
            '✅ Branch deleted successfully - Users and resources should be reallocated',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch or organization not found',
    })
    async deleteBranch(
        @Param('organizationId') organizationId: string,
        @Param('branchId') branchId: string,
    ) {
        this.logger.log(
            `Deleting branch ${branchId} from organization: ${organizationId}`,
        );
        await this.orgService.deleteBranch(organizationId, branchId);
    }
}
