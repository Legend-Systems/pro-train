import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { StandardOperationResponse } from './dto/common-response.dto';
import { User, UserStatus } from './entities/user.entity';
import { MediaFile } from '../media-manager/entities/media-manager.entity';
import {
    UserCreatedEvent,
    UserProfileUpdatedEvent,
    UserPasswordChangedEvent,
    UserOrgBranchAssignedEvent,
} from '../common/events';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
    // Cache keys
    private readonly CACHE_KEYS = {
        USER_BY_ID: (id: string) => `user:id:${id}`,
        USER_BY_EMAIL: (email: string) => `user:email:${email}`,
        USER_ORG: (orgId: string) => `user:org:${orgId}`,
        USER_BRANCH: (branchId: string) => `user:branch:${branchId}`,
        USER_AVATAR_VARIANTS: (avatarId: number) => `user:avatar:${avatarId}`,
    };

    // Cache TTL in seconds
    private readonly CACHE_TTL = {
        USER: 300, // 5 minutes
        USER_LIST: 180, // 3 minutes
        AVATAR_VARIANTS: 600, // 10 minutes
    };

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(MediaFile)
        private readonly mediaRepository: Repository<MediaFile>,
        private readonly eventEmitter: EventEmitter2,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
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
     * Cache helper methods
     */
    private async invalidateUserCache(
        userId: string,
        email?: string,
    ): Promise<void> {
        const keysToDelete = [this.CACHE_KEYS.USER_BY_ID(userId)];

        if (email) {
            keysToDelete.push(this.CACHE_KEYS.USER_BY_EMAIL(email));
        }

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

    private async invalidateUserListCaches(): Promise<void> {
        // Note: This is a simplified approach. In production, you might want to
        // maintain a list of active org/branch cache keys or use cache tags
        // For now, we'll just clear specific pattern-based keys
        // await this.cacheManager.reset(); // This method might not exist in all cache implementations
    }

    async create(
        createUserDto: CreateUserDto,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const { avatar, ...userData } = createUserDto;
            const userToCreate: Partial<User> = { ...userData };

            // Convert avatar ID to MediaFile reference if provided
            if (avatar) {
                userToCreate.avatar = { id: avatar } as MediaFile;
            }

            const user = this.userRepository.create(userToCreate);
            const savedUser = await this.userRepository.save(user);

            // Invalidate list caches since a new user was created
            await this.invalidateUserListCaches();

            // Emit user created event
            this.eventEmitter.emit(
                'user.created',
                new UserCreatedEvent(
                    savedUser.id,
                    savedUser.email,
                    savedUser.firstName,
                    savedUser.lastName,
                    savedUser.orgId?.id,
                    savedUser.orgId?.name,
                    savedUser.branchId?.id,
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
                // Check cache first for avatar variants
                const cacheKey = this.CACHE_KEYS.USER_AVATAR_VARIANTS(
                    user.avatar.id,
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
                console.warn('Failed to load avatar variants:', error);
            }
        }
        return user;
    }

    async findAll(): Promise<User[]> {
        return this.retryOperation(async () => {
            const users = await this.userRepository.find({
                where: { status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            return Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );
        });
    }

    async findOne(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
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

    async findByEmail(email: string): Promise<User | null> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USER_BY_EMAIL(email);
            const cachedUser = await this.cacheManager.get<User>(cacheKey);

            if (cachedUser) {
                return cachedUser;
            }

            // If not in cache, fetch from database
            const user = await this.userRepository.findOne({
                where: { email, status: UserStatus.ACTIVE },
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
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USER_ORG(orgId);
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
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.USER_BRANCH(branchId);
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

        // Invalidate user cache
        await this.invalidateUserCache(id, existingUser.email);
        await this.invalidateUserListCaches();

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
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
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
                    // TODO: Add assignedBy parameter when authentication context is available
                    undefined,
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
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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
    async softDelete(userId: string): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
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
    async restoreUser(userId: string): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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

    /**
     * Find all users with any status (for admin purposes)
     */
    async findAllWithDeleted(): Promise<User[]> {
        return this.retryOperation(async () => {
            const users = await this.userRepository.find({
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            return Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );
        });
    }

    /**
     * Find user by ID including deleted users (for admin purposes)
     */
    async findByIdWithDeleted(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
            const user = await this.userRepository.findOne({
                where: { id },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                return this.loadAvatarVariants(user);
            }
            return user;
        });
    }
}
