import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
    InternalServerErrorException,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    MediaFileStatus,
    FileDesignation,
} from './entities/media-manager.entity';
import {
    UploadFileDto,
    BulkUploadDto,
    FileFilterDto,
} from './dto/upload-file.dto';
import { EditMediaDto } from './dto/edit-media.dto';
import {
    MediaFileResponseDto,
    MediaFileListResponseDto,
    UploadResponseDto,
    BulkUploadResponseDto,
    MediaStatsDto,
} from './dto/media-response.dto';
import { UserService } from '../user/user.service';
import { RetryService } from '../common/services/retry.service';
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

    // Cache keys with org/branch isolation - COMPLIANT PATTERN
    private readonly CACHE_KEYS = {
        FILE_BY_ID: (id: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:media:file:${id}`,
        FILES_LIST: (filters: string, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:media:list:${filters}`,
        STATS: (orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:media:stats`,
        FILE_VARIANTS: (fileId: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:media:variants:${fileId}`,
        ORG_FILES: (orgId: number, branchId?: number) =>
            `org:${orgId}:branch:${branchId || 'global'}:media:org:files`,
        BRANCH_FILES: (branchId: number, orgId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId}:media:branch:files`,
        USER_FILES: (userId: string, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:media:user:${userId}:files`,
        ALL_MEDIA: (orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:media:all`,
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
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
        private readonly configService: ConfigService,
        private readonly userService: UserService,
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
        void this.testGCSConnection();
    }

    /**
     * Cache helper methods - COMPLIANT with org/branch parameters
     */
    private async invalidateFileCache(
        fileId: number,
        uploaderId?: string,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.FILE_BY_ID(fileId, orgId, branchId),
            this.CACHE_KEYS.FILE_VARIANTS(fileId, orgId, branchId),
        ];

        if (uploaderId) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_FILES(uploaderId, orgId, branchId),
            );
        }
        if (orgId) {
            keysToDelete.push(this.CACHE_KEYS.ORG_FILES(orgId, branchId));
        }
        if (branchId) {
            keysToDelete.push(this.CACHE_KEYS.BRANCH_FILES(branchId, orgId));
        }

        keysToDelete.push(this.CACHE_KEYS.ALL_MEDIA(orgId, branchId));

        await Promise.all(
            keysToDelete.map(async key => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                }
            }),
        );
    }

    private async invalidateListCaches(
        orgId?: number,
        branchId?: number,
        userId?: string,
    ): Promise<void> {
        const keysToDelete: string[] = [];

        keysToDelete.push(
            this.CACHE_KEYS.STATS(orgId, branchId),
            this.CACHE_KEYS.ALL_MEDIA(orgId, branchId),
        );

        if (orgId) {
            keysToDelete.push(this.CACHE_KEYS.ORG_FILES(orgId, branchId));
        }
        if (branchId) {
            keysToDelete.push(this.CACHE_KEYS.BRANCH_FILES(branchId, orgId));
        }
        if (userId) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_FILES(userId, orgId, branchId),
            );
        }

        await Promise.all(
            keysToDelete.map(async key => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                }
            }),
        );
    }

    private generateCacheKey(
        filters: FileFilterDto,
        orgId?: number,
        branchId?: number,
    ): string {
        const filterKey = JSON.stringify({
            type: filters.type,
            variant: filters.variant,
            uploadedBy: filters.uploadedBy,
            filename: filters.filename,
            originalName: filters.originalName,
            designation: filters.designation,
            page: filters.page,
            limit: filters.limit,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
        });

        return this.CACHE_KEYS.FILES_LIST(filterKey, orgId, branchId);
    }

    private generateStatsKey(orgId?: number, branchId?: number): string {
        return this.CACHE_KEYS.STATS(orgId, branchId);
    }

    /**
     * Upload a single file - COMPLIANT with RetryService
     */
    async uploadFile(
        file: UploadedFile,
        uploadDto: UploadFileDto,
        scope: OrgBranchScope,
    ): Promise<UploadResponseDto> {
        return this.retryService.executeDatabase(async () => {
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

                // Prepare data for database
                const dataForDb: Partial<MediaFile> = {
                    ...originalFile,
                    ...uploadDataForDb,
                    type: mediaType,
                    variant: ImageVariant.ORIGINAL,
                    uploadedBy: scope.userId,
                    designation:
                        uploadDto.designation || FileDesignation.GENERAL_UPLOAD,
                };

                // Add org/branch references if provided
                if (scope.orgId) {
                    Object.assign(dataForDb, { orgId: scope.orgId });
                }
                if (scope.branchId) {
                    Object.assign(dataForDb, { branchId: scope.branchId });
                }

                // Save to database
                const savedFile = await this.saveToDatabase(dataForDb);

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
                await this.invalidateListCaches(
                    scope.orgId ? parseInt(scope.orgId, 10) : undefined,
                    scope.branchId ? parseInt(scope.branchId, 10) : undefined,
                    scope.userId,
                );

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
                    designation: uploadDto.commonDesignation,
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
                const errorMessage =
                    error instanceof Error ? error.message : 'Upload failed';
                errors.push({
                    filename: file.originalname,
                    error: errorMessage,
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
        return this.retryService.executeDatabase(async () => {
            try {
                // Check cache first
                const cacheKey = this.generateCacheKey(
                    filters,
                    scope?.orgId ? parseInt(scope.orgId, 10) : undefined,
                    scope?.branchId ? parseInt(scope.branchId, 10) : undefined,
                );
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
                    designation,
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
                query.andWhere('media.status = :status', {
                    status: MediaFileStatus.ACTIVE,
                });

                // Exclude user avatars from general media queries
                query.andWhere('media.designation != :userAvatar', {
                    userAvatar: FileDesignation.USER_AVATAR,
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

                if (designation) {
                    query.andWhere('media.designation = :designation', {
                        designation,
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
                                    status: MediaFileStatus.ACTIVE,
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
        return this.retryService.executeDatabase(async () => {
            try {
                // Check cache first
                const cacheKey = this.CACHE_KEYS.FILE_BY_ID(
                    id,
                    scope?.orgId ? parseInt(scope.orgId, 10) : undefined,
                    scope?.branchId ? parseInt(scope.branchId, 10) : undefined,
                );
                const cachedFile =
                    await this.cacheManager.get<MediaFileResponseDto>(cacheKey);

                if (cachedFile) {
                    return cachedFile;
                }

                const whereCondition: Record<string, any> = {
                    id,
                    status: MediaFileStatus.ACTIVE,
                };

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
                        where: {
                            originalFileId: file.id,
                            status: MediaFileStatus.ACTIVE,
                        },
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
     * Delete a file with enhanced access control
     */
    async deleteFile(
        id: number,
        userId: string,
        scope?: OrgBranchScope,
    ): Promise<void> {
        return this.retryService.executeDatabase(async () => {
            try {
                const file = await this.mediaRepository.findOne({
                    where: { id, status: MediaFileStatus.ACTIVE },
                    relations: ['orgId', 'branchId'],
                });

                if (!file) {
                    throw new NotFoundException(`File with ID ${id} not found`);
                }

                // Enhanced access control logic
                const canDelete = this.checkFileAccess(file, userId, scope);
                if (!canDelete) {
                    throw new BadRequestException(
                        'Access denied - insufficient permissions to delete this file',
                    );
                }

                // Mark as deleted instead of hard delete
                await this.mediaRepository.update(id, {
                    status: MediaFileStatus.DELETED,
                });

                // Also mark variants as deleted
                await this.mediaRepository.update(
                    { originalFileId: id },
                    { status: MediaFileStatus.DELETED },
                );

                // Invalidate caches
                await this.invalidateFileCache(
                    id,
                    userId,
                    file.orgId?.id ? parseInt(file.orgId.id, 10) : undefined,
                    file.branchId?.id
                        ? parseInt(file.branchId.id, 10)
                        : undefined,
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
        return this.retryService.executeDatabase(async () => {
            try {
                // Check cache first
                const cacheKey = this.generateStatsKey(
                    scope?.orgId ? parseInt(scope.orgId, 10) : undefined,
                    scope?.branchId ? parseInt(scope.branchId, 10) : undefined,
                );
                const cachedStats =
                    await this.cacheManager.get<MediaStatsDto>(cacheKey);

                if (cachedStats) {
                    return cachedStats;
                }

                const query = this.mediaRepository.createQueryBuilder('media');
                query.where('media.status = :status', {
                    status: MediaFileStatus.ACTIVE,
                });

                // Exclude user avatars from stats
                query.andWhere('media.designation != :userAvatar', {
                    userAvatar: FileDesignation.USER_AVATAR,
                });

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
            let width: number | undefined, height: number | undefined;
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

                // Prepare variant data for database
                const variantData: Partial<MediaFile> = {
                    ...variantFile,
                    type: MediaType.IMAGE,
                    variant,
                    originalFileId: savedOriginal.id,
                    uploadedBy: scope.userId,
                };

                // Add org/branch references if provided
                if (scope.orgId) {
                    Object.assign(variantData, { orgId: scope.orgId });
                }
                if (scope.branchId) {
                    Object.assign(variantData, { branchId: scope.branchId });
                }

                // Save variant to database
                const savedVariant = await this.saveToDatabase(variantData);

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

    /**
     * Check if user has access to perform operations on a file
     */
    private checkFileAccess(
        file: MediaFile,
        userId: string,
        scope?: OrgBranchScope,
    ): boolean {
        // BRANDON role has access to everything
        if (scope?.userRole === 'brandon') {
            return true;
        }

        // OWNER has access to all files within their organization
        if (scope?.userRole === 'owner' && scope.orgId === file.orgId?.id) {
            return true;
        }

        // ADMIN has access to all files within their organization
        if (scope?.userRole === 'admin' && scope.orgId === file.orgId?.id) {
            return true;
        }

        // File owner can always access their own files
        if (file.uploadedBy === userId) {
            return true;
        }

        return false;
    }

    /**
     * Soft delete a media file by setting status to DELETED
     */
    async softDelete(
        fileId: number,
    ): Promise<{ message: string; status: string; code: number }> {
        return this.retryService.executeDatabase(async () => {
            // First check if file exists and is not already deleted
            const file = await this.mediaRepository.findOne({
                where: { id: fileId },
                relations: ['uploader', 'orgId', 'branchId'],
            });

            if (!file) {
                throw new NotFoundException(
                    `Media file with ID ${fileId} not found`,
                );
            }

            if (file.status === MediaFileStatus.DELETED) {
                throw new BadRequestException('Media file is already deleted');
            }

            // Update status to DELETED
            await this.mediaRepository.update(fileId, {
                status: MediaFileStatus.DELETED,
            });

            // Invalidate file cache
            await this.invalidateFileCache(
                fileId,
                file.uploadedBy,
                file.orgId?.id ? parseInt(file.orgId.id, 10) : undefined,
                file.branchId?.id ? parseInt(file.branchId.id, 10) : undefined,
            );

            return {
                message: 'Media file deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Restore a soft-deleted media file by setting status to ACTIVE
     */
    async restoreFile(
        fileId: number,
    ): Promise<{ message: string; status: string; code: number }> {
        return this.retryService.executeDatabase(async () => {
            // First check if file exists and is deleted
            const file = await this.mediaRepository.findOne({
                where: { id: fileId },
                relations: ['uploader', 'orgId', 'branchId'],
            });

            if (!file) {
                throw new NotFoundException(
                    `Media file with ID ${fileId} not found`,
                );
            }

            if (file.status !== MediaFileStatus.DELETED) {
                throw new BadRequestException(
                    'Media file is not deleted and cannot be restored',
                );
            }

            // Update status to ACTIVE
            await this.mediaRepository.update(fileId, {
                status: MediaFileStatus.ACTIVE,
            });

            // Invalidate file cache
            await this.invalidateFileCache(
                fileId,
                file.uploadedBy,
                file.orgId?.id ? parseInt(file.orgId.id, 10) : undefined,
                file.branchId?.id ? parseInt(file.branchId.id, 10) : undefined,
            );

            return {
                message: 'Media file restored successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Get files with admin access (no scope restrictions)
     */
    async getFilesAdmin(
        filters: FileFilterDto,
    ): Promise<MediaFileListResponseDto> {
        return this.retryService.executeDatabase(async () => {
            try {
                const {
                    type,
                    variant,
                    uploadedBy,
                    filename,
                    originalName,
                    designation,
                    page = 1,
                    limit = 20,
                    sortBy = 'createdAt',
                    sortOrder = 'DESC',
                } = filters;

                const query = this.mediaRepository.createQueryBuilder('media');
                query.leftJoinAndSelect('media.uploader', 'uploader');
                query.leftJoinAndSelect('media.orgId', 'org');
                query.leftJoinAndSelect('media.branchId', 'branch');

                // No org/branch scoping for admin access - admins can see everything

                // Apply filters
                query.andWhere('media.status = :status', {
                    status: MediaFileStatus.ACTIVE,
                });

                // Exclude user avatars from general media queries
                query.andWhere('media.designation != :userAvatar', {
                    userAvatar: FileDesignation.USER_AVATAR,
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

                if (designation) {
                    query.andWhere('media.designation = :designation', {
                        designation,
                    });
                }

                // Add sorting
                const validSortFields = [
                    'createdAt',
                    'originalName',
                    'size',
                    'type',
                ];
                const orderBy = validSortFields.includes(sortBy)
                    ? sortBy
                    : 'createdAt';
                const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
                query.orderBy(`media.${orderBy}`, order);

                // Add pagination
                const skip = (page - 1) * limit;
                query.skip(skip).take(limit);

                const [files, total] = await query.getManyAndCount();

                // Load variants for original image files
                const filesWithVariants = await Promise.all(
                    files.map(async file => {
                        if (
                            file.type === MediaType.IMAGE &&
                            file.variant === ImageVariant.ORIGINAL
                        ) {
                            const variants = await this.mediaRepository.find({
                                where: {
                                    originalFileId: file.id,
                                    status: MediaFileStatus.ACTIVE,
                                },
                                order: { variant: 'ASC' },
                            });
                            return { ...file, variants };
                        }
                        return file;
                    }),
                );

                return {
                    files: filesWithVariants,
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                };
            } catch (error) {
                this.logger.error('Error getting files for admin:', error);
                throw error;
            }
        });
    }

    /**
     * Get global statistics (admin access)
     */
    async getGlobalStats(): Promise<MediaStatsDto> {
        return this.retryService.executeDatabase(async () => {
            try {
                // No scoping - get stats across all organizations
                const query = this.mediaRepository.createQueryBuilder('media');

                query.where('media.status = :status', {
                    status: MediaFileStatus.ACTIVE,
                });

                // Exclude user avatars from stats
                query.andWhere('media.designation != :userAvatar', {
                    userAvatar: FileDesignation.USER_AVATAR,
                });

                const totalFiles = await query.getCount();

                // Get total size with proper type handling
                const totalSizeResult = (await query
                    .select('SUM(media.size)', 'totalSize')
                    .getRawOne()) as { totalSize: string } | undefined;

                // Get file type distribution with proper typing
                const typeDistribution = (await query
                    .select('media.type', 'type')
                    .addSelect('COUNT(*)', 'count')
                    .groupBy('media.type')
                    .getRawMany()) as Array<{ type: MediaType; count: string }>;

                // Get most recent upload
                const mostRecentUpload = await query
                    .orderBy('media.createdAt', 'DESC')
                    .getOne();

                const totalSizeValue = parseInt(
                    totalSizeResult?.totalSize || '0',
                    10,
                );

                const stats: MediaStatsDto = {
                    totalFiles: totalFiles || 0,
                    totalSize: totalSizeValue,
                    averageSize:
                        totalFiles > 0
                            ? Math.round(totalSizeValue / totalFiles)
                            : 0,
                    byType: typeDistribution.reduce(
                        (acc, { type, count }) => {
                            acc[type] = parseInt(count, 10);
                            return acc;
                        },
                        {} as Record<MediaType, number>,
                    ),
                    lastUpload: mostRecentUpload?.createdAt,
                };

                return stats;
            } catch (error) {
                this.logger.error('Error getting global stats:', error);
                throw error;
            }
        });
    }

    /**
     * Find all soft-deleted media files (for admin purposes)
     */
    async findDeleted(): Promise<MediaFile[]> {
        return this.retryService.executeDatabase(async () => {
            const files = await this.mediaRepository.find({
                where: { status: MediaFileStatus.DELETED },
                relations: ['uploader', 'orgId', 'branchId', 'originalFile'],
            });

            return files;
        });
    }

    /**
     * Find all media files with any status (for admin purposes, includes user avatars)
     */
    async findAllWithDeleted(): Promise<MediaFile[]> {
        return this.retryService.executeDatabase(async () => {
            const files = await this.mediaRepository.find({
                relations: ['uploader', 'orgId', 'branchId', 'originalFile'],
            });

            return files;
        });
    }

    /**
     * Find media file by ID including deleted files (for admin purposes)
     */
    async findByIdWithDeleted(id: number): Promise<MediaFile | null> {
        return this.retryService.executeDatabase(async () => {
            const file = await this.mediaRepository.findOne({
                where: { id },
                relations: ['uploader', 'orgId', 'branchId', 'originalFile'],
            });

            return file;
        });
    }

    /**
     * Edit/update media file metadata without changing the actual file
     * Only allows updating metadata fields like altText, description, designation, and custom metadata
     */
    async editMedia(
        fileId: number,
        editDto: EditMediaDto,
        userId: string,
        scope?: OrgBranchScope,
    ): Promise<{
        message: string;
        status: string;
        code: number;
        data: MediaFileResponseDto;
    }> {
        return this.retryService.executeDatabase(async () => {
            try {
                // First, find the file and validate ownership and scope
                const whereCondition: Record<string, any> = {
                    id: fileId,
                    status: MediaFileStatus.ACTIVE,
                };

                // Apply org/branch scoping if provided
                if (scope?.orgId) {
                    whereCondition.orgId = { id: scope.orgId };
                }
                if (scope?.branchId) {
                    whereCondition.branchId = { id: scope.branchId };
                }

                const existingFile = await this.mediaRepository.findOne({
                    where: whereCondition,
                    relations: ['uploader', 'orgId', 'branchId'],
                });

                if (!existingFile) {
                    throw new NotFoundException(
                        `Media file with ID ${fileId} not found`,
                    );
                }

                // Enhanced access control - check if user can edit this file
                const canEdit = this.checkFileAccess(
                    existingFile,
                    userId,
                    scope,
                );
                if (!canEdit) {
                    throw new BadRequestException(
                        'Access denied - insufficient permissions to edit this file',
                    );
                }

                // Prepare update data - only include fields that are provided
                const updateData: Partial<MediaFile> = {};

                if (editDto.altText !== undefined) {
                    updateData.altText = editDto.altText;
                }

                if (editDto.description !== undefined) {
                    updateData.description = editDto.description;
                }

                if (editDto.designation !== undefined) {
                    updateData.designation = editDto.designation;
                }

                if (editDto.metadata !== undefined) {
                    // Merge with existing metadata to preserve existing custom data
                    updateData.metadata = {
                        ...existingFile.metadata,
                        ...editDto.metadata,
                    };
                }

                // If no fields to update, return early
                if (Object.keys(updateData).length === 0) {
                    return {
                        message: 'No changes to apply',
                        status: 'info',
                        code: 200,
                        data: existingFile,
                    };
                }

                // Update the file metadata
                await this.mediaRepository.update(fileId, updateData);

                // Fetch the updated file with all relations
                const updatedFile = await this.mediaRepository.findOne({
                    where: { id: fileId },
                    relations: ['uploader', 'orgId', 'branchId'],
                });

                if (!updatedFile) {
                    throw new InternalServerErrorException(
                        'Failed to retrieve updated file',
                    );
                }

                // Load variants if it's an original image
                let result: MediaFileResponseDto;
                if (
                    updatedFile.type === MediaType.IMAGE &&
                    updatedFile.variant === ImageVariant.ORIGINAL
                ) {
                    const variants = await this.mediaRepository.find({
                        where: {
                            originalFileId: updatedFile.id,
                            status: MediaFileStatus.ACTIVE,
                        },
                        order: { variant: 'ASC' },
                    });
                    result = { ...updatedFile, variants };
                } else {
                    result = updatedFile;
                }

                // Invalidate relevant caches
                await this.invalidateFileCache(
                    fileId,
                    userId,
                    existingFile.orgId?.id
                        ? parseInt(existingFile.orgId.id, 10)
                        : undefined,
                    existingFile.branchId?.id
                        ? parseInt(existingFile.branchId.id, 10)
                        : undefined,
                );

                this.logger.log(
                    `Media file ${fileId} updated successfully by user ${userId}`,
                );

                return {
                    message: 'Media file updated successfully',
                    status: 'success',
                    code: 200,
                    data: result,
                };
            } catch (error) {
                this.logger.error(
                    `Error editing media file ${fileId}:`,
                    error instanceof Error ? error.message : 'Unknown error',
                );
                throw error;
            }
        });
    }

    /**
     * Bulk edit media files - update multiple files with same metadata changes
     * Useful for batch operations like changing designation or adding tags to multiple files
     */
    async bulkEditMedia(
        fileIds: number[],
        editDto: EditMediaDto,
        userId: string,
        scope?: OrgBranchScope,
    ): Promise<{
        message: string;
        status: string;
        code: number;
        data: {
            updated: MediaFileResponseDto[];
            errors: Array<{ fileId: number; error: string }>;
            total: number;
            successful: number;
            failed: number;
        };
    }> {
        return this.retryService.executeDatabase(async () => {
            const updated: MediaFileResponseDto[] = [];
            const errors: Array<{ fileId: number; error: string }> = [];

            for (const fileId of fileIds) {
                try {
                    const result = await this.editMedia(
                        fileId,
                        editDto,
                        userId,
                        scope,
                    );
                    updated.push(result.data);
                } catch (error) {
                    this.logger.error(
                        `Error editing file ${fileId} in bulk operation:`,
                        error,
                    );
                    const errorMessage =
                        error instanceof Error ? error.message : 'Edit failed';
                    errors.push({
                        fileId,
                        error: errorMessage,
                    });
                }
            }

            return {
                message: `Bulk edit completed: ${updated.length}/${fileIds.length} files updated`,
                status: updated.length > 0 ? 'success' : 'error',
                code: 200,
                data: {
                    updated,
                    errors,
                    total: fileIds.length,
                    successful: updated.length,
                    failed: errors.length,
                },
            };
        });
    }
}
