import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
    constructor(
        @InjectRepository(Branch)
        private readonly branchRepository: Repository<Branch>,
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

    async findAll(): Promise<Branch[]> {
        return this.retryOperation(async () => {
            return await this.branchRepository.find({
                relations: ['organization'],
                order: { createdAt: 'DESC' },
            });
        });
    }

    async findOne(id: string): Promise<Branch | null> {
        return this.retryOperation(async () => {
            return await this.branchRepository.findOne({
                where: { id },
                relations: ['organization'],
            });
        });
    }

    async findById(id: string): Promise<Branch> {
        const branch = await this.findOne(id);
        if (!branch) {
            throw new NotFoundException(`Branch with ID ${id} not found`);
        }
        return branch;
    }

    async update(
        id: string,
        updateBranchDto: UpdateBranchDto,
    ): Promise<Branch> {
        return this.retryOperation(async () => {
            await this.findById(id); // Verify branch exists
            await this.branchRepository.update(id, updateBranchDto);
            return await this.findById(id);
        });
    }

    async remove(id: string): Promise<void> {
        return this.retryOperation(async () => {
            const branch = await this.findById(id);
            await this.branchRepository.remove(branch);
        });
    }

    // Additional utility methods
    async findByOrganization(organizationId: string): Promise<Branch[]> {
        return this.retryOperation(async () => {
            return await this.branchRepository.find({
                where: { organization: { id: organizationId } },
                relations: ['organization'],
                order: { createdAt: 'DESC' },
            });
        });
    }

    async countByOrganization(organizationId: string): Promise<number> {
        return this.retryOperation(async () => {
            return await this.branchRepository.count({
                where: { organization: { id: organizationId } },
            });
        });
    }

    async findActiveByOrganization(organizationId: string): Promise<Branch[]> {
        return this.retryOperation(async () => {
            return await this.branchRepository.find({
                where: {
                    organization: { id: organizationId },
                    isActive: true,
                },
                relations: ['organization'],
                order: { createdAt: 'DESC' },
            });
        });
    }
}
