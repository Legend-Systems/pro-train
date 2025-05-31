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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BranchService } from './branch.service';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('🏪 Branch Management')
@Controller('branches')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BranchController {
    private readonly logger = new Logger(BranchController.name);

    constructor(private readonly branchService: BranchService) {}

    @Get()
    @ApiOperation({
        summary: '📋 List All Branches',
        description: `
        **Retrieves all branches across all organizations**
        
        Returns comprehensive branch data including:
        - Branch details and contact information
        - Associated organization information
        - Ordered by creation date (newest first)
        `,
        operationId: 'getAllBranches',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branches retrieved successfully',
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
        
        Returns detailed branch information including:
        - Branch profile and contact details
        - Operating hours and management information
        - Associated organization details
        `,
        operationId: 'getBranchById',
    })
    @ApiParam({
        name: 'id',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Branch retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch not found',
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
        
        Allows updating:
        - Branch contact information and address
        - Operating hours and management details
        - Branch status and activity settings
        `,
        operationId: 'updateBranch',
    })
    @ApiParam({
        name: 'id',
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
        description: '❌ Branch not found',
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
        **Permanently deletes a branch**
        
        ⚠️ **WARNING:** This action:
        - Permanently removes the branch
        - Cannot be undone
        - May affect associated data and relationships
        `,
        operationId: 'deleteBranch',
    })
    @ApiParam({
        name: 'id',
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '✅ Branch deleted successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Branch not found',
    })
    async remove(@Param('id') id: string) {
        this.logger.log(`Deleting branch: ${id}`);
        await this.branchService.remove(id);
    }
}
