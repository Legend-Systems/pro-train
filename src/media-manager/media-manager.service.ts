import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
    InternalServerErrorException,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import {
    MediaFile,
    MediaType,
    ImageVariant,
} from './entities/media-manager.entity';
import {
    UploadFileDto,
    BulkUploadDto,
    FileFilterDto,
} from './dto/upload-file.dto';
import {
    MediaFileResponseDto,
    MediaFileListResponseDto,
    UploadResponseDto,
    BulkUploadResponseDto,
    MediaStatsDto,
} from './dto/media-response.dto';
import { UserService } from '../user/user.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

interface UploadedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

interface ImageVariantConfig {
    [ImageVariant.THUMBNAIL]: { width: 150; height: 150 };
    [ImageVariant.MEDIUM]: { width: 500; height: 500 };
    [ImageVariant.LARGE]: { width: 1200; height: 1200 };
}

@Injectable()
export class MediaManagerService {
    private readonly logger = new Logger(MediaManagerService.name);
    private readonly storage: Storage;
    private readonly bucketName: string;
    private readonly baseUrl: string;

    // Cache keys
    private readonly CACHE_KEYS = {
        FILE_BY_ID: (id: number) => `media:file:${id}`,
        FILES_LIST: (filters: string, scope: string) =>
            `media:list:${scope}:${filters}`,
        STATS: (scope: string) => `media:stats:${scope}`,
        FILE_VARIANTS: (fileId: number) => `media:variants:${fileId}`,
        ORG_FILES: (orgId: string) => `media:org:${orgId}`,
        BRANCH_FILES: (branchId: string) => `media:branch:${branchId}`,
        USER_FILES: (userId: string) => `media:user:${userId}`,
    };

    // Cache TTL in seconds
    private readonly CACHE_TTL = {
        FILE: 300, // 5 minutes
        FILE_LIST: 180, // 3 minutes
        STATS: 600, // 10 minutes
        VARIANTS: 600, // 10 minutes
    };

    // Image processing configurations
    private readonly imageVariants: ImageVariantConfig = {
        [ImageVariant.THUMBNAIL]: { width: 150, height: 150 },
        [ImageVariant.MEDIUM]: { width: 500, height: 500 },
        [ImageVariant.LARGE]: { width: 1200, height: 1200 },
    };

    // Supported file types
    private readonly supportedMimeTypes = {
        image: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/svg+xml',
        ],
        document: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
        ],
        video: [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo',
            'video/webm',
        ],
        audio: [
            'audio/mpeg',
            'audio/wav',
            'audio/mp3',
            'audio/ogg',
            'audio/x-m4a',
        ],
    };

    constructor(
        @InjectRepository(MediaFile)
        private readonly mediaRepository: Repository<MediaFile>,
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {
        // Initialize Google Cloud Storage
        const projectId = this.configService.get<string>(
            'GOOGLE_CLOUD_PROJECT_ID',
        );
        const privateKey = this.configService
            .get<string>('GOOGLE_CLOUD_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n');
        const clientEmail = this.configService.get<string>(
            'GOOGLE_CLOUD_CLIENT_EMAIL',
        );
        this.bucketName =
            this.configService.get<string>('GOOGLE_CLOUD_PROJECT_BUCKET') ||
            'crmapplications';

        if (!projectId || !privateKey || !clientEmail || !this.bucketName) {
            throw new Error('Google Cloud Storage configuration is incomplete');
        }

        this.storage = new Storage({
            projectId,
            credentials: {
                private_key: privateKey,
                client_email: clientEmail,
            },
        });

        this.baseUrl = `https://storage.googleapis.com/${this.bucketName}`;

        // Test and log connection success
        this.testGCSConnection();
    }

    /**
     * Cache helper methods
     */
    private async invalidateFileCache(
        fileId: number,
        uploaderId?: string,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keysToDelete = [this.CACHE_KEYS.FILE_BY_ID(fileId)];

        if (uploaderId) {
            keysToDelete.push(this.CACHE_KEYS.USER_FILES(uploaderId));
        }
        if (orgId) {
            keysToDelete.push(this.CACHE_KEYS.ORG_FILES(orgId));
        }
        if (branchId) {
            keysToDelete.push(this.CACHE_KEYS.BRANCH_FILES(branchId));
        }

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

    private async invalidateListCaches(scope?: OrgBranchScope): Promise<void> {
        const keysToDelete: string[] = [];

        if (scope?.orgId) {
            keysToDelete.push(this.CACHE_KEYS.ORG_FILES(scope.orgId));
            keysToDelete.push(this.CACHE_KEYS.STATS(scope.orgId));
        }
        if (scope?.branchId) {
            keysToDelete.push(this.CACHE_KEYS.BRANCH_FILES(scope.branchId));
            keysToDelete.push(this.CACHE_KEYS.STATS(scope.branchId));
        }
        if (scope?.userId) {
            keysToDelete.push(this.CACHE_KEYS.USER_FILES(scope.userId));
        }

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

    private generateCacheKey(
        filters: FileFilterDto,
        scope?: OrgBranchScope,
    ): string {
        const filterKey = JSON.stringify({
            type: filters.type,
            variant: filters.variant,
            uploadedBy: filters.uploadedBy,
            filename: filters.filename,
            originalName: filters.originalName,
            page: filters.page,
            limit: filters.limit,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
        });

        const scopeKey = JSON.stringify({
            orgId: scope?.orgId,
            branchId: scope?.branchId,
            userId: scope?.userId,
        });

        return this.CACHE_KEYS.FILES_LIST(filterKey, scopeKey);
    }

    private generateStatsKey(scope?: OrgBranchScope): string {
        const scopeKey = JSON.stringify({
            orgId: scope?.orgId,
            branchId: scope?.branchId,
        });
        return this.CACHE_KEYS.STATS(scopeKey);
    }

    private async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries = 3,
        delay = 1000,
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                const isConnectionError =
                    error instanceof Error &&
                    (error.message.includes('ECONNRESET') ||
                        error.message.includes('Connection lost') ||
                        error.message.includes('connect ETIMEDOUT'));

                if (isConnectionError && attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
        throw new Error('Max retries exceeded');
    }

    /**
     * Upload a single file
     */
    async uploadFile(
        file: UploadedFile,
        uploadDto: UploadFileDto,
        scope: OrgBranchScope,
    ): Promise<UploadResponseDto> {
        return this.retryOperation(async () => {
            try {
                this.logger.log(
                    `Uploading file: ${file.originalname} for user: ${scope.userId}`,
                );

                // Validate file
                this.validateFile(file);

                // Determine media type
                const mediaType =
                    uploadDto.type || this.detectMediaType(file.mimetype);

                // Generate unique filename
                const filename = this.generateFilename(
                    file.originalname,
                    scope,
                );

                // Upload original file to GCS
                const originalFile = await this.uploadToGCS(file, filename);

                // Extract variants from uploadDto to avoid type conflicts
                const { variants, ...uploadDataForDb } = uploadDto;

                // Save to database
                const savedFile = await this.saveToDatabase({
                    ...originalFile,
                    ...uploadDataForDb,
                    type: mediaType,
                    variant: ImageVariant.ORIGINAL,
                    uploadedBy: scope.userId,
                    orgId: scope.orgId
                        ? ({ id: scope.orgId } as any)
                        : undefined,
                    branchId: scope.branchId
                        ? ({ id: scope.branchId } as any)
                        : undefined,
                });

                const response: UploadResponseDto = {
                    file: savedFile,
                };

                // Generate image variants if requested and it's an image
                if (
                    mediaType === MediaType.IMAGE &&
                    uploadDto.generateThumbnails !== false
                ) {
                    const imageVariants = await this.generateImageVariants(
                        file,
                        savedFile,
                        variants || [ImageVariant.THUMBNAIL],
                        scope,
                    );
                    response.variants = imageVariants;
                }

                // Invalidate caches after successful upload
                await this.invalidateListCaches(scope);

                this.logger.log(`File uploaded successfully: ${savedFile.id}`);
                return response;
            } catch (error) {
                this.logger.error(
                    `Error uploading file ${file.originalname}:`,
                    error instanceof Error ? error.message : 'Unknown error',
                );
                throw error;
            }
        });
    }

    /**
     * Upload multiple files
     */
    async uploadMultipleFiles(
        files: UploadedFile[],
        uploadDto: BulkUploadDto,
        scope: OrgBranchScope,
    ): Promise<BulkUploadResponseDto> {
        const uploaded: UploadResponseDto[] = [];
        const errors: Array<{ filename: string; error: string }> = [];

        for (const file of files) {
            try {
                const fileUploadDto: UploadFileDto = {
                    altText: uploadDto.commonAltText,
                    description: uploadDto.commonDescription,
                    generateThumbnails: uploadDto.generateThumbnails,
                };

                const result = await this.uploadFile(
                    file,
                    fileUploadDto,
                    scope,
                );
                uploaded.push(result);
            } catch (error) {
                this.logger.error(
                    `Error uploading ${file.originalname}:`,
                    error,
                );
                errors.push({
                    filename: file.originalname,
                    error: error.message || 'Upload failed',
                });
            }
        }

        return {
            uploaded,
            errors,
            total: files.length,
            successful: uploaded.length,
            failed: errors.length,
        };
    }

    /**
     * Get files with filtering and pagination
     */
    async getFiles(
        filters: FileFilterDto,
        scope?: OrgBranchScope,
    ): Promise<MediaFileListResponseDto> {
        return this.retryOperation(async () => {
            try {
                // Check cache first
                const cacheKey = this.generateCacheKey(filters, scope);
                const cachedResult =
                    await this.cacheManager.get<MediaFileListResponseDto>(
                        cacheKey,
                    );

                if (cachedResult) {
                    return cachedResult;
                }

                const {
                    type,
                    variant,
                    uploadedBy,
                    filename,
                    originalName,
                    page = 1,
                    limit = 20,
                    sortBy = 'createdAt',
                    sortOrder = 'DESC',
                } = filters;

                const query = this.mediaRepository.createQueryBuilder('media');
                query.leftJoinAndSelect('media.uploader', 'uploader');
                query.leftJoinAndSelect('media.orgId', 'org');
                query.leftJoinAndSelect('media.branchId', 'branch');

                // Apply org/branch scoping
                if (scope?.orgId) {
                    query.andWhere('media.orgId = :orgId', {
                        orgId: scope.orgId,
                    });
                }
                if (scope?.branchId) {
                    query.andWhere('media.branchId = :branchId', {
                        branchId: scope.branchId,
                    });
                }

                // Apply filters
                query.andWhere('media.isActive = :isActive', {
                    isActive: true,
                });

                if (type) {
                    query.andWhere('media.type = :type', { type });
                }

                if (variant) {
                    query.andWhere('media.variant = :variant', { variant });
                }

                if (uploadedBy) {
                    query.andWhere('media.uploadedBy = :uploadedBy', {
                        uploadedBy,
                    });
                }

                if (filename) {
                    query.andWhere('media.filename LIKE :filename', {
                        filename: `%${filename}%`,
                    });
                }

                if (originalName) {
                    query.andWhere('media.originalName LIKE :originalName', {
                        originalName: `%${originalName}%`,
                    });
                }

                // Add sorting
                const validSortFields = [
                    'createdAt',
                    'originalName',
                    'size',
                    'type',
                ];
                const sortField = validSortFields.includes(sortBy)
                    ? sortBy
                    : 'createdAt';
                query.orderBy(`media.${sortField}`, sortOrder);

                // Add pagination
                const skip = (page - 1) * limit;
                query.skip(skip).take(limit);

                const [files, total] = await query.getManyAndCount();

                // Load variants for images
                const filesWithVariants = await Promise.all(
                    files.map(async file => {
                        if (
                            file.type === MediaType.IMAGE &&
                            file.variant === ImageVariant.ORIGINAL
                        ) {
                            const variants = await this.mediaRepository.find({
                                where: {
                                    originalFileId: file.id,
                                    isActive: true,
                                },
                                order: { variant: 'ASC' },
                            });
                            return { ...file, variants };
                        }
                        return file;
                    }),
                );

                const result = {
                    files: filesWithVariants,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                };

                // Cache the result
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.FILE_LIST * 1000,
                );

                return result;
            } catch (error) {
                this.logger.error('Error getting files:', error);
                throw error;
            }
        });
    }

    /**
     * Get a single file by ID
     */
    async getFileById(
        id: number,
        scope?: OrgBranchScope,
    ): Promise<MediaFileResponseDto> {
        return this.retryOperation(async () => {
            try {
                // Check cache first
                const cacheKey = this.CACHE_KEYS.FILE_BY_ID(id);
                const cachedFile =
                    await this.cacheManager.get<MediaFileResponseDto>(cacheKey);

                if (cachedFile) {
                    return cachedFile;
                }

                const whereCondition: any = { id, isActive: true };

                // Apply org/branch scoping
                if (scope?.orgId) {
                    whereCondition.orgId = { id: scope.orgId };
                }
                if (scope?.branchId) {
                    whereCondition.branchId = { id: scope.branchId };
                }

                const file = await this.mediaRepository.findOne({
                    where: whereCondition,
                    relations: ['uploader', 'orgId', 'branchId'],
                });

                if (!file) {
                    throw new NotFoundException(`File with ID ${id} not found`);
                }

                let result: MediaFileResponseDto;

                // Load variants if it's an original image
                if (
                    file.type === MediaType.IMAGE &&
                    file.variant === ImageVariant.ORIGINAL
                ) {
                    const variants = await this.mediaRepository.find({
                        where: { originalFileId: file.id, isActive: true },
                        order: { variant: 'ASC' },
                    });
                    result = { ...file, variants };
                } else {
                    result = file;
                }

                // Cache the result
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.FILE * 1000,
                );

                return result;
            } catch (error) {
                this.logger.error(`Error getting file ${id}:`, error);
                throw error;
            }
        });
    }

    /**
     * Delete a file
     */
    async deleteFile(id: number, userId: string): Promise<void> {
        return this.retryOperation(async () => {
            try {
                const file = await this.mediaRepository.findOne({
                    where: { id, isActive: true },
                    relations: ['orgId', 'branchId'],
                });

                if (!file) {
                    throw new NotFoundException(`File with ID ${id} not found`);
                }

                if (file.uploadedBy !== userId) {
                    throw new BadRequestException(
                        'You can only delete files you uploaded',
                    );
                }

                // Mark as inactive instead of hard delete
                await this.mediaRepository.update(id, { isActive: false });

                // Also mark variants as inactive
                await this.mediaRepository.update(
                    { originalFileId: id },
                    { isActive: false },
                );

                // Invalidate caches
                await this.invalidateFileCache(
                    id,
                    userId,
                    file.orgId?.id,
                    file.branchId?.id,
                );

                this.logger.log(
                    `File ${id} marked as deleted by user ${userId}`,
                );
            } catch (error) {
                this.logger.error(`Error deleting file ${id}:`, error);
                throw error;
            }
        });
    }

    /**
     * Get media statistics
     */
    async getStats(scope?: OrgBranchScope): Promise<MediaStatsDto> {
        return this.retryOperation(async () => {
            try {
                // Check cache first
                const cacheKey = this.generateStatsKey(scope);
                const cachedStats =
                    await this.cacheManager.get<MediaStatsDto>(cacheKey);

                if (cachedStats) {
                    return cachedStats;
                }

                const query = this.mediaRepository.createQueryBuilder('media');
                query.where('media.isActive = :isActive', { isActive: true });

                // Apply org/branch scoping
                if (scope?.orgId) {
                    query.andWhere('media.orgId = :orgId', {
                        orgId: scope.orgId,
                    });
                }
                if (scope?.branchId) {
                    query.andWhere('media.branchId = :branchId', {
                        branchId: scope.branchId,
                    });
                }

                const [files, totalFiles] = await query.getManyAndCount();

                const totalSize = files.reduce(
                    (sum, file) => sum + file.size,
                    0,
                );
                const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;

                const byType = files.reduce(
                    (acc, file) => {
                        acc[file.type] = (acc[file.type] || 0) + 1;
                        return acc;
                    },
                    {} as Record<MediaType, number>,
                );

                const lastUpload =
                    files.length > 0
                        ? files.sort(
                              (a, b) =>
                                  b.createdAt.getTime() - a.createdAt.getTime(),
                          )[0].createdAt
                        : undefined;

                const result = {
                    totalFiles,
                    totalSize,
                    byType,
                    averageSize,
                    lastUpload,
                };

                // Cache the result
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.STATS * 1000,
                );

                return result;
            } catch (error) {
                this.logger.error('Error getting media stats:', error);
                throw error;
            }
        });
    }

    // Private helper methods

    private async testGCSConnection(): Promise<void> {
        try {
            // Test connection by checking if bucket exists and is accessible
            const bucket = this.storage.bucket(this.bucketName);
            const [exists] = await bucket.exists();

            if (exists) {
                this.logger.log(`✅ GCS`);
            } else {
                this.logger.error(
                    `❌ GCS - ${this.bucketName} does not exist or is not accessible`,
                );
            }
        } catch (error) {
            this.logger.error(
                `❌ Google Cloud Storage connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    private validateFile(file: UploadedFile): void {
        const maxSize = 50 * 1024 * 1024; // 50MB

        if (!file || !file.buffer) {
            throw new BadRequestException('No file provided');
        }

        if (file.size > maxSize) {
            throw new BadRequestException('File size exceeds 50MB limit');
        }

        const isSupported = Object.values(this.supportedMimeTypes)
            .flat()
            .includes(file.mimetype);

        if (!isSupported) {
            throw new BadRequestException(
                `Unsupported file type: ${file.mimetype}`,
            );
        }
    }

    private detectMediaType(mimeType: string): MediaType {
        for (const [type, mimeTypes] of Object.entries(
            this.supportedMimeTypes,
        )) {
            if (mimeTypes.includes(mimeType)) {
                return type as MediaType;
            }
        }
        return MediaType.OTHER;
    }

    private generateFilename(
        originalName: string,
        scope: OrgBranchScope,
    ): string {
        const ext = path.extname(originalName);
        const nameWithoutExt = path.basename(originalName, ext);
        const uuid = uuidv4();
        const timestamp = new Date().toISOString().slice(0, 10);

        const orgPath = scope.orgId || 'global';
        const branchPath = scope.branchId || 'main';

        return `media/${orgPath}/${branchPath}/${timestamp}/${uuid}-${nameWithoutExt}${ext}`;
    }

    private async uploadToGCS(
        file: UploadedFile,
        filename: string,
    ): Promise<Partial<MediaFile>> {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const gcsFile = bucket.file(filename);

            // Upload file
            await gcsFile.save(file.buffer, {
                metadata: {
                    contentType: file.mimetype,
                },
                public: true,
            });

            // Make file publicly accessible
            await gcsFile.makePublic();

            const url = `${this.baseUrl}/${filename}`;

            // Get image dimensions if it's an image
            let width, height;
            if (this.detectMediaType(file.mimetype) === MediaType.IMAGE) {
                try {
                    const metadata = await sharp(file.buffer).metadata();
                    width = metadata.width;
                    height = metadata.height;
                } catch (error) {
                    this.logger.warn(
                        'Could not extract image dimensions:',
                        error,
                    );
                }
            }

            return {
                originalName: file.originalname,
                filename,
                url,
                mimeType: file.mimetype,
                size: file.size,
                width,
                height,
            };
        } catch (error) {
            this.logger.error('Error uploading to GCS:', error);
            throw new InternalServerErrorException(
                'Failed to upload file to storage',
            );
        }
    }

    private async saveToDatabase(
        data: Partial<MediaFile>,
    ): Promise<MediaFileResponseDto> {
        try {
            const mediaFile = this.mediaRepository.create(data);
            const saved = await this.mediaRepository.save(mediaFile);

            // Load the full entity with relations
            const result = await this.mediaRepository.findOne({
                where: { id: saved.id },
                relations: ['uploader', 'orgId', 'branchId'],
            });

            if (!result) {
                throw new InternalServerErrorException(
                    'Failed to retrieve saved file',
                );
            }

            return result;
        } catch (error) {
            this.logger.error('Error saving to database:', error);
            throw new InternalServerErrorException(
                'Failed to save file metadata',
            );
        }
    }

    private async generateImageVariants(
        originalFile: UploadedFile,
        savedOriginal: MediaFileResponseDto,
        variants: ImageVariant[],
        scope: OrgBranchScope,
    ): Promise<MediaFileResponseDto[]> {
        const generatedVariants: MediaFileResponseDto[] = [];

        for (const variant of variants) {
            if (variant === ImageVariant.ORIGINAL) continue;

            try {
                const config = this.imageVariants[variant];
                if (!config) continue;

                // Process image with Sharp
                const processedBuffer = await sharp(originalFile.buffer)
                    .resize(config.width, config.height, {
                        fit: 'inside',
                        withoutEnlargement: true,
                    })
                    .jpeg({ quality: 85 })
                    .toBuffer();

                // Generate variant filename
                const variantFilename = this.generateVariantFilename(
                    savedOriginal.filename,
                    variant,
                );

                // Upload variant to GCS
                const variantFile = await this.uploadToGCS(
                    {
                        buffer: processedBuffer,
                        originalname: `${variant}-${originalFile.originalname}`,
                        mimetype: 'image/jpeg',
                        size: processedBuffer.length,
                    },
                    variantFilename,
                );

                // Save variant to database
                const savedVariant = await this.saveToDatabase({
                    ...variantFile,
                    type: MediaType.IMAGE,
                    variant,
                    originalFileId: savedOriginal.id,
                    uploadedBy: scope.userId,
                    orgId: scope.orgId
                        ? ({ id: scope.orgId } as any)
                        : undefined,
                    branchId: scope.branchId
                        ? ({ id: scope.branchId } as any)
                        : undefined,
                });

                generatedVariants.push(savedVariant);
            } catch (error) {
                this.logger.error(
                    `Error generating ${variant} variant:`,
                    error,
                );
                // Continue with other variants even if one fails
            }
        }

        return generatedVariants;
    }

    private generateVariantFilename(
        originalFilename: string,
        variant: ImageVariant,
    ): string {
        const ext = path.extname(originalFilename);
        const nameWithoutExt = originalFilename.replace(ext, '');
        return `${nameWithoutExt}-${variant}${ext}`;
    }
}
