import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { StandardResponse } from '../common/types';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

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

    // Scoped version - returns only branches user has access to
    async findAllScoped(scope: OrgBranchScope): Promise<Branch[]> {
        return this.retryOperation(async () => {
            if (!scope.orgId) {
                return []; // User not assigned to any organization
            }

            // If user has branchId, return only their branch
            if (scope.branchId) {
                const branch = await this.branchRepository.find({
                    where: {
                        id: scope.branchId,
                        organization: { id: scope.orgId },
                    },
                    relations: ['organization'],
                    order: { createdAt: 'DESC' },
                });
                return branch;
            }

            // Otherwise, return all branches in their organization
            return await this.branchRepository.find({
                where: { organization: { id: scope.orgId } },
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

    // Scoped version - validates user has access to the branch
    async findByIdScoped(id: string, scope: OrgBranchScope): Promise<Branch> {
        const branch = await this.findById(id);

        // Validate user has access to this organization
        if (!scope.orgId || scope.orgId !== branch.organization.id) {
            throw new ForbiddenException('Access denied to this branch');
        }

        // If user has a specific branch, validate they can access this branch
        if (scope.branchId && scope.branchId !== id) {
            throw new ForbiddenException('Access denied to this branch');
        }

        return branch;
    }

    async update(
        id: string,
        updateBranchDto: UpdateBranchDto,
    ): Promise<StandardResponse<Branch>> {
        const branch = await this.retryOperation(async () => {
            await this.findById(id); // Verify branch exists
            await this.branchRepository.update(id, updateBranchDto);
            return await this.findById(id);
        });

        return {
            success: true,
            message: 'Branch updated successfully',
            data: branch,
        };
    }

    async remove(id: string): Promise<StandardResponse<null>> {
        await this.retryOperation(async () => {
            const branch = await this.findById(id);
            await this.branchRepository.remove(branch);
        });

        return {
            success: true,
            message: 'Branch deleted successfully',
            data: null,
        };
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
