import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { StandardOperationResponse } from './dto/common-response.dto';
import { User, UserStatus } from './entities/user.entity';
import { MediaFile } from '../media-manager/entities/media-manager.entity';
import { Organization } from '../org/entities/org.entity';
import { Branch } from '../branch/entities/branch.entity';
import {
    UserCreatedEvent,
    UserProfileUpdatedEvent,
    UserPasswordChangedEvent,
    UserOrgBranchAssignedEvent,
    UserDeactivatedEvent,
    UserRestoredEvent,
} from '../common/events';
import { RetryService } from '../common/services/retry.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    // Cache keys with comprehensive coverage and org/branch scope
    private readonly CACHE_KEYS = {
        USER_BY_ID: (id: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:id:${id}`,
        USER_BY_EMAIL: (email: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:email:${email}`,
        USERS_LIST: (filters: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:users:list:${filters}`,
        USERS_BY_ORG: (orgId: string, filters: string, branchId?: string) =>
            `org:${orgId}:branch:${branchId || 'global'}:users:org:${filters}`,
        USERS_BY_BRANCH: (branchId: string, filters: string, orgId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId}:users:branch:${filters}`,
        USER_AVATAR_VARIANTS: (
            avatarId: number,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:avatar:${avatarId}`,
        ALL_USERS: (orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:users:all`,
        USER_DETAIL: (id: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:detail:${id}`,
    };

    // Cache TTL in seconds with different durations for different data types
    private readonly CACHE_TTL = {
        USER: 300, // 5 minutes
        USER_LIST: 180, // 3 minutes
        USER_DETAIL: 300, // 5 minutes
        AVATAR_VARIANTS: 600, // 10 minutes
        USERS_ALL: 900, // 15 minutes
    };

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(MediaFile)
        private readonly mediaRepository: Repository<MediaFile>,
        private readonly eventEmitter: EventEmitter2,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
    ) {}

    /**
     * Cache helper methods
     */
    private async invalidateUserCache(
        userId: string,
        email?: string,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.USER_BY_ID(userId, orgId, branchId),
        ];

        if (email) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_BY_EMAIL(email, orgId, branchId),
            );
        }

        // Also invalidate list cache
        keysToDelete.push(this.CACHE_KEYS.USERS_LIST('', orgId, branchId));

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

    private async invalidateUserListCaches(
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        // Clear general user list caches
        const keysToInvalidate = [this.CACHE_KEYS.ALL_USERS(orgId, branchId)];

        await Promise.all(
            keysToInvalidate.map(async key => {
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

        // Note: In production, consider implementing cache tags or maintaining
        // a registry of active cache keys for more granular invalidation
    }

    private generateCacheKeyForUsers(
        filters?: UserFilterDto,
        prefix: string = 'list',
        orgId?: string,
        branchId?: string,
    ): string {
        const filterKey = JSON.stringify({
            search: filters?.search,
            status: filters?.status,
            role: filters?.role,
            page: filters?.page,
            limit: filters?.limit,
            orgId: filters?.orgId,
            branchId: filters?.branchId,
        });

        return this.CACHE_KEYS.USERS_LIST(
            `${prefix}:${filterKey}`,
            orgId,
            branchId,
        );
    }

    async create(
        createUserDto: CreateUserDto,
        scope?: { orgId?: string; branchId?: string; userId: string },
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            const { avatar, password, ...userData } = createUserDto;
            const userToCreate: Partial<User> = { ...userData };

            // Hash password before saving
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            userToCreate.password = hashedPassword;

            // Convert avatar ID to MediaFile reference if provided
            if (avatar) {
                userToCreate.avatar = { id: avatar } as MediaFile;
            }

            // Set organization and branch from scope if available
            if (scope?.orgId) {
                userToCreate.orgId = { id: scope.orgId } as Organization;
            }
            if (scope?.branchId) {
                userToCreate.branchId = { id: scope.branchId } as Branch;
            }

            const user = this.userRepository.create(userToCreate);
            const savedUser = await this.userRepository.save(user);

            // Invalidate list caches since a new user was created
            await this.invalidateUserListCaches(scope?.orgId, scope?.branchId);

            // Emit user created event with organization and branch information
            this.eventEmitter.emit(
                'user.created',
                new UserCreatedEvent(
                    savedUser.id,
                    savedUser.email,
                    savedUser.firstName,
                    savedUser.lastName,
                    savedUser.orgId?.id || scope?.orgId,
                    savedUser.orgId?.name,
                    savedUser.branchId?.id || scope?.branchId,
                    savedUser.branchId?.name,
                    savedUser.avatar?.id?.toString(),
                ),
            );

            return {
                message: 'User created successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Load avatar variants for a user
     */
    private async loadAvatarVariants(user: User): Promise<User> {
        if (user.avatar?.id) {
            try {
                // Check cache first for avatar variants - using org/branch scoped key
                const cacheKey = this.CACHE_KEYS.USER_AVATAR_VARIANTS(
                    user.avatar.id,
                    user.orgId?.id,
                    user.branchId?.id,
                );
                const cachedVariants =
                    await this.cacheManager.get<any[]>(cacheKey);

                if (cachedVariants) {
                    user.avatar.variants = cachedVariants;
                } else {
                    // Fetch from database if not cached
                    const variants = await this.mediaRepository.find({
                        where: {
                            originalFileId: user.avatar.id,
                            isActive: true,
                        },
                        order: { variant: 'ASC' },
                    });

                    if (variants.length > 0) {
                        user.avatar.variants = variants;
                        // Cache the variants
                        await this.cacheManager.set(
                            cacheKey,
                            variants,
                            this.CACHE_TTL.AVATAR_VARIANTS * 1000,
                        );
                    }
                }
            } catch (error) {
                this.logger.warn('Failed to load avatar variants:', error);
            }
        }
        return user;
    }

    async findAll(scope?: {
        orgId?: string;
        branchId?: string;
        userId: string;
    }): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            // Build query with proper scoping
            const queryBuilder = this.userRepository
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.orgId', 'org')
                .leftJoinAndSelect('user.branchId', 'branch')
                .leftJoinAndSelect('user.avatar', 'avatar')
                .where('user.status = :status', { status: UserStatus.ACTIVE });

            // Apply org/branch scoping if provided
            if (scope?.orgId) {
                queryBuilder.andWhere('user.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope?.branchId) {
                queryBuilder.andWhere('user.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const users = await queryBuilder.getMany();

            // Load avatar variants for all users
            return Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );
        });
    }

    /**
     * Find users with filters and pagination - compliant with module standards
     */
    async findAllWithFilters(
        filters: UserFilterDto,
        scope?: { orgId?: string; branchId?: string; userId: string },
    ): Promise<{ users: User[]; total: number; totalPages: number }> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.generateCacheKeyForUsers(
                filters,
                'all',
                scope?.orgId,
                scope?.branchId,
            );

            try {
                const cachedResult = await this.cacheManager.get<{
                    users: User[];
                    total: number;
                    totalPages: number;
                }>(cacheKey);

                if (cachedResult) {
                    this.logger.debug(`Cache hit for user list: ${cacheKey}`);
                    return cachedResult;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // Build query using TypeORM QueryBuilder for proper type safety
            const queryBuilder = this.userRepository
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.orgId', 'org')
                .leftJoinAndSelect('user.branchId', 'branch')
                .leftJoinAndSelect('user.avatar', 'avatar');

            // Apply where conditions properly
            queryBuilder.where('user.status = :status', {
                status: filters.status || UserStatus.ACTIVE,
            });

            // Apply org/branch scoping - scope takes precedence over filter
            if (scope?.orgId || filters.orgId) {
                queryBuilder.andWhere('user.orgId = :orgId', {
                    orgId: scope?.orgId || filters.orgId,
                });
            }
            if (scope?.branchId || filters.branchId) {
                queryBuilder.andWhere('user.branchId = :branchId', {
                    branchId: scope?.branchId || filters.branchId,
                });
            }

            // Apply role filter
            if (filters.role) {
                queryBuilder.andWhere('user.role = :role', {
                    role: filters.role,
                });
            }

            // Apply search filter
            if (filters.search) {
                queryBuilder.andWhere(
                    '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
                    { search: `%${filters.search}%` },
                );
            }

            // Get total count
            const total = await queryBuilder.getCount();

            // Apply pagination
            const page = filters.page || 1;
            const limit = filters.limit || 20;
            const skip = (page - 1) * limit;

            queryBuilder.skip(skip).take(limit);

            // Execute query
            const users = await queryBuilder.getMany();

            // Load avatar variants for all users
            const usersWithVariants = await Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );

            const totalPages = Math.ceil(total / limit);
            const result = { users: usersWithVariants, total, totalPages };

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.USER_LIST * 1000,
                );
                this.logger.debug(`Cache set for user list: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return result;
        });
    }

    async findOne(id: string): Promise<User | null> {
        return this.retryService.executeDatabase(async () => {
            const user = await this.userRepository.findOne({
                where: { id, status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                return this.loadAvatarVariants(user);
            }
            return user;
        });
    }

    async findByEmail(
        email: string,
        scope?: { orgId?: string; branchId?: string },
    ): Promise<User | null> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first - using org/branch scoped key
            const cacheKey = this.CACHE_KEYS.USER_BY_EMAIL(
                email,
                scope?.orgId,
                scope?.branchId,
            );
            const cachedUser = await this.cacheManager.get<User>(cacheKey);

            if (cachedUser) {
                return cachedUser;
            }

            // Build where condition with org/branch scoping
            const whereCondition: Record<string, any> = {
                email,
                status: UserStatus.ACTIVE,
            };
            if (scope?.orgId) {
                whereCondition.orgId = { id: scope.orgId };
            }
            if (scope?.branchId) {
                whereCondition.branchId = { id: scope.branchId };
            }

            // If not in cache, fetch from database
            const user = await this.userRepository.findOne({
                where: whereCondition,
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                const userWithVariants = await this.loadAvatarVariants(user);
                // Cache the result
                await this.cacheManager.set(
                    cacheKey,
                    userWithVariants,
                    this.CACHE_TTL.USER * 1000,
                );
                return userWithVariants;
            }
            return user;
        });
    }

    async findByEmailWithFullDetails(email: string): Promise<User | null> {
        return this.retryService.executeDatabase(async () => {
            const user = await this.userRepository.findOne({
                where: { email },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                return this.loadAvatarVariants(user);
            }
            return user;
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USER_BY_ID(id);
            const cachedUser = await this.cacheManager.get<User>(cacheKey);

            if (cachedUser) {
                return cachedUser;
            }

            // If not in cache, fetch from database
            const user = await this.userRepository.findOne({
                where: { id },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                const userWithVariants = await this.loadAvatarVariants(user);
                // Cache the result
                await this.cacheManager.set(
                    cacheKey,
                    userWithVariants,
                    this.CACHE_TTL.USER * 1000, // Convert to milliseconds
                );
                return userWithVariants;
            }
            return user;
        });
    }

    async findByOrganization(orgId: string): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USERS_BY_ORG(orgId, '');
            const cachedUsers = await this.cacheManager.get<User[]>(cacheKey);

            if (cachedUsers) {
                return cachedUsers;
            }

            // If not in cache, fetch from database
            const users = await this.userRepository.find({
                where: {
                    orgId: { id: orgId },
                    status: UserStatus.ACTIVE,
                },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            const usersWithVariants = await Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                usersWithVariants,
                this.CACHE_TTL.USER_LIST * 1000,
            );

            return usersWithVariants;
        });
    }

    async findByBranch(branchId: string): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USERS_BY_BRANCH(branchId, '');
            const cachedUsers = await this.cacheManager.get<User[]>(cacheKey);

            if (cachedUsers) {
                return cachedUsers;
            }

            // If not in cache, fetch from database
            const users = await this.userRepository.find({
                where: {
                    branchId: { id: branchId },
                    status: UserStatus.ACTIVE,
                },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            const usersWithVariants = await Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                usersWithVariants,
                this.CACHE_TTL.USER_LIST * 1000,
            );

            return usersWithVariants;
        });
    }

    async update(
        id: string,
        updateUserDto: UpdateUserDto,
        scope?: { orgId?: string; branchId?: string; userId: string },
    ): Promise<StandardOperationResponse> {
        const { avatar, ...updateData } = updateUserDto;
        const dataToUpdate: Partial<User> = { ...updateData };

        // Get user first to know email for cache invalidation
        const existingUser = await this.findOne(id);
        if (!existingUser) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Convert avatar ID to MediaFile reference if provided
        if (avatar !== undefined) {
            dataToUpdate.avatar = avatar
                ? ({ id: avatar } as MediaFile)
                : undefined;
        }

        await this.userRepository.update(id, dataToUpdate);

        // Invalidate user cache with org/branch scope
        await this.invalidateUserCache(
            id,
            existingUser.email,
            scope?.orgId || existingUser.orgId?.id,
            scope?.branchId || existingUser.branchId?.id,
        );
        await this.invalidateUserListCaches(
            scope?.orgId || existingUser.orgId?.id,
            scope?.branchId || existingUser.branchId?.id,
        );

        return {
            message: 'User updated successfully',
            status: 'success',
            code: 200,
        };
    }

    async remove(id: string): Promise<StandardOperationResponse> {
        const result = await this.userRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return {
            message: 'User deleted successfully',
            status: 'success',
            code: 200,
        };
    }

    async updateProfile(
        id: string,
        updateData: Partial<UpdateUserDto>,
    ): Promise<StandardOperationResponse> {
        try {
            const { avatar, ...profileData } = updateData;
            const dataToUpdate: Partial<User> = { ...profileData };

            // Get user first for cache invalidation and event data
            const user = await this.findById(id);
            if (!user) {
                throw new NotFoundException(`User with ID ${id} not found`);
            }

            // Convert avatar ID to MediaFile reference if provided
            if (avatar !== undefined) {
                dataToUpdate.avatar = avatar
                    ? ({ id: avatar } as MediaFile)
                    : undefined;
            }

            await this.userRepository.update(id, dataToUpdate);

            // Invalidate user cache
            await this.invalidateUserCache(id, user.email);

            // Emit user profile updated event
            const updatedFields = Object.keys(updateData);
            this.eventEmitter.emit(
                'user.profile.updated',
                new UserProfileUpdatedEvent(
                    user.id,
                    user.email,
                    user.firstName,
                    user.lastName,
                    user.orgId?.id,
                    user.orgId?.name,
                    user.branchId?.id,
                    user.branchId?.name,
                    user.avatar?.id?.toString(),
                    updatedFields,
                ),
            );

            return {
                message: 'Profile updated successfully',
                status: 'success',
                code: 200,
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                return {
                    message: error.message,
                    status: 'error',
                    code: 404,
                };
            }
            throw error;
        }
    }

    async changePassword(
        id: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<StandardOperationResponse> {
        const user = await this.findById(id);
        if (!user) {
            return {
                message: `User with ID ${id} not found`,
                status: 'error',
                code: 404,
            };
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            user.password,
        );
        if (!isCurrentPasswordValid) {
            return {
                message: 'Current password is incorrect',
                status: 'error',
                code: 400,
            };
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await this.userRepository.update(id, {
            password: hashedNewPassword,
        });

        // Emit password changed event
        this.eventEmitter.emit(
            'user.password.changed',
            new UserPasswordChangedEvent(
                user.id,
                user.email,
                user.firstName,
                user.lastName,
                user.orgId?.id,
                user.orgId?.name,
                user.branchId?.id,
                user.branchId?.name,
            ),
        );

        return {
            message: 'Password changed successfully',
            status: 'success',
            code: 200,
        };
    }

    /**
     * Assign organization and branch to a user
     */
    async assignOrgAndBranch(
        userId: string,
        orgId?: string,
        branchId?: string,
        assignedBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            const updateData: Record<string, any> = {};

            if (orgId) {
                updateData['orgId'] = { id: orgId };
            }

            if (branchId) {
                updateData['branchId'] = { id: branchId };
            }

            await this.userRepository.update(userId, updateData);

            const user = await this.findOne(userId);
            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            // Emit user organization/branch assignment event
            this.eventEmitter.emit(
                'user.org.branch.assigned',
                new UserOrgBranchAssignedEvent(
                    user.id,
                    user.email,
                    user.firstName,
                    user.lastName,
                    user.orgId?.id,
                    user.orgId?.name,
                    user.branchId?.id,
                    user.branchId?.name,
                    user.avatar?.id?.toString(),
                    assignedBy,
                ),
            );

            return {
                message: 'Organization and branch assigned successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Update user password directly (for password reset)
     */
    async updatePassword(
        userId: string,
        hashedPassword: string,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            const result = await this.userRepository.update(userId, {
                password: hashedPassword,
            });

            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            return {
                message: 'Password updated successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Mark user email as verified
     */
    async verifyEmail(userId: string): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            const result = await this.userRepository.update(userId, {
                emailVerified: true,
            });

            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            return {
                message: 'Email verified successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Soft delete a user by setting status to DELETED
     */
    async softDelete(
        userId: string,
        deactivatedBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // First check if user exists and is not already deleted
            const user = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            if (user.status === UserStatus.DELETED) {
                throw new BadRequestException('User is already deleted');
            }

            // Update status to DELETED
            await this.userRepository.update(userId, {
                status: UserStatus.DELETED,
            });

            // Emit user deactivated event
            this.eventEmitter.emit(
                'user.deactivated',
                new UserDeactivatedEvent(
                    user.id,
                    user.email,
                    user.firstName,
                    user.lastName,
                    user.orgId?.id,
                    user.orgId?.name,
                    user.branchId?.id,
                    user.branchId?.name,
                    deactivatedBy,
                    'Account deactivated by user',
                ),
            );

            return {
                message: 'User deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Restore a soft-deleted user by setting status to ACTIVE
     */
    async restoreUser(
        userId: string,
        restoredBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // First check if user exists and is deleted
            const user = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            if (user.status !== UserStatus.DELETED) {
                throw new BadRequestException(
                    'User is not deleted and cannot be restored',
                );
            }

            // Update status to ACTIVE
            await this.userRepository.update(userId, {
                status: UserStatus.ACTIVE,
            });

            // Emit user restored event
            this.eventEmitter.emit(
                'user.restored',
                new UserRestoredEvent(
                    user.id,
                    user.email,
                    user.firstName,
                    user.lastName,
                    user.orgId?.id,
                    user.orgId?.name,
                    user.branchId?.id,
                    user.branchId?.name,
                    restoredBy,
                ),
            );

            return {
                message: 'User restored successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Find all soft-deleted users (for admin purposes)
     */
    async findDeleted(): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            const users = await this.userRepository.find({
                where: { status: UserStatus.DELETED },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            return Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );
        });
    }
}
