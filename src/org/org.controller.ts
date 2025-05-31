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
export class OrgController {
    private readonly logger = new Logger(OrgController.name);

    constructor(private readonly orgService: OrgService) {}

    // Organization endpoints
    @Post()
    @ApiOperation({
        summary: '🏗️ Create New Organization',
        description: `
        **Creates a new organization with comprehensive validation**
        
        This endpoint allows creating new organizations with:
        - Unique name validation across the system
        - Optional branding elements (logo, website)
        - Automatic timestamp tracking
        
        **Business Rules:**
        - Organization name must be unique
        - Name must be at least 2 characters long
        - Logo and website URLs must be valid if provided
        `,
        operationId: 'createOrganization',
    })
    @ApiBody({
        type: CreateOrgDto,
        description: 'Organization creation data',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Organization created successfully',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Organization name already exists',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data',
    })
    async createOrganization(@Body() createOrgDto: CreateOrgDto) {
        this.logger.log(`Creating organization: ${createOrgDto.name}`);
        return await this.orgService.createOrganization(createOrgDto);
    }

    @Get()
    @ApiOperation({
        summary: '📋 List All Organizations',
        description: `
        **Retrieves all organizations with their branches**
        
        Returns comprehensive organization data including:
        - Organization details and metadata
        - Associated branches for each organization
        - Ordered by creation date (newest first)
        `,
        operationId: 'getAllOrganizations',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Organizations retrieved successfully',
    })
    async findAllOrganizations() {
        this.logger.log('Retrieving all organizations');
        return await this.orgService.findAllOrganizations();
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Organization by ID',
        description: `
        **Retrieves a specific organization with all its branches**
        
        Returns detailed organization information including:
        - Organization profile and settings
        - Complete list of associated branches
        - Branch details and status
        `,
        operationId: 'getOrganizationById',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Organization retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found',
    })
    async findOrganizationById(@Param('id') id: string) {
        this.logger.log(`Retrieving organization: ${id}`);
        return await this.orgService.findOrganizationById(id);
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: '📊 Get Organization Statistics',
        description: `
        **Retrieves comprehensive statistics for an organization**
        
        Returns statistical information including:
        - Total number of branches
        - Active vs inactive branch counts
        - Organization performance metrics
        `,
        operationId: 'getOrganizationStats',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Organization statistics retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found',
    })
    async getOrganizationStats(@Param('id') id: string) {
        this.logger.log(`Retrieving statistics for organization: ${id}`);
        return await this.orgService.getOrganizationStats(id);
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Organization',
        description: `
        **Updates organization information with validation**
        
        Allows updating:
        - Organization name (with uniqueness validation)
        - Description and branding elements
        - Active status to enable/disable organization
        `,
        operationId: 'updateOrganization',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiBody({
        type: UpdateOrgDto,
        description: 'Organization update data',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Organization updated successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Organization name already exists',
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
        **Permanently deletes an organization and all its branches**
        
        ⚠️ **WARNING:** This action:
        - Permanently removes the organization
        - Cascades to delete all associated branches
        - Cannot be undone
        `,
        operationId: 'deleteOrganization',
    })
    @ApiParam({
        name: 'id',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '✅ Organization deleted successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found',
    })
    async deleteOrganization(@Param('id') id: string) {
        this.logger.log(`Deleting organization: ${id}`);
        await this.orgService.deleteOrganization(id);
    }

    // Branch endpoints
    @Post(':organizationId/branches')
    @ApiOperation({
        summary: '🏪 Create Branch in Organization',
        description: `
        **Creates a new branch within a specific organization**
        
        Establishes a new branch location with:
        - Automatic organization association
        - Branch-specific contact information
        - Operating hours and management details
        `,
        operationId: 'createBranch',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiBody({
        type: CreateBranchDto,
        description: 'Branch creation data',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Branch created successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found',
    })
    async createBranch(
        @Param('organizationId') organizationId: string,
        @Body() createBranchDto: CreateBranchDto,
    ) {
        this.logger.log(
            `Creating branch "${createBranchDto.name}" in organization: ${organizationId}`,
        );
        return await this.orgService.createBranch(organizationId, createBranchDto);
    }

    @Get(':organizationId/branches')
    @ApiOperation({
        summary: '🏪 List Organization Branches',
        description: `
        **Retrieves all branches for a specific organization**
        
        Returns branch information including:
        - Branch details and contact information
        - Operating hours and management info
        - Branch status and activity
        `,
        operationId: 'getOrganizationBranches',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branches retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Organization not found',
    })
    async findAllBranches(@Param('organizationId') organizationId: string) {
        this.logger.log(`Retrieving branches for organization: ${organizationId}`);
        return await this.orgService.findAllBranches(organizationId);
    }

    @Get(':organizationId/branches/:branchId')
    @ApiOperation({
        summary: '🔍 Get Specific Branch',
        description: `
        **Retrieves detailed information for a specific branch**
        
        Returns comprehensive branch data including:
        - Branch profile and contact details
        - Operating hours and management information
        - Organization context and relationship
        `,
        operationId: 'getBranchById',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'branchId',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch retrieved successfully',
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
        **Updates branch information within an organization**
        
        Allows updating:
        - Branch contact information and address
        - Operating hours and management details
        - Branch status and activity settings
        `,
        operationId: 'updateBranch',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'branchId',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiBody({
        type: UpdateBranchDto,
        description: 'Branch update data',
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
        **Permanently deletes a branch from an organization**
        
        ⚠️ **WARNING:** This action:
        - Permanently removes the branch
        - Cannot be undone
        - May affect associated data and relationships
        `,
        operationId: 'deleteBranch',
    })
    @ApiParam({
        name: 'organizationId',
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiParam({
        name: 'branchId',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '✅ Branch deleted successfully',
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
