import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { isEmail } from 'class-validator';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { Branch } from '../branch/entities/branch.entity';
import { CommunicationsService } from '../communications/communications.service';
import { CourseMaterial } from '../course-materials/entities/course-material.entity';
import { Course } from '../course/entities/course.entity';
import { StandardResponse } from '../common/types/standard-response.type';
import { Organization } from '../org/entities/org.entity';
import { Test } from '../test/entities/test.entity';
import { UserRole } from '../user/entities/user.entity';
import { CreateAssistanceRequestDto } from './dto/create-assistance-request.dto';
import {
    AssistanceContextType,
    AssistanceEmailStatus,
    AssistanceRequest,
    AssistanceWhatsappStatus,
} from './entities/assistance-request.entity';
import { WatiAssistanceClient } from './wati-assistance.client';

interface ResolvedTrainingContext {
    readonly courseId: number | null;
    readonly courseTitle: string;
    readonly materialId: number | null;
    readonly materialTitle: string | null;
    readonly testId: number | null;
    readonly testTitle: string | null;
}

interface AssistanceRequestResult {
    readonly requestId: string;
}

/**
 * Records a learner help request, emails ASSISTANCE_EMAIL_NOTIFY, then sends
 * the approved Wati template when that integration is configured.
 */
@Injectable()
export class AssistanceService {
    private readonly logger = new Logger(AssistanceService.name);

    constructor(
        @InjectRepository(AssistanceRequest)
        private readonly assistanceRepository: Repository<AssistanceRequest>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(CourseMaterial)
        private readonly materialRepository: Repository<CourseMaterial>,
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(Branch)
        private readonly branchRepository: Repository<Branch>,
        private readonly communicationsService: CommunicationsService,
        private readonly configService: ConfigService,
        private readonly watiAssistanceClient: WatiAssistanceClient,
    ) {}

    /**
     * Creates an assistance request for a learner and sends the support email.
     * Success is returned only after the email is accepted by the mail queue.
     */
    async createRequest(
        caller: AuthenticatedUser,
        dto: CreateAssistanceRequestDto,
    ): Promise<StandardResponse<AssistanceRequestResult>> {
        this.assertLearner(caller);
        const orgId = this.requireOrgId(caller);
        const context = await this.resolveContext(dto, orgId);
        const organization = await this.requireOrganization(orgId);
        const branch = await this.loadBranch(caller.branchId);
        const requestedAt = new Date();
        const recipientEmail = this.readNotifyAddress();

        const request = await this.assistanceRepository.save(
            this.assistanceRepository.create({
                userId: caller.id,
                orgId,
                branchId: caller.branchId ?? null,
                source: dto.source,
                contextType: dto.contextType,
                courseId: context.courseId,
                materialId: context.materialId,
                testId: context.testId,
                message: dto.message ?? null,
                emailStatus: AssistanceEmailStatus.PENDING,
                whatsappStatus: AssistanceWhatsappStatus.PENDING,
                requestedAt,
            }),
        );

        if (!recipientEmail) {
            return this.failEmail(
                request,
                'Assistance email is not available right now. Please try again later.',
            );
        }

        try {
            const communicationId =
                await this.communicationsService.sendAssistanceRequestEmail({
                    recipientEmail,
                    learnerUserId: caller.id,
                    firstName: caller.firstName,
                    lastName: caller.lastName,
                    learnerEmail: caller.email,
                    organizationId: orgId,
                    organizationName: organization.name,
                    branchId: caller.branchId ?? null,
                    branchName: branch?.name ?? null,
                    source: dto.source,
                    contextType: dto.contextType,
                    courseId: context.courseId,
                    courseTitle: context.courseTitle,
                    materialId: context.materialId,
                    materialTitle: context.materialTitle,
                    testId: context.testId,
                    testTitle: context.testTitle,
                    message: dto.message ?? null,
                    requestedAt: requestedAt.toISOString(),
                    contextUrl: this.buildContextUrl(context),
                });

            request.emailStatus = AssistanceEmailStatus.SENT;
            request.communicationId = communicationId;
            request.whatsappStatus = await this.sendWhatsapp(
                caller,
                context,
                dto.message,
                requestedAt,
            );
            await this.assistanceRepository.save(request);
            this.logDelivery(request);

            return {
                success: true,
                message: 'Assistance request sent',
                data: { requestId: request.id },
            };
        } catch (error) {
            this.logger.error(
                `Assistance email failed request=${request.id} user=${caller.id} org=${orgId}`,
                error instanceof Error ? error.stack : String(error),
            );
            return this.failEmail(
                request,
                'We could not send your help request. Please try again.',
            );
        }
    }

    /**
     * WhatsApp is best-effort. A Wati failure still leaves the email request successful.
     */
    private async sendWhatsapp(
        caller: AuthenticatedUser,
        context: ResolvedTrainingContext,
        message: string | undefined,
        requestedAt: Date,
    ): Promise<AssistanceWhatsappStatus> {
        const learnerName = `${caller.firstName} ${caller.lastName}`.trim();
        try {
            return await this.watiAssistanceClient.send({
                learnerLabel: `${learnerName} (${caller.email})`,
                courseTitle: context.courseTitle || 'Unknown course',
                contextSummary: this.buildContextSummary(context),
                requestedAt: this.formatWhatsappDate(requestedAt),
                message: message?.trim() || 'No message',
            });
        } catch (error) {
            this.logger.error(
                `Wati send threw request user=${caller.id}`,
                error instanceof Error ? error.message : 'unknown error',
            );
            return AssistanceWhatsappStatus.FAILED;
        }
    }

    /** Calendar date in UTC, for example `2026-10-05`. */
    private formatWhatsappDate(requestedAt: Date): string {
        const [date] = requestedAt.toISOString().split('T');
        return date;
    }

    private buildContextSummary(context: ResolvedTrainingContext): string {
        if (context.testTitle) {
            return `Test: ${context.testTitle}`;
        }
        if (context.materialTitle) {
            return `Material: ${context.materialTitle}`;
        }
        return 'Course';
    }

    private assertLearner(caller: AuthenticatedUser): void {
        if (caller.role !== UserRole.USER) {
            throw new ForbiddenException('Only learners can request assistance');
        }
    }

    private requireOrgId(caller: AuthenticatedUser): string {
        if (!caller.orgId) {
            throw new ForbiddenException(
                'Your account is not assigned to an organization',
            );
        }
        return caller.orgId;
    }

    private async requireOrganization(orgId: string): Promise<Organization> {
        const organization = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!organization) {
            throw new ForbiddenException(
                'Your account is not assigned to an organization',
            );
        }
        return organization;
    }

    private async loadBranch(branchId?: string): Promise<Branch | null> {
        if (!branchId) {
            return null;
        }
        return this.branchRepository.findOne({ where: { id: branchId } });
    }

    private async resolveContext(
        dto: CreateAssistanceRequestDto,
        orgId: string,
    ): Promise<ResolvedTrainingContext> {
        if (dto.contextType === AssistanceContextType.TEST) {
            return this.resolveTestContext(dto, orgId);
        }
        return this.resolveCourseContext(dto, orgId);
    }

    private async resolveCourseContext(
        dto: CreateAssistanceRequestDto,
        orgId: string,
    ): Promise<ResolvedTrainingContext> {
        if (dto.courseId == null) {
            throw new BadRequestException('A course request requires courseId');
        }

        const course = await this.requireCourseInOrg(dto.courseId, orgId);
        const material = await this.resolveMaterial(dto.materialId, course.courseId);

        return {
            courseId: course.courseId,
            courseTitle: course.title,
            materialId: material?.materialId ?? null,
            materialTitle: material?.title ?? null,
            testId: null,
            testTitle: null,
        };
    }

    private async resolveTestContext(
        dto: CreateAssistanceRequestDto,
        orgId: string,
    ): Promise<ResolvedTrainingContext> {
        if (dto.testId == null) {
            throw new BadRequestException('A test request requires testId');
        }

        const test = await this.testRepository.findOne({
            where: { testId: dto.testId },
            relations: { orgId: true, course: true },
        });
        if (!test || test.orgId?.id !== orgId) {
            throw new ForbiddenException(
                'You cannot request assistance for this training',
            );
        }
        if (dto.courseId != null && dto.courseId !== test.courseId) {
            throw new BadRequestException(
                'The course does not match this test',
            );
        }

        return {
            courseId: test.courseId,
            courseTitle: test.course?.title ?? 'Unknown course',
            materialId: null,
            materialTitle: null,
            testId: test.testId,
            testTitle: test.title,
        };
    }

    private async requireCourseInOrg(
        courseId: number,
        orgId: string,
    ): Promise<Course> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
            relations: { orgId: true },
        });
        if (!course || course.orgId?.id !== orgId) {
            throw new ForbiddenException(
                'You cannot request assistance for this training',
            );
        }
        return course;
    }

    private async resolveMaterial(
        materialId: number | undefined,
        courseId: number,
    ): Promise<CourseMaterial | null> {
        if (materialId == null) {
            return null;
        }

        const material = await this.materialRepository.findOne({
            where: { materialId },
        });
        if (!material || material.courseId !== courseId) {
            throw new BadRequestException(
                'The material does not belong to this course',
            );
        }
        return material;
    }

    private readNotifyAddress(): string | null {
        const configured = this.configService
            .get<string>('ASSISTANCE_EMAIL_NOTIFY')
            ?.trim();
        if (!configured || !isEmail(configured)) {
            return null;
        }
        return configured;
    }

    private buildContextUrl(context: ResolvedTrainingContext): string | null {
        const clientUrl = this.configService.get<string>('CLIENT_URL')?.trim();
        if (!clientUrl) {
            return null;
        }

        const base = clientUrl.replace(/\/$/, '');
        if (context.testId != null) {
            return `${base}/test/${context.testId}`;
        }
        if (context.courseId != null) {
            return `${base}/course/${context.courseId}`;
        }
        return null;
    }

    private async failEmail(
        request: AssistanceRequest,
        message: string,
    ): Promise<never> {
        request.emailStatus = AssistanceEmailStatus.FAILED;
        request.whatsappStatus = AssistanceWhatsappStatus.SKIPPED;
        await this.assistanceRepository.save(request);
        this.logDelivery(request);
        throw new ServiceUnavailableException(message);
    }

    private logDelivery(request: AssistanceRequest): void {
        this.logger.log(
            `Assistance request=${request.id} user=${request.userId} org=${request.orgId} email=${request.emailStatus} whatsapp=${request.whatsappStatus}`,
        );
    }
}
