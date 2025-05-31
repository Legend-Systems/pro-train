import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(MediaFile)
        private readonly mediaRepository: Repository<MediaFile>,
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
                    console.log(
                        `Database connection error on attempt ${attempt}, retrying in ${delay}ms...`,
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
        throw new Error('Max retries exceeded');
    }

    async create(createUserDto: CreateUserDto): Promise<User> {
        return this.retryOperation(async () => {
            const { avatar, ...userData } = createUserDto;
            const userToCreate: Partial<User> = { ...userData };

            // Convert avatar ID to MediaFile reference if provided
            if (avatar) {
                userToCreate.avatar = { id: avatar } as MediaFile;
            }

            const user = this.userRepository.create(userToCreate);
            const savedUser = await this.userRepository.save(user);

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

            return savedUser;
        });
    }

    /**
     * Load avatar variants for a user
     */
    private async loadAvatarVariants(user: User): Promise<User> {
        if (user.avatar?.id) {
            try {
                const variants = await this.mediaRepository.find({
                    where: { originalFileId: user.avatar.id, isActive: true },
                    order: { variant: 'ASC' },
                });

                if (variants.length > 0) {
                    user.avatar.variants = variants;
                }
            } catch (error) {
                // If loading variants fails, continue without them
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
            const user = await this.userRepository.findOne({
                where: { email, status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            if (user) {
                return this.loadAvatarVariants(user);
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

    async findByOrganization(orgId: string): Promise<User[]> {
        return this.retryOperation(async () => {
            const users = await this.userRepository.find({
                where: { orgId: { id: orgId } },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            return Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );
        });
    }

    async findByBranch(branchId: string): Promise<User[]> {
        return this.retryOperation(async () => {
            const users = await this.userRepository.find({
                where: { branchId: { id: branchId } },
                relations: ['orgId', 'branchId', 'avatar'],
            });

            // Load avatar variants for all users
            return Promise.all(
                users.map(user => this.loadAvatarVariants(user)),
            );
        });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const { avatar, ...updateData } = updateUserDto;
        const dataToUpdate: Partial<User> = { ...updateData };

        // Convert avatar ID to MediaFile reference if provided
        if (avatar !== undefined) {
            dataToUpdate.avatar = avatar
                ? ({ id: avatar } as MediaFile)
                : undefined;
        }

        await this.userRepository.update(id, dataToUpdate);
        const user = await this.findOne(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        return user;
    }

    async remove(id: string): Promise<void> {
        const result = await this.userRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
    }

    async updateProfile(
        id: string,
        updateData: Partial<UpdateUserDto>,
    ): Promise<User> {
        const { avatar, ...profileData } = updateData;
        const dataToUpdate: Partial<User> = { ...profileData };

        // Convert avatar ID to MediaFile reference if provided
        if (avatar !== undefined) {
            dataToUpdate.avatar = avatar
                ? ({ id: avatar } as MediaFile)
                : undefined;
        }

        await this.userRepository.update(id, dataToUpdate);
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

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

        return user;
    }

    async changePassword(
        id: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<boolean> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            user.password,
        );
        if (!isCurrentPasswordValid) {
            return false;
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await this.userRepository.update(id, { password: hashedNewPassword });

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

        return true;
    }

    /**
     * Assign organization and branch to a user
     */
    async assignOrgAndBranch(
        userId: string,
        orgId?: string,
        branchId?: string,
    ): Promise<User> {
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

            return user;
        });
    }

    /**
     * Update user password directly (for password reset)
     */
    async updatePassword(
        userId: string,
        hashedPassword: string,
    ): Promise<void> {
        return this.retryOperation(async () => {
            const result = await this.userRepository.update(userId, {
                password: hashedPassword,
            });

            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }
        });
    }

    /**
     * Mark user email as verified
     */
    async verifyEmail(userId: string): Promise<void> {
        return this.retryOperation(async () => {
            const result = await this.userRepository.update(userId, {
                emailVerified: true,
            });

            if (result.affected === 0) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }
        });
    }
}
