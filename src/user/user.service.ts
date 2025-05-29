import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
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
            return await this.userRepository.save(user);
        });
    }

    async findAll(): Promise<User[]> {
        return this.retryOperation(async () => {
            return await this.userRepository.find();
        });
    }

    async findOne(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({ where: { id } });
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({ where: { email } });
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({ where: { id } });
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
        return true;
    }
}
