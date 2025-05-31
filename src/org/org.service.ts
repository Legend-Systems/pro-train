import {
    Injectable,
    NotFoundException,
    ConflictException,
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
    ): Promise<Organization> {
        return this.retryOperation(async () => {
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
    }

    async findAllOrganizations(): Promise<Organization[]> {
        return this.retryOperation(async () => {
            return await this.organizationRepository.find({
                relations: ['branches'],
                order: { createdAt: 'DESC' },
            });
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

    async updateOrganization(
        id: string,
        updateOrgDto: UpdateOrgDto,
    ): Promise<Organization> {
        return this.retryOperation(async () => {
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
    }

    async deleteOrganization(id: string): Promise<void> {
        return this.retryOperation(async () => {
            const organization = await this.findOrganizationById(id);
            await this.organizationRepository.remove(organization);
        });
    }

    // Branch CRUD operations
    async createBranch(
        organizationId: string,
        createBranchDto: CreateBranchDto,
    ): Promise<Branch> {
        return this.retryOperation(async () => {
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

    async updateBranch(
        organizationId: string,
        branchId: string,
        updateBranchDto: UpdateBranchDto,
    ): Promise<Branch> {
        return this.retryOperation(async () => {
            const branch = await this.findBranchById(organizationId, branchId);
            await this.branchRepository.update(branchId, updateBranchDto);
            return await this.findBranchById(organizationId, branchId);
        });
    }

    async deleteBranch(
        organizationId: string,
        branchId: string,
    ): Promise<void> {
        return this.retryOperation(async () => {
            const branch = await this.findBranchById(organizationId, branchId);
            await this.branchRepository.remove(branch);
        });
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
