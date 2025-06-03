import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    Inject,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateCourseMaterialDto } from './dto/create-course-material.dto';
import { UpdateCourseMaterialDto } from './dto/update-course-material.dto';
import {
    CourseMaterialResponseDto,
    StandardOperationResponse,
    CourseMaterialListApiResponse,
} from './dto/course-material-response.dto';
import {
    CourseMaterial,
    MaterialStatus,
} from './entities/course-material.entity';
import { Course } from '../course/entities/course.entity';
import { User } from '../user/entities/user.entity';
import {
    MediaFile,
    ImageVariant,
} from '../media-manager/entities/media-manager.entity';

export interface OrgBranchScope {
    orgId?: string;
    branchId?: string;
}

@Injectable()
export class CourseMaterialsService {
    private readonly logger = new Logger(CourseMaterialsService.name);

    private readonly CACHE_KEYS = {
        MATERIAL_BY_ID: (id: number) => `course-material:${id}`,
        MATERIALS_BY_COURSE: (courseId: number) =>
            `course-materials:course:${courseId}`,
        MATERIALS_COUNT: (courseId: number) =>
            `course-materials:count:${courseId}`,
        MATERIALS_BY_ORG: (orgId: string) => `course-materials:org:${orgId}`,
        MATERIALS_BY_BRANCH: (branchId: string) =>
            `course-materials:branch:${branchId}`,
        MEDIA_FILE_VARIANTS: (mediaFileId: number) =>
            `course-material:media:${mediaFileId}`,
    };

    private readonly CACHE_TTL = {
        MATERIAL: 60 * 60 * 24, // 24 hours
        MATERIALS_LIST: 60 * 60 * 12, // 12 hours
        COUNT: 60 * 60 * 6, // 6 hours
        MEDIA_VARIANTS: 60 * 60 * 10, // 10 hours
    };

    constructor(
        @InjectRepository(CourseMaterial)
        private readonly courseMaterialRepository: Repository<CourseMaterial>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(MediaFile)
        private readonly mediaRepository: Repository<MediaFile>,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly eventEmitter: EventEmitter2,
    ) {}

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
     * Load media file variants for a course material
     */
    private async loadMediaFileVariants(
        material: CourseMaterial,
    ): Promise<CourseMaterial> {
        if (material.mediaFile?.id) {
            try {
                // Check cache first for media file variants
                const cacheKey = this.CACHE_KEYS.MEDIA_FILE_VARIANTS(
                    material.mediaFile.id,
                );
                const cachedVariants =
                    await this.cacheManager.get<any[]>(cacheKey);

                if (cachedVariants) {
                    material.mediaFile.variants = cachedVariants;
                } else {
                    // Fetch from database if not cached
                    const variants = await this.mediaRepository.find({
                        where: {
                            originalFileId: material.mediaFile.id,
                            isActive: true,
                        },
                        order: { variant: 'ASC' },
                    });

                    if (variants.length > 0) {
                        material.mediaFile.variants = variants;
                        // Cache the variants
                        await this.cacheManager.set(
                            cacheKey,
                            variants,
                            this.CACHE_TTL.MEDIA_VARIANTS * 1000,
                        );
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to load media file variants:', error);
            }
        }
        return material;
    }

    /**
     * Cache helper methods
     */
    private async invalidateMaterialCache(
        materialId: number,
        courseId?: number,
    ): Promise<void> {
        const keysToDelete = [this.CACHE_KEYS.MATERIAL_BY_ID(materialId)];

        if (courseId) {
            keysToDelete.push(
                this.CACHE_KEYS.MATERIALS_BY_COURSE(courseId),
                this.CACHE_KEYS.MATERIALS_COUNT(courseId),
            );
        }

        await Promise.all(
            keysToDelete.map(key =>
                this.cacheManager
                    .del(key)
                    .catch(error =>
                        this.logger.warn(
                            `Cache deletion failed for key ${key}:`,
                            error,
                        ),
                    ),
            ),
        );
    }

    private async invalidateCourseListCaches(courseId: number): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.MATERIALS_BY_COURSE(courseId),
            this.CACHE_KEYS.MATERIALS_COUNT(courseId),
        ];

        await Promise.all(
            keysToDelete.map(key =>
                this.cacheManager
                    .del(key)
                    .catch(error =>
                        this.logger.warn(
                            `Cache deletion failed for key ${key}:`,
                            error,
                        ),
                    ),
            ),
        );
    }

    /**
     * Validate course access with scope
     */
    private async validateCourseAccessWithScope(
        courseId: number,
        scope: OrgBranchScope,
        // userId is kept for potential future access control logic
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        userId?: string,
    ): Promise<Course> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
            relations: ['orgId', 'branchId'],
        });

        if (!course) {
            throw new NotFoundException(`Course with ID ${courseId} not found`);
        }

        // Validate organization access if orgId provided
        if (scope.orgId && course.orgId?.id !== scope.orgId) {
            throw new ForbiddenException(
                'Access denied: Course belongs to different organization',
            );
        }

        // Validate branch access if branchId provided
        if (scope.branchId && course.branchId?.id !== scope.branchId) {
            throw new ForbiddenException(
                'Access denied: Course belongs to different branch',
            );
        }

        return course;
    }

    /**
     * Map entity to response DTO
     */
    private mapToResponseDto(
        material: CourseMaterial,
    ): CourseMaterialResponseDto {
        return {
            materialId: material.materialId,
            title: material.title,
            description: material.description,
            mediaFile: material.mediaFile
                ? {
                      id: material.mediaFile.id,
                      originalName: material.mediaFile.originalName,
                      url: material.mediaFile.url,
                      thumbnail: material.mediaFile.variants?.find(
                          v => v?.variant === ImageVariant.THUMBNAIL,
                      )?.url,
                      medium: material.mediaFile.variants?.find(
                          v => v?.variant === ImageVariant.MEDIUM,
                      )?.url,
                      original:
                          material.mediaFile.variants?.find(
                              v => v.variant === ImageVariant.ORIGINAL,
                          )?.url || material.mediaFile.url,
                      type: material.mediaFile.type,
                      size: material.mediaFile.size,
                      mimeType: material.mediaFile.mimeType,
                      variants: material.mediaFile.variants,
                  }
                : undefined,
            externalUrl: material.externalUrl,
            type: material.type,
            sortOrder: material.sortOrder,
            isActive: material.isActive,
            courseId: material.courseId,
            createdBy: material.createdBy,
            updatedBy: material.updatedBy,
            createdAt: material.createdAt,
            updatedAt: material.updatedAt,
            course: material.course
                ? {
                      courseId: material.course.courseId,
                      title: material.course.title,
                      description: material.course.description,
                      orgId: material.course.orgId?.id,
                      branchId: material.course.branchId?.id,
                  }
                : undefined,
            creator: material.creator
                ? {
                      id: material.creator.id,
                      firstName: material.creator.firstName,
                      lastName: material.creator.lastName,
                      email: material.creator.email,
                  }
                : undefined,
        };
    }

    /**
     * Create a new course material
     */
    async create(
        createCourseMaterialDto: CreateCourseMaterialDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate course access
            const course = await this.validateCourseAccessWithScope(
                createCourseMaterialDto.courseId,
                scope,
                createCourseMaterialDto.createdBy,
            );

            // Validate creator exists
            const creator = await this.userRepository.findOne({
                where: { id: createCourseMaterialDto.createdBy },
            });

            if (!creator) {
                throw new NotFoundException(
                    `User with ID ${createCourseMaterialDto.createdBy} not found`,
                );
            }

            // Validate media file if provided
            let mediaFile: MediaFile | undefined;
            if (createCourseMaterialDto.mediaFileId) {
                mediaFile =
                    (await this.mediaRepository.findOne({
                        where: { id: createCourseMaterialDto.mediaFileId },
                    })) || undefined;

                if (!mediaFile) {
                    throw new NotFoundException(
                        `Media file with ID ${createCourseMaterialDto.mediaFileId} not found`,
                    );
                }
            }

            // Create the material
            const material = this.courseMaterialRepository.create({
                title: createCourseMaterialDto.title,
                description: createCourseMaterialDto.description,
                mediaFile,
                externalUrl: createCourseMaterialDto.externalUrl,
                type: createCourseMaterialDto.type,
                sortOrder: createCourseMaterialDto.sortOrder,
                isActive: createCourseMaterialDto.isActive,
                courseId: createCourseMaterialDto.courseId,
                createdBy: createCourseMaterialDto.createdBy,
                orgId: course.orgId,
                branchId: course.branchId,
            });

            const savedMaterial =
                await this.courseMaterialRepository.save(material);

            // Invalidate related caches
            await this.invalidateCourseListCaches(
                createCourseMaterialDto.courseId,
            );

            // Emit event for logging/analytics
            this.eventEmitter.emit('course-material.created', {
                materialId: savedMaterial.materialId,
                courseId: savedMaterial.courseId,
                title: savedMaterial.title,
                type: savedMaterial.type,
                createdBy: savedMaterial.createdBy,
                orgId: course.orgId?.id,
                branchId: course.branchId?.id,
            });

            this.logger.log(
                `Course material created: ${savedMaterial.materialId} by user ${savedMaterial.createdBy}`,
            );

            return {
                message: 'Course material created successfully',
                status: 'success',
                code: 201,
            };
        });
    }

    /**
     * Find all materials for a course with caching
     */
    async findByCourse(
        courseId: number,
        scope: OrgBranchScope,
        userId?: string,
        options: {
            includeInactive?: boolean;
            sortBy?: 'title' | 'createdAt' | 'sortOrder';
            sortOrder?: 'ASC' | 'DESC';
        } = {},
    ): Promise<CourseMaterialListApiResponse> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.MATERIALS_BY_COURSE(courseId);

            try {
                const cachedResult =
                    await this.cacheManager.get<CourseMaterialListApiResponse>(
                        cacheKey,
                    );

                if (cachedResult && !options.includeInactive) {
                    this.logger.debug(
                        `Cache hit for course materials: ${cacheKey}`,
                    );
                    return cachedResult;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // Validate course access
            const course = await this.validateCourseAccessWithScope(
                courseId,
                scope,
                userId,
            );

            // Build query
            const queryBuilder = this.courseMaterialRepository
                .createQueryBuilder('material')
                .leftJoinAndSelect('material.course', 'course')
                .leftJoinAndSelect('material.creator', 'creator')
                .leftJoinAndSelect('material.mediaFile', 'mediaFile')
                .where('material.courseId = :courseId', { courseId });

            // Filter by status - only show active materials by default
            queryBuilder.andWhere('material.status = :status', {
                status: MaterialStatus.ACTIVE,
            });

            // Filter by active status if needed
            if (!options.includeInactive) {
                queryBuilder.andWhere('material.isActive = :isActive', {
                    isActive: true,
                });
            }

            // Apply sorting
            const sortBy = options.sortBy || 'sortOrder';
            const sortOrder = options.sortOrder || 'ASC';
            queryBuilder.orderBy(`material.${sortBy}`, sortOrder);

            // If secondary sort needed
            if (sortBy !== 'sortOrder') {
                queryBuilder.addOrderBy('material.sortOrder', 'ASC');
            }

            const [materials, total] = await queryBuilder.getManyAndCount();

            // Load media file variants for each material
            const materialsWithVariants = await Promise.all(
                materials.map(material => this.loadMediaFileVariants(material)),
            );

            const result: CourseMaterialListApiResponse = {
                success: true,
                message: 'Course materials retrieved successfully',
                data: {
                    materials: materialsWithVariants.map(material =>
                        this.mapToResponseDto(material),
                    ),
                    total,
                    course: {
                        courseId: course.courseId,
                        title: course.title,
                        description: course.description,
                    },
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };

            // Cache the result if not including inactive materials
            if (!options.includeInactive) {
                try {
                    await this.cacheManager.set(
                        cacheKey,
                        result,
                        this.CACHE_TTL.MATERIALS_LIST * 1000,
                    );
                    this.logger.debug(
                        `Cache set for course materials: ${cacheKey}`,
                    );
                } catch (error) {
                    this.logger.warn(
                        `Cache set failed for key ${cacheKey}:`,
                        error,
                    );
                }
            }

            return result;
        });
    }

    /**
     * Find a single material by ID with caching
     */
    async findOne(
        id: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<CourseMaterialResponseDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.MATERIAL_BY_ID(id);

            try {
                const cachedMaterial =
                    await this.cacheManager.get<CourseMaterialResponseDto>(
                        cacheKey,
                    );

                if (cachedMaterial) {
                    this.logger.debug(`Cache hit for material: ${cacheKey}`);
                    return cachedMaterial;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            const material = await this.courseMaterialRepository.findOne({
                where: { materialId: id, status: MaterialStatus.ACTIVE },
                relations: [
                    'course',
                    'course.orgId',
                    'course.branchId',
                    'creator',
                    'mediaFile',
                ],
            });

            if (!material) {
                throw new NotFoundException(
                    `Course material with ID ${id} not found`,
                );
            }

            // Validate course access
            await this.validateCourseAccessWithScope(
                material.courseId,
                scope,
                userId,
            );

            // Load media file variants
            const materialWithVariants =
                await this.loadMediaFileVariants(material);

            const result = this.mapToResponseDto(materialWithVariants);

            // Cache the result
            try {
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.MATERIAL * 1000,
                );
                this.logger.debug(`Cache set for material: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return result;
        });
    }

    /**
     * Update a course material
     */
    async update(
        id: number,
        updateCourseMaterialDto: UpdateCourseMaterialDto,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const material = await this.courseMaterialRepository.findOne({
                where: { materialId: id },
                relations: ['course'],
            });

            if (!material) {
                throw new NotFoundException(
                    `Course material with ID ${id} not found`,
                );
            }

            // Validate course access
            await this.validateCourseAccessWithScope(
                material.courseId,
                scope,
                userId,
            );

            // If courseId is being changed, validate new course access
            if (
                updateCourseMaterialDto.courseId &&
                updateCourseMaterialDto.courseId !== material.courseId
            ) {
                await this.validateCourseAccessWithScope(
                    updateCourseMaterialDto.courseId,
                    scope,
                    userId,
                );
            }

            // Validate media file if provided
            let mediaFile: MediaFile | undefined;
            if (updateCourseMaterialDto.mediaFileId) {
                mediaFile =
                    (await this.mediaRepository.findOne({
                        where: { id: updateCourseMaterialDto.mediaFileId },
                    })) || undefined;

                if (!mediaFile) {
                    throw new NotFoundException(
                        `Media file with ID ${updateCourseMaterialDto.mediaFileId} not found`,
                    );
                }
            }

            // Update the material
            if (updateCourseMaterialDto.title !== undefined) {
                material.title = updateCourseMaterialDto.title;
            }
            if (updateCourseMaterialDto.description !== undefined) {
                material.description = updateCourseMaterialDto.description;
            }
            if (updateCourseMaterialDto.mediaFileId !== undefined) {
                material.mediaFile = mediaFile;
            }
            if (updateCourseMaterialDto.externalUrl !== undefined) {
                material.externalUrl = updateCourseMaterialDto.externalUrl;
            }
            if (updateCourseMaterialDto.type !== undefined) {
                material.type = updateCourseMaterialDto.type;
            }
            if (updateCourseMaterialDto.sortOrder !== undefined) {
                material.sortOrder = updateCourseMaterialDto.sortOrder;
            }
            if (updateCourseMaterialDto.isActive !== undefined) {
                material.isActive = updateCourseMaterialDto.isActive;
            }
            if (updateCourseMaterialDto.updatedBy) {
                material.updatedBy = updateCourseMaterialDto.updatedBy;
            }

            const updatedMaterial =
                await this.courseMaterialRepository.save(material);

            // Invalidate caches
            await this.invalidateMaterialCache(id, material.courseId);
            if (
                updateCourseMaterialDto.courseId &&
                updateCourseMaterialDto.courseId !== material.courseId
            ) {
                await this.invalidateCourseListCaches(
                    updateCourseMaterialDto.courseId,
                );
            }

            // Emit event
            this.eventEmitter.emit('course-material.updated', {
                materialId: updatedMaterial.materialId,
                courseId: updatedMaterial.courseId,
                title: updatedMaterial.title,
                updatedBy: updatedMaterial.updatedBy,
                changes: updateCourseMaterialDto,
            });

            this.logger.log(
                `Course material updated: ${updatedMaterial.materialId} by user ${updatedMaterial.updatedBy || userId}`,
            );

            return {
                message: 'Course material updated successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Delete a course material
     */
    async remove(
        id: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const material = await this.courseMaterialRepository.findOne({
                where: { materialId: id },
                relations: ['course'],
            });

            if (!material) {
                throw new NotFoundException(
                    `Course material with ID ${id} not found`,
                );
            }

            // Validate course access
            await this.validateCourseAccessWithScope(
                material.courseId,
                scope,
                userId,
            );

            const materialInfo = {
                materialId: material.materialId,
                courseId: material.courseId,
                title: material.title,
                type: material.type,
                deletedBy: userId,
            };

            await this.courseMaterialRepository.remove(material);

            // Invalidate caches
            await this.invalidateMaterialCache(id, material.courseId);

            // Emit event
            this.eventEmitter.emit('course-material.deleted', materialInfo);

            this.logger.log(
                `Course material deleted: ${materialInfo.materialId} by user ${userId}`,
            );

            return {
                message: 'Course material deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Get material count for a course with caching
     */
    async getMaterialCount(
        courseId: number,
        includeInactive = false,
    ): Promise<number> {
        return this.retryOperation(async () => {
            const cacheKey = this.CACHE_KEYS.MATERIALS_COUNT(courseId);

            try {
                const cachedCount =
                    await this.cacheManager.get<number>(cacheKey);
                if (
                    cachedCount !== undefined &&
                    cachedCount !== null &&
                    !includeInactive
                ) {
                    this.logger.debug(
                        `Cache hit for material count: ${cacheKey}`,
                    );
                    return cachedCount;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            const whereClause: {
                courseId: number;
                status: MaterialStatus;
                isActive?: boolean;
            } = { courseId, status: MaterialStatus.ACTIVE };
            if (!includeInactive) {
                whereClause.isActive = true;
            }

            const count = await this.courseMaterialRepository.count({
                where: whereClause,
            });

            if (!includeInactive) {
                try {
                    await this.cacheManager.set(
                        cacheKey,
                        count,
                        this.CACHE_TTL.COUNT * 1000,
                    );
                    this.logger.debug(
                        `Cache set for material count: ${cacheKey}`,
                    );
                } catch (error) {
                    this.logger.warn(
                        `Cache set failed for key ${cacheKey}:`,
                        error,
                    );
                }
            }

            return count;
        });
    }

    /**
     * Reorder materials within a course
     */
    async reorderMaterials(
        courseId: number,
        materialOrders: { materialId: number; sortOrder: number }[],
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate course access
            await this.validateCourseAccessWithScope(courseId, scope, userId);

            // Validate all materials belong to the course
            const materials = await this.courseMaterialRepository.find({
                where: {
                    courseId,
                    materialId: In(
                        materialOrders.map(order => order.materialId),
                    ),
                },
            });

            if (materials.length !== materialOrders.length) {
                throw new ConflictException(
                    'Some materials do not belong to the specified course',
                );
            }

            // Update sort orders
            await Promise.all(
                materialOrders.map(({ materialId, sortOrder }) =>
                    this.courseMaterialRepository.update(
                        { materialId },
                        { sortOrder, updatedBy: userId },
                    ),
                ),
            );

            // Invalidate caches
            await this.invalidateCourseListCaches(courseId);

            // Emit event
            this.eventEmitter.emit('course-materials.reordered', {
                courseId,
                materialOrders,
                reorderedBy: userId,
            });

            this.logger.log(
                `Course materials reordered for course ${courseId} by user ${userId}`,
            );

            return {
                message: 'Course materials reordered successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Soft delete a course material by setting status to DELETED
     */
    async softDelete(
        materialId: number,
        scope: OrgBranchScope,
        deletedBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // First check if material exists and is not already deleted
            const material = await this.courseMaterialRepository.findOne({
                where: { materialId },
                relations: ['course'],
            });

            if (!material) {
                throw new NotFoundException(
                    `Course material with ID ${materialId} not found`,
                );
            }

            if (material.status === MaterialStatus.DELETED) {
                throw new BadRequestException(
                    'Course material is already deleted',
                );
            }

            // Validate course access
            await this.validateCourseAccessWithScope(
                material.courseId,
                scope,
                deletedBy,
            );

            // Update status to DELETED
            await this.courseMaterialRepository.update(materialId, {
                status: MaterialStatus.DELETED,
                updatedBy: deletedBy,
            });

            // Invalidate material cache
            await this.invalidateMaterialCache(materialId, material.courseId);

            return {
                message: 'Course material deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Restore a soft-deleted course material by setting status to ACTIVE
     */
    async restoreMaterial(
        materialId: number,
        scope: OrgBranchScope,
        restoredBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // First check if material exists and is deleted
            const material = await this.courseMaterialRepository.findOne({
                where: { materialId },
                relations: ['course'],
            });

            if (!material) {
                throw new NotFoundException(
                    `Course material with ID ${materialId} not found`,
                );
            }

            if (material.status !== MaterialStatus.DELETED) {
                throw new BadRequestException(
                    'Course material is not deleted and cannot be restored',
                );
            }

            // Validate course access
            await this.validateCourseAccessWithScope(
                material.courseId,
                scope,
                restoredBy,
            );

            // Update status to ACTIVE
            await this.courseMaterialRepository.update(materialId, {
                status: MaterialStatus.ACTIVE,
                updatedBy: restoredBy,
            });

            // Invalidate material cache
            await this.invalidateMaterialCache(materialId, material.courseId);

            return {
                message: 'Course material restored successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Find all soft-deleted course materials (for admin purposes)
     */
    async findDeleted(): Promise<CourseMaterial[]> {
        return this.retryOperation(async () => {
            const materials = await this.courseMaterialRepository.find({
                where: { status: MaterialStatus.DELETED },
                relations: ['course', 'creator', 'updater', 'mediaFile'],
            });

            // Load media file variants for all materials
            return Promise.all(
                materials.map(material => this.loadMediaFileVariants(material)),
            );
        });
    }

    /**
     * Find all course materials with any status (for admin purposes)
     */
    async findAllWithDeleted(): Promise<CourseMaterial[]> {
        return this.retryOperation(async () => {
            const materials = await this.courseMaterialRepository.find({
                relations: ['course', 'creator', 'updater', 'mediaFile'],
            });

            // Load media file variants for all materials
            return Promise.all(
                materials.map(material => this.loadMediaFileVariants(material)),
            );
        });
    }

    /**
     * Find course material by ID including deleted materials (for admin purposes)
     */
    async findByIdWithDeleted(id: number): Promise<CourseMaterial | null> {
        return this.retryOperation(async () => {
            const material = await this.courseMaterialRepository.findOne({
                where: { materialId: id },
                relations: ['course', 'creator', 'updater', 'mediaFile'],
            });

            if (material) {
                return this.loadMediaFileVariants(material);
            }
            return material;
        });
    }
}
