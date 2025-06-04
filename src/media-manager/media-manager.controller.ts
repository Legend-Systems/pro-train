import {
    Controller,
    Post,
    Get,
    Delete,
    Put,
    Param,
    Query,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    Body,
    Request,
    HttpStatus,
    Logger,
    ParseIntPipe,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiBody,
    ApiHeader,
    ApiSecurity,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { MediaManagerService } from './media-manager.service';
import {
    UploadFileDto,
    BulkUploadDto,
    FileFilterDto,
} from './dto/upload-file.dto';
import { EditMediaDto, EditMediaResponseDto } from './dto/edit-media.dto';
import {
    MediaFileResponseDto,
    MediaFileListResponseDto,
    UploadResponseDto,
    BulkUploadResponseDto,
    MediaStatsDto,
} from './dto/media-response.dto';
import { StandardApiResponse } from '../user/dto/common-response.dto';

@ApiTags('📁 Media Management')
@Controller('media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class MediaManagerController {
    private readonly logger = new Logger(MediaManagerController.name);

    constructor(private readonly mediaService: MediaManagerService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({
        summary: '📤 Upload Single File',
        description: `
      **Upload a single file to Google Cloud Storage with automatic processing**
      
      This endpoint handles secure file uploads with comprehensive features:
      - Direct upload to Google Cloud Storage
      - Automatic image thumbnail generation
      - File type validation and processing
      - Metadata extraction and storage
      
      **Supported File Types:**
      - **Images**: JPEG, PNG, WebP, GIF, SVG (auto-generates thumbnails)
      - **Documents**: PDF, Word, Excel, PowerPoint, Text
      - **Videos**: MP4, MPEG, QuickTime, AVI, WebM
      - **Audio**: MP3, WAV, OGG, M4A
      
      **Image Processing:**
      - Original image preserved at full resolution
      - Automatic thumbnail generation (150x150px)
      - Optional medium (500x500px) and large (1200x1200px) variants
      - Optimized JPEG compression for variants
      
      **Security Features:**
      - 50MB file size limit
      - File type validation
      - Virus scanning (if configured)
      - Organization/branch scoping
      
      **Use Cases:**
      - Course material uploads
      - Profile pictures and avatars
      - Document attachments
      - Media content for presentations
    `,
        operationId: 'uploadSingleFile',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        type: UploadFileDto,
        description:
            'File upload with comprehensive metadata and processing options',
        examples: {
            'image-with-thumbnails': {
                summary: '🖼️ Image Upload with Thumbnails',
                description:
                    'Upload an image file with automatic thumbnail generation',
                value: {
                    file: '[binary image data]',
                    altText:
                        'Computer Science course introduction showing programming fundamentals',
                    description:
                        'Comprehensive introduction image for CS101 course covering basic programming concepts',
                    generateThumbnails: true,
                    variants: ['thumbnail', 'medium'],
                },
            },
            'document-upload': {
                summary: '📄 Document Upload',
                description: 'Upload a PDF document for course materials',
                value: {
                    file: '[binary PDF data]',
                    description:
                        'Course syllabus and curriculum overview for Computer Science fundamentals',
                    type: 'document',
                    generateThumbnails: false,
                },
            },
            'video-content': {
                summary: '🎥 Video Upload',
                description: 'Upload video content for online learning',
                value: {
                    file: '[binary video data]',
                    altText:
                        'Course lecture video on advanced programming concepts',
                    description:
                        'Detailed lecture covering object-oriented programming principles and best practices',
                    type: 'video',
                    generateThumbnails: false,
                },
            },
            'profile-picture': {
                summary: '👤 Profile Picture Upload',
                description: 'Upload user profile picture with variants',
                value: {
                    file: '[binary image data]',
                    altText: 'User profile picture',
                    description: 'Professional headshot for user profile',
                    generateThumbnails: true,
                    variants: ['thumbnail', 'medium', 'large'],
                },
            },
        },
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description:
                        'File to upload (max 50MB). Supports images, documents, videos, and audio files.',
                },
                altText: {
                    type: 'string',
                    description:
                        'Alternative text for images to improve accessibility and SEO compliance',
                    example:
                        'Computer Science course introduction showing programming fundamentals',
                    maxLength: 255,
                    minLength: 3,
                },
                description: {
                    type: 'string',
                    description:
                        'Detailed description for content management and search optimization',
                    example:
                        'Comprehensive introduction image for CS101 course covering basic programming concepts',
                    maxLength: 1000,
                    minLength: 5,
                },
                type: {
                    type: 'string',
                    enum: ['image', 'document', 'video', 'audio', 'other'],
                    description:
                        'Media type classification (auto-detected if not specified)',
                    example: 'image',
                },
                generateThumbnails: {
                    type: 'boolean',
                    description:
                        'Enable automatic thumbnail generation for images',
                    default: true,
                    example: true,
                },
                variants: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['thumbnail', 'medium', 'large'],
                    },
                    description:
                        'Specific image variants to generate for different display contexts',
                    example: ['thumbnail', 'medium'],
                },
            },
            required: ['file'],
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ File uploaded successfully with variants generated',
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'object',
                    description: 'Main uploaded file information',
                    properties: {
                        id: { type: 'number', example: 1 },
                        originalName: {
                            type: 'string',
                            example: 'course-introduction.jpg',
                        },
                        filename: {
                            type: 'string',
                            example:
                                'media/org-123/2025/01/15/a1b2c3d4-course-introduction.jpg',
                        },
                        url: {
                            type: 'string',
                            example:
                                'https://storage.googleapis.com/crmapplications/media/org-123/2025/01/15/a1b2c3d4-course-introduction.jpg',
                        },
                        mimeType: { type: 'string', example: 'image/jpeg' },
                        size: { type: 'number', example: 2048576 },
                        type: { type: 'string', example: 'image' },
                        variant: { type: 'string', example: 'original' },
                        width: { type: 'number', example: 1920 },
                        height: { type: 'number', example: 1080 },
                        altText: {
                            type: 'string',
                            example: 'Computer Science course introduction',
                        },
                        description: {
                            type: 'string',
                            example: 'Introduction image for CS fundamentals',
                        },
                        uploadedBy: {
                            type: 'string',
                            example: '1',
                        },
                        createdAt: {
                            type: 'string',
                            example: '2025-01-15T10:30:45.123Z',
                        },
                    },
                },
                variants: {
                    type: 'array',
                    description: 'Generated image variants',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'number', example: 2 },
                            variant: { type: 'string', example: 'thumbnail' },
                            width: { type: 'number', example: 150 },
                            height: { type: 'number', example: 150 },
                            size: { type: 'number', example: 15000 },
                            url: {
                                type: 'string',
                                example:
                                    'https://storage.googleapis.com/crmapplications/media/org-123/2025/01/15/a1b2c3d4-course-introduction-thumbnail.jpg',
                            },
                        },
                    },
                    example: [
                        {
                            id: 2,
                            variant: 'thumbnail',
                            width: 150,
                            height: 150,
                            size: 15000,
                            url: 'https://storage.googleapis.com/crmapplications/media/org-123/2025/01/15/a1b2c3d4-course-introduction-thumbnail.jpg',
                        },
                        {
                            id: 3,
                            variant: 'medium',
                            width: 500,
                            height: 500,
                            size: 85000,
                            url: 'https://storage.googleapis.com/crmapplications/media/org-123/2025/01/15/a1b2c3d4-course-introduction-medium.jpg',
                        },
                    ],
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid file or request',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'string',
                    example: 'File size exceeds 50MB limit',
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body() uploadDto: UploadFileDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<UploadResponseDto> {
        try {
            if (!file) {
                throw new BadRequestException('No file provided');
            }

            this.logger.log(
                `Uploading file "${file.originalname}" for user: ${scope.userId}`,
            );

            const result = await this.mediaService.uploadFile(
                {
                    buffer: file.buffer,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                },
                uploadDto,
                scope,
            );

            this.logger.log(`File uploaded successfully: ${result.file.id}`);
            return result;
        } catch (error: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            this.logger.error(`Error uploading file: ${error.message}`, error);
            throw error;
        }
    }

    @Post('upload/bulk')
    @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
    @ApiOperation({
        summary: '📤 Upload Multiple Files',
        description: `
      **Upload multiple files simultaneously with batch processing**
      
      This endpoint handles bulk file uploads with comprehensive error handling:
      - Process up to 10 files in a single request
      - Individual file validation and processing
      - Partial success handling (some files succeed, others fail)
      - Detailed error reporting per file
      
      **Batch Processing Features:**
      - Parallel file processing for performance
      - Individual file error handling
      - Progress tracking and reporting
      - Automatic rollback on critical errors
      
      **Common Metadata:**
      - Apply same alt text to all images
      - Apply same description to all files
      - Unified thumbnail generation settings
      - Consistent organization/branch assignment
      
      **Error Handling:**
      - Continues processing even if some files fail
      - Detailed error messages per failed file
      - Success/failure statistics
      - No partial uploads (file is fully processed or not at all)
      
      **Use Cases:**
      - Course material batch uploads
      - Photo gallery uploads
      - Document collection uploads
      - Media library imports
    `,
        operationId: 'uploadMultipleFiles',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Multiple files upload with common metadata',
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                    description: 'Files to upload (max 10 files, 50MB each)',
                    maxItems: 10,
                },
                commonAltText: {
                    type: 'string',
                    description: 'Common alt text for all uploaded images',
                    example: 'Course materials',
                    maxLength: 255,
                },
                commonDescription: {
                    type: 'string',
                    description: 'Common description for all uploaded files',
                    example: 'Course resource materials',
                    maxLength: 1000,
                },
                generateThumbnails: {
                    type: 'boolean',
                    description: 'Generate thumbnails for image uploads',
                    default: true,
                },
            },
            required: ['files'],
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Bulk upload completed (check individual file status)',
        type: BulkUploadResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid request or no files provided',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async uploadMultipleFiles(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() uploadDto: BulkUploadDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<BulkUploadResponseDto> {
        try {
            if (!files || files.length === 0) {
                throw new BadRequestException('No files provided');
            }

            if (files.length > 10) {
                throw new BadRequestException(
                    'Maximum 10 files allowed per request',
                );
            }

            this.logger.log(
                `Uploading ${files.length} files for user: ${scope.userId}`,
            );

            const uploadedFiles = files.map(file => ({
                buffer: file.buffer,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            }));

            const result = await this.mediaService.uploadMultipleFiles(
                uploadedFiles,
                uploadDto,
                scope,
            );

            this.logger.log(
                `Bulk upload completed: ${result.successful}/${result.total} files successful`,
            );
            return result;
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            this.logger.error(`Error in bulk upload: ${error.message}`, error);
            throw error;
        }
    }

    @Get()
    @ApiOperation({
        summary: '📋 List Media Files',
        description: `
      **Retrieve a paginated list of media files with comprehensive filtering**
      
      This endpoint provides powerful media file discovery with:
      - Advanced filtering by type, variant, uploader, filename
      - Pagination support for large media libraries
      - Sorting capabilities by various fields
      - Organization/branch scoping for access control
      
      **Filtering Options:**
      - **Media Type**: Filter by image, document, video, audio, other
      - **Image Variant**: Filter by original, thumbnail, medium, large
      - **Uploader**: Filter by specific user who uploaded files
      - **Filename Search**: Partial match in stored filename
      - **Original Name Search**: Partial match in original filename
      
      **Response Features:**
      - Full file metadata including URLs
      - Image variants automatically loaded
      - Uploader information included
      - Pagination metadata
      
      **Access Control:**
      - Organization/branch scoping applied
      - Only active files returned
      - User permissions respected
      
      **Use Cases:**
      - Media library browsing
      - File search and discovery
      - Administrative file management
      - Content moderation
    `,
        operationId: 'listMediaFiles',
    })
    @ApiQuery({
        name: 'type',
        required: false,
        description: 'Filter by media type',
        enum: ['image', 'document', 'video', 'audio', 'other'],
        example: 'image',
    })
    @ApiQuery({
        name: 'variant',
        required: false,
        description: 'Filter by image variant',
        enum: ['original', 'thumbnail', 'medium', 'large'],
        example: 'original',
    })
    @ApiQuery({
        name: 'uploadedBy',
        required: false,
        description: 'Filter by uploader user ID',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiQuery({
        name: 'filename',
        required: false,
        description: 'Search in stored filename',
        example: 'course-image',
    })
    @ApiQuery({
        name: 'originalName',
        required: false,
        description: 'Search in original filename',
        example: 'presentation',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        description: 'Page number (starts from 1)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Number of files per page (1-100)',
        example: 20,
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        description: 'Sort field',
        enum: ['createdAt', 'originalName', 'size', 'type'],
        example: 'createdAt',
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        description: 'Sort order',
        enum: ['ASC', 'DESC'],
        example: 'DESC',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Media files retrieved successfully',
        type: MediaFileListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getFiles(
        @Query() filters: FileFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<MediaFileListResponseDto> {
        try {
            this.logger.log(
                `Listing media files with filters: ${JSON.stringify(filters)} for org: ${scope.orgId}, branch: ${scope.branchId}`,
            );

            const result = await this.mediaService.getFiles(filters, scope);

            this.logger.log(
                `Retrieved ${result.files.length} files out of ${result.total} total`,
            );

            return result;
        } catch (error) {
            this.logger.error('Error listing media files:', error);
            throw error;
        }
    }

    @Get('my-files')
    @ApiOperation({
        summary: '👤 Get My Uploaded Files',
        description: `
      **Retrieve files uploaded by the authenticated user**
      
      This endpoint returns all files that the current user has uploaded with:
      - Personal file management
      - Upload history tracking
      - File ownership validation
      - Same filtering capabilities as general file list
      
      **Features:**
      - Only shows files uploaded by current user
      - Includes all file variants and metadata
      - Supports same filtering and pagination
      - Optimized for personal media management
      
      **Use Cases:**
      - Personal media dashboard
      - File management interface
      - Upload history review
      - Personal file cleanup
    `,
        operationId: 'getMyUploadedFiles',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User files retrieved successfully',
        type: MediaFileListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getMyFiles(
        @Query() filters: FileFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<MediaFileListResponseDto> {
        try {
            this.logger.log(`Getting files uploaded by user: ${scope.userId}`);

            const result = await this.mediaService.getFiles(
                { ...filters, uploadedBy: scope.userId },
                scope,
            );

            this.logger.log(
                `Retrieved ${result.files.length} files uploaded by user: ${scope.userId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error getting files for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('stats')
    @ApiOperation({
        summary: '📊 Get Media Statistics',
        description: `
      **Retrieve comprehensive media usage statistics**
      
      This endpoint provides detailed analytics about media usage including:
      - Total files and storage utilization
      - File type distribution
      - Average file sizes
      - Recent activity timestamps
      
      **Statistics Provided:**
      - Total number of files by type
      - Total storage used in bytes
      - Average file size calculations
      - File type distribution breakdown
      - Most recent upload activity
      
      **Scoping:**
      - Statistics respect organization/branch boundaries
      - Only includes active files
      - Real-time calculations
      
      **Use Cases:**
      - Storage quota monitoring
      - Usage analytics dashboard
      - Administrative reporting
      - Capacity planning
    `,
        operationId: 'getMediaStatistics',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Media statistics retrieved successfully',
        type: MediaStatsDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getStats(
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<MediaStatsDto> {
        try {
            this.logger.log(
                `Getting media statistics for org: ${scope.orgId}, branch: ${scope.branchId}`,
            );

            const stats = await this.mediaService.getStats(scope);

            this.logger.log('Media statistics retrieved successfully');

            return stats;
        } catch (error) {
            this.logger.error('Error getting media statistics:', error);
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get File Details',
        description: `
      **Retrieve detailed information about a specific media file**
      
      This endpoint provides comprehensive file data including:
      - Complete file metadata and URLs
      - Image variants and processing information
      - Uploader details and timestamps
      - Access URLs for direct download
      
      **Detailed Information:**
      - File metadata (size, type, dimensions)
      - All available variants for images
      - Uploader profile information
      - Creation and modification timestamps
      - Direct access URLs
      
      **Security:**
      - Organization/branch scoping applied
      - Only active files accessible
      - Access control validation
      
      **Use Cases:**
      - File detail pages
      - Media preview functionality
      - Download link generation
      - File properties display
    `,
        operationId: 'getFileDetails',
    })
    @ApiParam({
        name: 'id',
        description: 'Media file unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ File details retrieved successfully',
        type: MediaFileResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ File not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example: 'File with ID 1 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getFileById(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<MediaFileResponseDto> {
        try {
            this.logger.log(
                `Getting file details for ID: ${id} with org/branch scope`,
            );

            const file = await this.mediaService.getFileById(id, scope);

            this.logger.log(`File details retrieved for ID: ${id}`);

            return file;
        } catch (error) {
            this.logger.error(`Error getting file ${id}:`, error);
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete File',
        description: `
      **Permanently delete a media file with ownership validation**
      
      This endpoint allows file owners to delete their uploaded files with:
      - Ownership verification (only file uploader can delete)
      - Soft deletion (marks as inactive)
      - Variant cleanup (deletes all image variants)
      - Audit trail logging
      
      **Deletion Process:**
      - Validates user ownership
      - Marks file as inactive (soft delete)
      - Removes all image variants
      - Logs deletion for audit purposes
      
      **Safety Features:**
      - Only file uploaders can delete their files
      - Soft deletion allows recovery if needed
      - Cascade deletion of variants
      - Maintains referential integrity
      
      **Important Notes:**
      - Files are marked inactive, not physically deleted
      - All variants are also marked inactive
      - File URLs may remain accessible for a period
      - Consider archiving for important files
      
      **Use Cases:**
      - Personal file cleanup
      - Content moderation
      - Storage management
      - Privacy compliance
    `,
        operationId: 'deleteFile',
    })
    @ApiParam({
        name: 'id',
        description: 'Media file unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ File deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'File deleted successfully',
                },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ File not found',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Access denied - Not file owner',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async deleteFile(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Deleting file ${id} for user: ${req.user.id}`);

            await this.mediaService.deleteFile(id, req.user.id);

            this.logger.log(`File ${id} deleted successfully`);

            return {
                success: true,
                message: 'File deleted successfully',
                data: null,
            };
        } catch (error) {
            this.logger.error(
                `Error deleting file ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id/soft')
    @ApiOperation({
        summary: '🗑️ Soft Delete File',
        description: `
      **Soft delete a media file (mark as deleted without removing from storage)**
      
      This endpoint allows safe deletion of files by marking them as deleted:
      - File ownership validation
      - Status changed to "deleted"
      - All variants also soft deleted
      - Can be restored later if needed
      
      **Soft Deletion Benefits:**
      - Reversible operation (can be restored)
      - Maintains data integrity
      - Audit trail preservation
      - Safer than hard deletion
      
      **Process:**
      - Validates user ownership
      - Updates status to "deleted"
      - Removes from normal queries
      - Logs action for audit
      
      **Use Cases:**
      - Safe file removal
      - Content moderation
      - Temporary hiding of files
      - Accidental deletion protection
    `,
        operationId: 'softDeleteFile',
    })
    @ApiParam({
        name: 'id',
        description: 'Media file unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ File soft deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'File soft deleted successfully',
                },
                status: { type: 'string', example: 'success' },
                code: { type: 'number', example: 200 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ File not found or already deleted',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '❌ Access denied - Not file owner',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async softDeleteFile(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<{ message: string; status: string; code: number }> {
        try {
            this.logger.log(
                `Soft deleting file ${id} for user: ${req.user.id}`,
            );

            const result = await this.mediaService.softDelete(id);

            this.logger.log(`File ${id} soft deleted successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error soft deleting file ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Post(':id/restore')
    @ApiOperation({
        summary: '♻️ Restore Deleted File',
        description: `
      **Restore a previously soft-deleted media file**
      
      This endpoint allows restoration of soft-deleted files:
      - File ownership validation
      - Status changed back to "active"
      - All variants also restored
      - Full functionality restored
      
      **Restoration Features:**
      - Reverses soft deletion
      - Restores all file variants
      - Re-enables file access
      - Maintains file metadata
      
      **Process:**
      - Validates user ownership
      - Updates status to "active"
      - Includes in normal queries again
      - Logs restoration action
      
      **Use Cases:**
      - Accidental deletion recovery
      - Content un-moderation
      - File recovery operations
      - Undo deletion actions
    `,
        operationId: 'restoreFile',
    })
    @ApiParam({
        name: 'id',
        description: 'Media file unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ File restored successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'File restored successfully',
                },
                status: { type: 'string', example: 'success' },
                code: { type: 'number', example: 200 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ File not found or not deleted',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '❌ Access denied - Not file owner',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async restoreFile(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<{ message: string; status: string; code: number }> {
        try {
            this.logger.log(`Restoring file ${id} for user: ${req.user.id}`);

            const result = await this.mediaService.restoreFile(id);

            this.logger.log(`File ${id} restored successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error restoring file ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Put(':id/edit')
    @ApiOperation({
        summary: '✏️ Edit Media File',
        description: `
      **Update metadata and properties of an existing media file**
      
      This endpoint allows file owners to edit metadata without changing the actual file:
      - Update alt text for better accessibility
      - Modify description and categorization
      - Change file designation and purpose
      - Add or update custom metadata
      
      **Editable Properties:**
      - Alternative text for images
      - File description and caption
      - File designation (purpose/category)
      - Custom metadata and tags
      
      **Important Notes:**
      - Only file uploader can edit their files
      - Original file and variants remain unchanged
      - All references and links stay intact
      - Changes are immediately visible
      
      **Use Cases:**
      - Improve accessibility with better alt text
      - Update file categorization
      - Add tags and custom metadata
      - Correct file descriptions
    `,
        operationId: 'editMediaFile',
    })
    @ApiParam({
        name: 'id',
        description: 'Media file unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Media file updated successfully',
        type: EditMediaResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ File not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '❌ Access denied - Not file owner',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async editMedia(
        @Param('id', ParseIntPipe) id: number,
        @Body() editDto: EditMediaDto,
        @Request() req: AuthenticatedRequest,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<EditMediaResponseDto> {
        try {
            this.logger.log(
                `Editing media file ${id} for user: ${req.user.id}`,
            );

            const result = await this.mediaService.editMedia(
                id,
                editDto,
                req.user.id,
                scope,
            );

            this.logger.log(`Media file ${id} edited successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error editing media file ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Put('bulk-edit')
    @ApiOperation({
        summary: '✏️ Bulk Edit Media Files',
        description: `
      **Update metadata for multiple media files simultaneously**
      
      This endpoint allows batch editing of multiple files with the same changes:
      - Apply same metadata updates to multiple files
      - Efficient batch operations
      - Individual file validation
      - Detailed success/failure reporting
      
      **Batch Features:**
      - Process multiple files at once
      - Individual ownership validation
      - Partial success handling
      - Comprehensive error reporting
      
      **Common Use Cases:**
      - Bulk tagging of related files
      - Mass categorization updates
      - Batch designation changes
      - Group metadata assignments
    `,
        operationId: 'bulkEditMediaFiles',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Bulk edit completed (check individual file status)',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Bulk edit completed: 3/5 files updated',
                },
                status: { type: 'string', example: 'success' },
                code: { type: 'number', example: 200 },
                data: {
                    type: 'object',
                    properties: {
                        updated: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/MediaFileResponseDto',
                            },
                        },
                        errors: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    fileId: { type: 'number' },
                                    error: { type: 'string' },
                                },
                            },
                        },
                        total: { type: 'number' },
                        successful: { type: 'number' },
                        failed: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid request or no file IDs provided',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async bulkEditMedia(
        @Body()
        bulkEditDto: {
            fileIds: number[];
            editData: EditMediaDto;
        },
        @Request() req: AuthenticatedRequest,
        @OrgBranchScope() scope: OrgBranchScope,
    ) {
        try {
            if (!bulkEditDto.fileIds || bulkEditDto.fileIds.length === 0) {
                throw new BadRequestException('No file IDs provided');
            }

            this.logger.log(
                `Bulk editing ${bulkEditDto.fileIds.length} files for user: ${req.user.id}`,
            );

            const result = await this.mediaService.bulkEditMedia(
                bulkEditDto.fileIds,
                bulkEditDto.editData,
                req.user.id,
                scope,
            );

            this.logger.log(
                `Bulk edit completed: ${result.data.successful}/${result.data.total} files updated`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error in bulk edit for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get('deleted/list')
    @ApiOperation({
        summary: '👻 List Deleted Files',
        description: `
      **Retrieve all soft-deleted media files for restoration or permanent cleanup**
      
      This endpoint provides access to deleted files for:
      - Administrative oversight
      - File restoration workflows
      - Cleanup operations
      - Audit and compliance
      
      **Features:**
      - Shows only deleted files
      - Organization/branch scoping
      - Comprehensive file metadata
      - Deletion timestamps
      
      **Use Cases:**
      - File recovery interfaces
      - Administrative panels
      - Audit and compliance tools
      - Cleanup utilities
    `,
        operationId: 'getDeletedFiles',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Deleted files retrieved successfully',
        type: [MediaFileResponseDto],
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getDeletedFiles(): Promise<MediaFileResponseDto[]> {
        try {
            this.logger.log('Getting deleted files list');

            const deletedFiles = await this.mediaService.findDeleted();

            this.logger.log(`Retrieved ${deletedFiles.length} deleted files`);

            return deletedFiles;
        } catch (error) {
            this.logger.error('Error getting deleted files:', error);
            throw error;
        }
    }
}
