import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Organization } from './entities/org.entity';
import { Branch } from '../branch/entities/branch.entity';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { CreateBranchDto } from '../branch/dto/create-branch.dto';
import { UpdateBranchDto } from '../branch/dto/update-branch.dto';
import { OrganizationCreatedEvent, BranchCreatedEvent } from '../common/events';
import { StandardResponse } from '../common/types';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

@Injectable()
export class OrgService {
    constructor(
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(Branch)
        private readonly branchRepository: Repository<Branch>,
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

    // Organization CRUD operations
    async createOrganization(
        createOrgDto: CreateOrgDto,
    ): Promise<StandardResponse<Organization>> {
        const organization = await this.retryOperation(async () => {
            // Check if organization name already exists
            const existingOrg = await this.organizationRepository.findOne({
                where: { name: createOrgDto.name },
            });

            if (existingOrg) {
                throw new ConflictException(
                    `Organization with name "${createOrgDto.name}" already exists`,
                );
            }

            const organization =
                this.organizationRepository.create(createOrgDto);
            const savedOrganization =
                await this.organizationRepository.save(organization);

            // Emit organization created event
            this.eventEmitter.emit(
                'organization.created',
                new OrganizationCreatedEvent(
                    savedOrganization.id,
                    savedOrganization.name,
                    savedOrganization.email || '',
                    savedOrganization.logoUrl,
                    savedOrganization.website,
                ),
            );

            return savedOrganization;
        });

        return {
            success: true,
            message: 'Organization created successfully',
            data: organization,
        };
    }

    async findAllOrganizations(): Promise<Organization[]> {
        return this.retryOperation(async () => {
            return await this.organizationRepository.find({
                relations: ['branches'],
                order: { createdAt: 'DESC' },
            });
        });
    }

    // Scoped version - returns only user's organization
    async findAllOrganizationsScoped(
        scope: OrgBranchScope,
    ): Promise<Organization[]> {
        return this.retryOperation(async () => {
            if (!scope.orgId) {
                return []; // User not assigned to any organization
            }

            const organization = await this.organizationRepository.find({
                where: { id: scope.orgId },
                relations: ['branches'],
                order: { createdAt: 'DESC' },
            });

            return organization;
        });
    }

    async findOrganizationById(id: string): Promise<Organization> {
        const organization = await this.retryOperation(async () => {
            return await this.organizationRepository.findOne({
                where: { id },
                relations: ['branches'],
            });
        });

        if (!organization) {
            throw new NotFoundException(`Organization with ID ${id} not found`);
        }

        return organization;
    }

    // Scoped version - validates user has access to the organization
    async findOrganizationByIdScoped(
        id: string,
        scope: OrgBranchScope,
    ): Promise<Organization> {
        const organization = await this.findOrganizationById(id);

        // Validate user has access to this organization
        if (!scope.orgId || scope.orgId !== id) {
            throw new ForbiddenException('Access denied to this organization');
        }

        return organization;
    }

    async updateOrganization(
        id: string,
        updateOrgDto: UpdateOrgDto,
    ): Promise<StandardResponse<Organization>> {
        const organization = await this.retryOperation(async () => {
            // Check if organization exists
            const organization = await this.findOrganizationById(id);

            // Check if name is being updated and if it conflicts
            if (updateOrgDto.name && updateOrgDto.name !== organization.name) {
                const existingOrg = await this.organizationRepository.findOne({
                    where: { name: updateOrgDto.name },
                });

                if (existingOrg) {
                    throw new ConflictException(
                        `Organization with name "${updateOrgDto.name}" already exists`,
                    );
                }
            }

            await this.organizationRepository.update(id, updateOrgDto);
            return await this.findOrganizationById(id);
        });

        return {
            success: true,
            message: 'Organization updated successfully',
            data: organization,
        };
    }

    async deleteOrganization(id: string): Promise<StandardResponse<null>> {
        await this.retryOperation(async () => {
            const organization = await this.findOrganizationById(id);
            await this.organizationRepository.remove(organization);
        });

        return {
            success: true,
            message: 'Organization deleted successfully',
            data: null,
        };
    }

    // Branch CRUD operations
    async createBranch(
        organizationId: string,
        createBranchDto: CreateBranchDto,
    ): Promise<StandardResponse<Branch>> {
        const branch = await this.retryOperation(async () => {
            const organization =
                await this.findOrganizationById(organizationId);

            const branch = this.branchRepository.create({
                ...createBranchDto,
                organization,
            });

            const savedBranch = await this.branchRepository.save(branch);

            // Emit branch created event
            this.eventEmitter.emit(
                'branch.created',
                new BranchCreatedEvent(
                    savedBranch.id,
                    savedBranch.name,
                    savedBranch.email || '',
                    organization.id,
                    organization.name,
                    savedBranch.address,
                    savedBranch.contactNumber,
                    savedBranch.managerName,
                ),
            );

            return savedBranch;
        });

        return {
            success: true,
            message: 'Branch created successfully',
            data: branch,
        };
    }

    async findAllBranches(organizationId: string): Promise<Branch[]> {
        return this.retryOperation(async () => {
            // Verify organization exists
            await this.findOrganizationById(organizationId);

            return await this.branchRepository.find({
                where: { organization: { id: organizationId } },
                relations: ['organization'],
                order: { createdAt: 'DESC' },
            });
        });
    }

    // Scoped version - returns only branches user has access to
    async findAllBranchesScoped(scope: OrgBranchScope): Promise<Branch[]> {
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

    async findBranchById(
        organizationId: string,
        branchId: string,
    ): Promise<Branch> {
        const branch = await this.retryOperation(async () => {
            return await this.branchRepository.findOne({
                where: { id: branchId, organization: { id: organizationId } },
                relations: ['organization'],
            });
        });

        if (!branch) {
            throw new NotFoundException(
                `Branch with ID ${branchId} not found in organization ${organizationId}`,
            );
        }

        return branch;
    }

    // Scoped version - validates user has access to the branch
    async findBranchByIdScoped(
        organizationId: string,
        branchId: string,
        scope: OrgBranchScope,
    ): Promise<Branch> {
        const branch = await this.findBranchById(organizationId, branchId);

        // Validate user has access to this organization
        if (!scope.orgId || scope.orgId !== organizationId) {
            throw new ForbiddenException('Access denied to this organization');
        }

        // If user has a specific branch, validate they can access this branch
        // UNLESS they have elevated permissions (BRANDON, OWNER, or ADMIN) within the same org
        if (scope.branchId && scope.branchId !== branchId) {
            const hasElevatedPermissions =
                scope.userRole === 'brandon' ||
                scope.userRole === 'admin' ||
                scope.userRole === 'owner';

            if (!hasElevatedPermissions) {
                throw new ForbiddenException('Access denied to this branch');
            }
        }

        return branch;
    }

    async updateBranch(
        organizationId: string,
        branchId: string,
        updateBranchDto: UpdateBranchDto,
    ): Promise<StandardResponse<Branch>> {
        const branch = await this.retryOperation(async () => {
            await this.findBranchById(organizationId, branchId);
            await this.branchRepository.update(branchId, updateBranchDto);
            return await this.findBranchById(organizationId, branchId);
        });

        return {
            success: true,
            message: 'Branch updated successfully',
            data: branch,
        };
    }

    async deleteBranch(
        organizationId: string,
        branchId: string,
    ): Promise<StandardResponse<null>> {
        await this.retryOperation(async () => {
            const branch = await this.findBranchById(organizationId, branchId);
            await this.branchRepository.remove(branch);
        });

        return {
            success: true,
            message: 'Branch deleted successfully',
            data: null,
        };
    }

    // Additional utility methods
    async findOrganizationByName(name: string): Promise<Organization | null> {
        return this.retryOperation(async () => {
            return await this.organizationRepository.findOne({
                where: { name },
                relations: ['branches'],
            });
        });
    }

    async getOrganizationStats(id: string) {
        return this.retryOperation(async () => {
            const organization = await this.findOrganizationById(id);
            const totalBranches = await this.branchRepository.count({
                where: { organization: { id } },
            });
            const activeBranches = await this.branchRepository.count({
                where: { organization: { id }, isActive: true },
            });

            return {
                organization,
                stats: {
                    totalBranches,
                    activeBranches,
                    inactiveBranches: totalBranches - activeBranches,
                },
            };
        });
    }
}
