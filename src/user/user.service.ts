import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserStatus } from './entities/user.entity';
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
            const user = this.userRepository.create(createUserDto);
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
                    savedUser.avatar,
                ),
            );

            return savedUser;
        });
    }

    async findAll(): Promise<User[]> {
        return this.retryOperation(async () => {
            return await this.userRepository.find({
                where: { status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async findOne(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({
                where: { id, status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({
                where: { email, status: UserStatus.ACTIVE },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async findByEmailWithFullDetails(email: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({
                where: { email },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({
                where: { id },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async findByOrganization(orgId: string): Promise<User[]> {
        return this.retryOperation(async () => {
            return await this.userRepository.find({
                where: { orgId: { id: orgId } },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async findByBranch(branchId: string): Promise<User[]> {
        return this.retryOperation(async () => {
            return await this.userRepository.find({
                where: { branchId: { id: branchId } },
                relations: ['orgId', 'branchId'],
            });
        });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        await this.userRepository.update(id, updateUserDto);
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
        await this.userRepository.update(id, updateData);
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
                user.avatar,
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
                    user.avatar,
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
