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
import { User, UserStatus, UserRole } from './entities/user.entity';
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
     * Helper method to determine if deleted users should be included
     */
    private shouldIncludeDeleted(userRole?: string): boolean {
        return userRole === UserRole.BRANDON || userRole === UserRole.ADMIN;
    }

    /**
     * Comprehensive cache invalidation methods following module standards
     */
    private async invalidateUserCache(
        userId: string,
        email?: string,
        orgId?: string,
        branchId?: string,
        avatarId?: number,
    ): Promise<void> {
        const keysToDelete: string[] = [];

        // Individual user caches with org/branch scoping
        keysToDelete.push(
            this.CACHE_KEYS.USER_BY_ID(userId, orgId, branchId),
            this.CACHE_KEYS.USER_DETAIL(userId, orgId, branchId),
        );

        if (email) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_BY_EMAIL(email, orgId, branchId),
            );
        }

        if (avatarId) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_AVATAR_VARIANTS(avatarId, orgId, branchId),
            );
        }

        // Also invalidate global scoped caches for this user
        keysToDelete.push(
            this.CACHE_KEYS.USER_BY_ID(userId),
            this.CACHE_KEYS.USER_DETAIL(userId),
        );

        if (email) {
            keysToDelete.push(this.CACHE_KEYS.USER_BY_EMAIL(email));
        }

        this.logger.log(
            `🗑️ Cache Invalidation - Individual User Cache Keys to Delete:`,
            {
                userId,
                email,
                orgId,
                branchId,
                avatarId,
                keysToDelete,
            },
        );

        const deletionResults = await Promise.all(
            keysToDelete.map(async key => {
                try {
                    const existsBefore = await this.cacheManager.get(key);
                    await this.cacheManager.del(key);
                    const existsAfter = await this.cacheManager.get(key);

                    this.logger.log(`🔍 Cache Key Deletion Result:`, {
                        key,
                        existedBefore: !!existsBefore,
                        existsAfter: !!existsAfter,
                        deletionSuccess: !existsAfter,
                    });

                    return {
                        key,
                        success: !existsAfter,
                        existedBefore: !!existsBefore,
                    };
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                    return { key, success: false, error: String(error) };
                }
            }),
        );

        this.logger.log(`✅ Cache Invalidation Summary - Individual User:`, {
            userId,
            totalKeys: keysToDelete.length,
            successfulDeletions: deletionResults.filter(r => r.success).length,
            deletionResults,
        });
    }

    private async invalidateUserListCaches(
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keysToInvalidate: string[] = [];

        // All user list caches for this org/branch scope
        keysToInvalidate.push(this.CACHE_KEYS.ALL_USERS(orgId, branchId));

        // Organization and branch specific caches with empty filters
        if (orgId) {
            keysToInvalidate.push(
                this.CACHE_KEYS.USERS_BY_ORG(orgId, '', branchId),
            );
        }

        if (branchId) {
            keysToInvalidate.push(
                this.CACHE_KEYS.USERS_BY_BRANCH(branchId, '', orgId),
            );
        }

        // Also invalidate global scoped list caches
        keysToInvalidate.push(this.CACHE_KEYS.ALL_USERS());

        // ⭐ CRITICAL FIX: Generate all possible filtered list cache keys
        // This handles the actual cache keys generated by findAllWithFilters
        const commonFilterCombinations: Array<
            Partial<{
                page: number;
                limit: number;
                status: string;
                role: string;
                search: string;
                orgId: string;
                branchId: string;
            }>
        > = [
            // Basic pagination combinations
            { page: 1, limit: 20 },
            { page: 1, limit: 10 },
            { page: 1, limit: 50 },
            // With status filters
            { page: 1, limit: 20, status: 'active' },
            { page: 1, limit: 20, status: 'inactive' },
            { page: 1, limit: 20, status: 'suspended' },
            { page: 1, limit: 20, status: 'deleted' },
            // With role filters
            { page: 1, limit: 20, role: 'admin' },
            { page: 1, limit: 20, role: 'user' },
            { page: 1, limit: 20, role: 'owner' },
            { page: 1, limit: 20, role: 'brandon' },
            // Empty filter combinations
            {},
            { page: 1 },
            { limit: 20 },
        ];

        // Generate filtered cache keys for this org/branch scope
        for (const filters of commonFilterCombinations) {
            const filterKey = JSON.stringify({
                search: filters.search,
                status: filters.status,
                role: filters.role,
                page: filters.page,
                limit: filters.limit,
                orgId: filters.orgId,
                branchId: filters.branchId,
            });

            // Generate the exact key format used by findAllWithFilters
            keysToInvalidate.push(
                this.CACHE_KEYS.USERS_LIST(`all:${filterKey}`, orgId, branchId),
            );

            // Also generate global scoped versions
            if (orgId || branchId) {
                keysToInvalidate.push(
                    this.CACHE_KEYS.USERS_LIST(`all:${filterKey}`),
                );
            }
        }

        // ⭐ AGGRESSIVE PATTERN-BASED INVALIDATION
        // Note: For now we use comprehensive manual key generation
        // In future, consider implementing Redis SCAN for pattern-based deletion

        // Remove duplicates
        const uniqueKeys = [...new Set(keysToInvalidate)];

        this.logger.log(
            `🗑️ Cache Invalidation - User List Cache Keys to Delete:`,
            {
                orgId,
                branchId,
                totalKeysToDelete: uniqueKeys.length,
                keysToInvalidate: uniqueKeys.slice(0, 10), // Show first 10 for readability
                hasMoreKeys: uniqueKeys.length > 10,
            },
        );

        // Delete all cache keys
        const deletionResults = await Promise.all(
            uniqueKeys.map(async key => {
                try {
                    const existsBefore = await this.cacheManager.get(key);
                    await this.cacheManager.del(key);
                    const existsAfter = await this.cacheManager.get(key);

                    return {
                        key,
                        success: !existsAfter,
                        existedBefore: !!existsBefore,
                    };
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                    return { key, success: false, error: String(error) };
                }
            }),
        );

        const existedBefore = deletionResults.filter(
            r => r.existedBefore,
        ).length;
        const successfulDeletions = deletionResults.filter(
            r => r.success,
        ).length;

        this.logger.log(`✅ Cache Invalidation Summary - User Lists:`, {
            orgId: orgId || 'global',
            branchId: branchId || 'global',
            totalKeys: uniqueKeys.length,
            keysExistedBefore: existedBefore,
            successfulDeletions,
            actualCacheHits:
                existedBefore > 0
                    ? `✅ ${existedBefore} cache entries were cleared`
                    : `⚠️ No cache entries found to clear`,
        });

        // Log some examples of keys that actually existed
        const existedKeys = deletionResults
            .filter(r => r.existedBefore)
            .slice(0, 5);
        if (existedKeys.length > 0) {
            this.logger.log(
                `🎯 Examples of cache keys that actually existed and were cleared:`,
                {
                    existedKeys: existedKeys.map(k => k.key),
                },
            );
        }

        this.logger.debug(
            `Invalidated user list caches for org:${orgId || 'global'}, branch:${branchId || 'global'}`,
        );
    }

    /**
     * Comprehensive cache invalidation for user operations
     * Follows module standards for org/branch scoped invalidation
     */
    private async invalidateAllUserCaches(
        userId: string,
        user?: Partial<User>,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        this.logger.log(`🚀 Starting Comprehensive Cache Invalidation:`, {
            userId,
            userEmail: user?.email,
            userOrgId: user?.orgId?.id,
            userBranchId: user?.branchId?.id,
            scopeOrgId: orgId,
            scopeBranchId: branchId,
            avatarId: user?.avatar?.id,
        });

        // Invalidate individual user caches
        await this.invalidateUserCache(
            userId,
            user?.email,
            orgId,
            branchId,
            user?.avatar?.id,
        );

        // Invalidate list caches for the affected org/branch scope
        await this.invalidateUserListCaches(orgId, branchId);

        // If user has different org/branch in their data, invalidate those too
        if (user?.orgId?.id && user.orgId.id !== orgId) {
            this.logger.log(
                `🔄 Additional Invalidation - User's Org differs from scope:`,
                {
                    userOrgId: user.orgId.id,
                    scopeOrgId: orgId,
                },
            );
            await this.invalidateUserListCaches(user.orgId.id, branchId);
        }
        if (user?.branchId?.id && user.branchId.id !== branchId) {
            this.logger.log(
                `🔄 Additional Invalidation - User's Branch differs from scope:`,
                {
                    userBranchId: user.branchId.id,
                    scopeBranchId: branchId,
                },
            );
            await this.invalidateUserListCaches(orgId, user.branchId.id);
        }
        if (
            user?.orgId?.id &&
            user?.branchId?.id &&
            (user.orgId.id !== orgId || user.branchId.id !== branchId)
        ) {
            this.logger.log(
                `🔄 Additional Invalidation - User's Org/Branch combo differs from scope:`,
                {
                    userOrgId: user.orgId.id,
                    userBranchId: user.branchId.id,
                    scopeOrgId: orgId,
                    scopeBranchId: branchId,
                },
            );
            await this.invalidateUserListCaches(
                user.orgId.id,
                user.branchId.id,
            );
        }

        this.logger.log(
            `🏁 Completed Comprehensive Cache Invalidation for User: ${userId}`,
        );
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

    /**
     * Helper method to check what cache keys exist for a user (for debugging)
     */
    private async checkUserCacheState(
        userId: string,
        email?: string,
        orgId?: string,
        branchId?: string,
        avatarId?: number,
    ): Promise<void> {
        const keysToCheck: string[] = [];

        // Individual user caches with org/branch scoping
        keysToCheck.push(
            this.CACHE_KEYS.USER_BY_ID(userId, orgId, branchId),
            this.CACHE_KEYS.USER_DETAIL(userId, orgId, branchId),
        );

        if (email) {
            keysToCheck.push(
                this.CACHE_KEYS.USER_BY_EMAIL(email, orgId, branchId),
            );
        }

        if (avatarId) {
            keysToCheck.push(
                this.CACHE_KEYS.USER_AVATAR_VARIANTS(avatarId, orgId, branchId),
            );
        }

        // Also check global scoped caches for this user
        keysToCheck.push(
            this.CACHE_KEYS.USER_BY_ID(userId),
            this.CACHE_KEYS.USER_DETAIL(userId),
        );

        if (email) {
            keysToCheck.push(this.CACHE_KEYS.USER_BY_EMAIL(email));
        }

        const cacheState = await Promise.all(
            keysToCheck.map(async key => {
                try {
                    const exists = await this.cacheManager.get(key);
                    return { key, exists: !!exists, hasData: !!exists };
                } catch (error) {
                    return { key, exists: false, error: String(error) };
                }
            }),
        );

        this.logger.log(`🔍 Cache State Check for User ${userId}:`, {
            userId,
            email,
            orgId,
            branchId,
            avatarId,
            totalKeysChecked: keysToCheck.length,
            existingKeys: cacheState.filter(c => c.exists).length,
            cacheState,
        });
    }

    async create(
        createUserDto: CreateUserDto,
        scope?: {
            orgId?: string;
            branchId?: string;
            userId: string;
            userRole?: string;
        },
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { avatar, password, branchId, ...userData } = createUserDto;
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

            // Comprehensive cache invalidation for new user creation
            await this.invalidateAllUserCaches(
                savedUser.id,
                savedUser,
                scope?.orgId,
                scope?.branchId,
            );

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
        userRole?: string;
    }): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.ALL_USERS(
                scope?.orgId,
                scope?.branchId,
            );

            try {
                const cachedUsers =
                    await this.cacheManager.get<User[]>(cacheKey);

                if (cachedUsers) {
                    this.logger.debug(`Cache hit for all users: ${cacheKey}`);
                    return cachedUsers;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // Build query with proper scoping
            const queryBuilder = this.userRepository
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.orgId', 'org')
                .leftJoinAndSelect('user.branchId', 'branch')
                .leftJoinAndSelect('user.avatar', 'avatar');

            // Include deleted users only for brandon/admin roles
            if (this.shouldIncludeDeleted(scope?.userRole)) {
                queryBuilder.where('user.status IN (:...statuses)', {
                    statuses: [UserStatus.ACTIVE, UserStatus.DELETED],
                });
            } else {
                queryBuilder.where('user.status = :status', {
                    status: UserStatus.ACTIVE,
                });
            }

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
            const usersWithVariants = await Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    usersWithVariants,
                    this.CACHE_TTL.USERS_ALL * 1000,
                );
                this.logger.debug(`Cache set for all users: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return usersWithVariants;
        });
    }

    /**
     * Find users with filters and pagination - compliant with module standards
     */
    async findAllWithFilters(
        filters: UserFilterDto,
        scope?: {
            orgId?: string;
            branchId?: string;
            userId: string;
            userRole?: string;
        },
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

            // Apply where conditions properly - include deleted users for brandon/admin
            if (this.shouldIncludeDeleted(scope?.userRole)) {
                // For brandon/admin, use the provided status or show all statuses including deleted
                if (filters.status) {
                    queryBuilder.where('user.status = :status', {
                        status: filters.status,
                    });
                } else {
                    queryBuilder.where('user.status IN (:...statuses)', {
                        statuses: [UserStatus.ACTIVE, UserStatus.DELETED],
                    });
                }
            } else {
                // For regular users, only show active users
                queryBuilder.where('user.status = :status', {
                    status: filters.status || UserStatus.ACTIVE,
                });
            }

            // Apply org/branch scoping - scope takes precedence over filter
            if (scope?.orgId || filters.orgId) {
                queryBuilder.andWhere('user.orgId = :orgId', {
                    orgId: scope?.orgId || filters.orgId,
                });
            }

            // 🆕 Enhanced branch scoping logic for cross-branch access
            // Only apply branch filter if explicitly provided in filters
            // This allows admins/owners to see users across all branches in their org
            if (filters.branchId) {
                queryBuilder.andWhere('user.branchId = :branchId', {
                    branchId: filters.branchId,
                });
            }
            // Note: scope.branchId is intentionally not used here to enable cross-branch access
            // Only filter-based branchId is respected for explicit branch filtering

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
            // Check cache first - note: using global scope for findOne
            const cacheKey = this.CACHE_KEYS.USER_BY_ID(id);

            try {
                const cachedUser = await this.cacheManager.get<User>(cacheKey);

                if (cachedUser) {
                    this.logger.debug(`Cache hit for user: ${cacheKey}`);
                    return cachedUser;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // If not in cache, fetch from database
            const user = await this.userRepository.findOne({
                where: { id, status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                const userWithVariants = await this.loadAvatarVariants(user);
                // Cache the result with error handling
                try {
                    await this.cacheManager.set(
                        cacheKey,
                        userWithVariants,
                        this.CACHE_TTL.USER * 1000,
                    );
                    this.logger.debug(`Cache set for user: ${cacheKey}`);
                } catch (error) {
                    this.logger.warn(
                        `Cache set failed for key ${cacheKey}:`,
                        error,
                    );
                }
                return userWithVariants;
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
            // Check cache first - using global scope for full details
            const cacheKey = this.CACHE_KEYS.USER_BY_EMAIL(email);

            try {
                const cachedUser = await this.cacheManager.get<User>(cacheKey);

                if (cachedUser) {
                    this.logger.debug(
                        `Cache hit for user by email: ${cacheKey}`,
                    );
                    return cachedUser;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // If not in cache, fetch from database
            const user = await this.userRepository.findOne({
                where: { email },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                const userWithVariants = await this.loadAvatarVariants(user);
                // Cache the result with error handling
                try {
                    await this.cacheManager.set(
                        cacheKey,
                        userWithVariants,
                        this.CACHE_TTL.USER * 1000,
                    );
                    this.logger.debug(
                        `Cache set for user by email: ${cacheKey}`,
                    );
                } catch (error) {
                    this.logger.warn(
                        `Cache set failed for key ${cacheKey}:`,
                        error,
                    );
                }
                return userWithVariants;
            }
            return user;
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USER_BY_ID(id);

            try {
                const cachedUser = await this.cacheManager.get<User>(cacheKey);

                if (cachedUser) {
                    this.logger.debug(`Cache hit for user by ID: ${cacheKey}`);
                    return cachedUser;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // If not in cache, fetch from database
            const user = await this.userRepository.findOne({
                where: { id },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                const userWithVariants = await this.loadAvatarVariants(user);
                // Cache the result with error handling
                try {
                    await this.cacheManager.set(
                        cacheKey,
                        userWithVariants,
                        this.CACHE_TTL.USER * 1000, // Convert to milliseconds
                    );
                    this.logger.debug(`Cache set for user by ID: ${cacheKey}`);
                } catch (error) {
                    this.logger.warn(
                        `Cache set failed for key ${cacheKey}:`,
                        error,
                    );
                }
                return userWithVariants;
            }
            return user;
        });
    }

    async findByOrganization(orgId: string): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USERS_BY_ORG(orgId, '');

            try {
                const cachedUsers =
                    await this.cacheManager.get<User[]>(cacheKey);

                if (cachedUsers) {
                    this.logger.debug(
                        `Cache hit for users by org: ${cacheKey}`,
                    );
                    return cachedUsers;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
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

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    usersWithVariants,
                    this.CACHE_TTL.USER_LIST * 1000,
                );
                this.logger.debug(`Cache set for users by org: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return usersWithVariants;
        });
    }

    async findByBranch(branchId: string): Promise<User[]> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USERS_BY_BRANCH(branchId, '');

            try {
                const cachedUsers =
                    await this.cacheManager.get<User[]>(cacheKey);

                if (cachedUsers) {
                    this.logger.debug(
                        `Cache hit for users by branch: ${cacheKey}`,
                    );
                    return cachedUsers;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
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

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    usersWithVariants,
                    this.CACHE_TTL.USER_LIST * 1000,
                );
                this.logger.debug(`Cache set for users by branch: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return usersWithVariants;
        });
    }

    async update(
        id: string,
        updateUserDto: UpdateUserDto,
        scope?: {
            orgId?: string;
            branchId?: string;
            userId: string;
            userRole?: string;
        },
    ): Promise<StandardOperationResponse> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { avatar, branchId, ...updateData } = updateUserDto;
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

        // Get updated user data for comprehensive cache invalidation
        const updatedUser = await this.userRepository.findOne({
            where: { id },
            relations: ['orgId', 'branchId', 'avatar'],
        });

        this.logger.log(`🔄 User Update - Starting cache invalidation:`, {
            userId: id,
            scopeOrgId: scope?.orgId,
            scopeBranchId: scope?.branchId,
            existingUserOrgId: existingUser.orgId?.id,
            existingUserBranchId: existingUser.branchId?.id,
            updatedUserOrgId: updatedUser?.orgId?.id,
            updatedUserBranchId: updatedUser?.branchId?.id,
            updateFields: Object.keys(updateData),
        });

        // Check cache state before invalidation
        this.logger.log(`📋 BEFORE Cache Invalidation:`);
        await this.checkUserCacheState(
            id,
            existingUser.email,
            scope?.orgId || existingUser.orgId?.id,
            scope?.branchId || existingUser.branchId?.id,
            existingUser.avatar?.id,
        );

        // Comprehensive cache invalidation with org/branch scope
        await this.invalidateAllUserCaches(
            id,
            updatedUser || existingUser,
            scope?.orgId || existingUser.orgId?.id,
            scope?.branchId || existingUser.branchId?.id,
        );

        // Check cache state after invalidation
        this.logger.log(`📋 AFTER Cache Invalidation:`);
        await this.checkUserCacheState(
            id,
            (updatedUser || existingUser).email,
            scope?.orgId || existingUser.orgId?.id,
            scope?.branchId || existingUser.branchId?.id,
            (updatedUser || existingUser).avatar?.id,
        );

        this.logger.log(
            `✅ User Update - Cache invalidation completed for user: ${id}`,
        );

        return {
            message: 'User updated successfully',
            status: 'success',
            code: 200,
        };
    }

    async remove(id: string): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // Get user first for cache invalidation
            const user = await this.userRepository.findOne({
                where: { id },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${id} not found`);
            }

            // Delete the user
            const result = await this.userRepository.delete(id);
            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${id} not found`);
            }

            // Comprehensive cache invalidation with org/branch scope for deleted user
            await this.invalidateAllUserCaches(
                id,
                user,
                user.orgId?.id,
                user.branchId?.id,
            );

            return {
                message: 'User deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    async updateProfile(
        id: string,
        updateData: Partial<UpdateUserDto>,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { avatar, branchId, ...profileData } = updateData;
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

                // Get updated user data for comprehensive cache invalidation
                const updatedUser = await this.userRepository.findOne({
                    where: { id },
                    relations: ['orgId', 'branchId', 'avatar'],
                });

                // Comprehensive cache invalidation with org/branch scope
                await this.invalidateAllUserCaches(
                    id,
                    updatedUser || user,
                    user.orgId?.id,
                    user.branchId?.id,
                );

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
        });
    }

    async changePassword(
        id: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
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
            const hashedNewPassword = await bcrypt.hash(
                newPassword,
                saltRounds,
            );

            // Update password
            await this.userRepository.update(id, {
                password: hashedNewPassword,
            });

            // Invalidate user cache after password change (user data shouldn't change much, so simple invalidation)
            await this.invalidateUserCache(
                id,
                user.email,
                user.orgId?.id,
                user.branchId?.id,
                user.avatar?.id,
            );

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
        });
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
            // Get user first for cache invalidation
            const existingUser = await this.findOne(userId);
            if (!existingUser) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

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

            // Comprehensive cache invalidation for both old and new org/branch scopes
            await this.invalidateAllUserCaches(
                userId,
                existingUser,
                existingUser.orgId?.id,
                existingUser.branchId?.id,
            );
            await this.invalidateAllUserCaches(
                userId,
                user,
                user.orgId?.id,
                user.branchId?.id,
            );

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
            // Get user first for cache invalidation
            const user = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            const result = await this.userRepository.update(userId, {
                password: hashedPassword,
            });

            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            // Invalidate user cache after password update
            await this.invalidateUserCache(
                userId,
                user.email,
                user.orgId?.id,
                user.branchId?.id,
                user.avatar?.id,
            );

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
            // Get user first for cache invalidation
            const user = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            const result = await this.userRepository.update(userId, {
                emailVerified: true,
            });

            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            // Invalidate user cache after email verification
            await this.invalidateUserCache(
                userId,
                user.email,
                user.orgId?.id,
                user.branchId?.id,
                user.avatar?.id,
            );

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

            // Comprehensive cache invalidation with org/branch scope for deleted user
            await this.invalidateAllUserCaches(
                userId,
                user,
                user.orgId?.id,
                user.branchId?.id,
            );

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

            // Comprehensive cache invalidation with org/branch scope for restored user
            await this.invalidateAllUserCaches(
                userId,
                user,
                user.orgId?.id,
                user.branchId?.id,
            );

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
