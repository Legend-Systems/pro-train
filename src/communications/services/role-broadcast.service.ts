import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import { OrgService } from '../../org/org.service';
import { Organization } from '../../org/entities/org.entity';
import { User, UserRole, UserStatus } from '../../user/entities/user.entity';
import {
    Communication,
    EmailStatus,
    EmailType,
} from '../entities/communication.entity';
import { SendRoleBroadcastDto } from '../dto/send-role-broadcast.dto';
import { RoleBroadcastResult } from '../interfaces/role-broadcast-result.interface';
import { RoleRecipientCount } from '../interfaces/role-recipient-count.interface';
import { EmailTemplateService } from './email-template.service';
import { EmailSMTPService } from './email-smtp.service';

/** Roles permitted to send a broadcast. */
const BROADCAST_SENDER_ROLES: readonly UserRole[] = [
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.MASTER_ADMIN,
];

/** Hard ceiling so a mis-targeted broadcast cannot flood the SMTP relay. */
const MAX_BROADCAST_RECIPIENTS = 2000;

/** Emails delivered concurrently within a single batch. */
const DELIVERY_BATCH_SIZE = 10;

/** Failed addresses echoed back to the caller; the rest live in the audit log. */
const MAX_REPORTED_FAILURES = 25;

/** Rows persisted per insert statement when writing the audit trail. */
const AUDIT_CHUNK_SIZE = 50;

/** Template used to wrap the administrator's message. */
const BROADCAST_TEMPLATE_NAME = 'custom';

interface BroadcastSender {
    readonly email: string;
    readonly name: string;
}

interface RenderedBroadcast {
    readonly html: string;
    readonly text: string;
}

interface DeliveryOutcome {
    readonly recipient: User;
    readonly rendered: RenderedBroadcast;
    readonly succeeded: boolean;
    readonly error?: string;
}

/**
 * Sends one-time administrative emails to every user holding a selected role.
 *
 * Delivery is synchronous rather than queued so the administrator gets exact
 * sent/failed counts in the HTTP response. Each send is a single, immediate
 * dispatch: nothing is scheduled and nothing is retried on a later run.
 */
@Injectable()
export class RoleBroadcastService {
    private readonly logger = new Logger(RoleBroadcastService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Communication)
        private readonly communicationRepository: Repository<Communication>,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly emailSMTPService: EmailSMTPService,
        private readonly configService: ConfigService,
        private readonly orgService: OrgService,
    ) {}

    /**
     * Counts the contactable users behind each role so the UI can preview reach
     * before an administrator commits to sending.
     */
    async countRecipientsByRole(
        scope: OrgBranchScope,
    ): Promise<RoleRecipientCount[]> {
        this.assertBroadcastAccess(scope);

        const roles = Object.values(UserRole);
        const counts = await Promise.all(
            roles.map(role => this.countRecipientsForRole(role, scope)),
        );

        return roles.map((role, index) => ({
            role,
            recipientCount: counts[index],
        }));
    }

    /**
     * Renders and immediately delivers the broadcast to every active user whose
     * role was selected. Throws when the selection resolves to nobody so the
     * administrator is never told an empty send succeeded.
     */
    async sendRoleBroadcast(
        dto: SendRoleBroadcastDto,
        scope: OrgBranchScope,
    ): Promise<RoleBroadcastResult> {
        this.assertBroadcastAccess(scope);

        const recipients = await this.loadRecipients(dto.recipientRoles, scope);
        this.assertDeliverableAudience(recipients, dto.recipientRoles);

        const sender = await this.resolveSender(scope.orgId);
        const outcomes = await this.deliverToRecipients(dto, recipients, sender);

        await this.persistAuditTrail(dto, outcomes, sender, scope);

        return this.summarise(dto, outcomes);
    }

    /**
     * Defence in depth: the controller already applies `RolesGuard`, but the
     * service refuses non-administrative callers on its own too.
     */
    private assertBroadcastAccess(scope: OrgBranchScope): void {
        const role = scope.userRole as UserRole | undefined;

        if (!role || !BROADCAST_SENDER_ROLES.includes(role)) {
            throw new ForbiddenException(
                'Only administrators can send communications',
            );
        }
    }

    /** Fails loudly when the selected roles match nobody, or match too many. */
    private assertDeliverableAudience(
        recipients: readonly User[],
        roles: readonly UserRole[],
    ): void {
        if (recipients.length === 0) {
            throw new NotFoundException(
                `No active users found for the selected role(s): ${roles.join(', ')}`,
            );
        }

        if (recipients.length > MAX_BROADCAST_RECIPIENTS) {
            throw new BadRequestException(
                `This selection targets ${recipients.length} users, which exceeds the ${MAX_BROADCAST_RECIPIENTS} recipient limit. Narrow the selected roles.`,
            );
        }
    }

    private async countRecipientsForRole(
        role: UserRole,
        scope: OrgBranchScope,
    ): Promise<number> {
        return this.buildRecipientQuery([role], scope).getCount();
    }

    private async loadRecipients(
        roles: readonly UserRole[],
        scope: OrgBranchScope,
    ): Promise<User[]> {
        return this.buildRecipientQuery(roles, scope)
            .select([
                'user.id',
                'user.email',
                'user.firstName',
                'user.lastName',
                'user.role',
            ])
            .getMany();
    }

    /**
     * Restricts the audience to active users inside the caller's organization
     * whose role was explicitly selected. Callers without an organization
     * (master admins operating platform-wide) reach every organization.
     */
    private buildRecipientQuery(
        roles: readonly UserRole[],
        scope: OrgBranchScope,
    ): SelectQueryBuilder<User> {
        const query = this.userRepository
            .createQueryBuilder('user')
            .where('user.role IN (:...roles)', { roles })
            .andWhere('user.status = :status', { status: UserStatus.ACTIVE });

        if (scope.orgId) {
            query.andWhere('user.orgId = :orgId', { orgId: scope.orgId });
        }

        return query;
    }

    /**
     * Prefers the organization's own sender identity so recipients recognise
     * the sender, falling back to the platform address when the organization
     * has no email configured.
     */
    private async resolveSender(orgId?: string): Promise<BroadcastSender> {
        const platformSender: BroadcastSender = {
            email: this.configService.get<string>(
                'EMAIL_FROM_ADDRESS',
                'noreply@trainpro.com',
            ),
            name: this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            ),
        };

        if (!orgId) {
            return platformSender;
        }

        try {
            const organization =
                await this.orgService.findOrganizationById(orgId);

            return organization?.email
                ? { email: organization.email, name: organization.name }
                : platformSender;
        } catch (error) {
            this.logger.warn(
                `Falling back to the platform sender: organization ${orgId} could not be loaded`,
                error,
            );
            return platformSender;
        }
    }

    private async deliverToRecipients(
        dto: SendRoleBroadcastDto,
        recipients: readonly User[],
        sender: BroadcastSender,
    ): Promise<DeliveryOutcome[]> {
        const outcomes: DeliveryOutcome[] = [];

        for (let i = 0; i < recipients.length; i += DELIVERY_BATCH_SIZE) {
            const batch = recipients.slice(i, i + DELIVERY_BATCH_SIZE);
            const settled = await Promise.all(
                batch.map(recipient =>
                    this.deliverToRecipient(dto, recipient, sender),
                ),
            );
            outcomes.push(...settled);
        }

        return outcomes;
    }

    private async deliverToRecipient(
        dto: SendRoleBroadcastDto,
        recipient: User,
        sender: BroadcastSender,
    ): Promise<DeliveryOutcome> {
        const rendered = await this.renderForRecipient(dto, recipient);

        try {
            const result = await this.emailSMTPService.sendEmail(
                {
                    to: recipient.email,
                    subject: dto.subject,
                    html: rendered.html,
                    text: rendered.text,
                },
                0,
                sender,
            );

            return {
                recipient,
                rendered,
                succeeded: result.success,
                error: result.error,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown SMTP error';
            this.logger.error(
                `Broadcast delivery failed for ${recipient.email}: ${message}`,
            );
            return { recipient, rendered, succeeded: false, error: message };
        }
    }

    /**
     * Wraps the administrator's plain-text message in the branded `custom`
     * template. The body is HTML-escaped before line breaks are converted so
     * pasted content can never inject markup into the email.
     */
    private async renderForRecipient(
        dto: SendRoleBroadcastDto,
        recipient: User,
    ): Promise<RenderedBroadcast> {
        const clientUrl = this.configService.get<string>(
            'CLIENT_URL',
            'http://localhost:3000',
        );

        const rendered = await this.emailTemplateService.renderTemplate({
            template: BROADCAST_TEMPLATE_NAME,
            format: 'html',
            data: {
                title: dto.title,
                message: this.toHtmlParagraphs(dto.body),
                recipientName: recipient.firstName,
                recipientEmail: recipient.email,
                companyName: this.configService.get<string>(
                    'APP_NAME',
                    'trainpro Platform',
                ),
                companyUrl: clientUrl,
                supportEmail: this.configService.get<string>(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                unsubscribeUrl: `${clientUrl}/unsubscribe`,
            },
        });

        return {
            html: rendered.html ?? '',
            text: this.toPlainText(dto, recipient),
        };
    }

    /** Plain-text alternative, built directly to avoid template escaping. */
    private toPlainText(dto: SendRoleBroadcastDto, recipient: User): string {
        const supportEmail = this.configService.get<string>(
            'SUPPORT_EMAIL',
            'support@trainpro.com',
        );

        return [
            dto.title,
            '',
            `Hello ${recipient.firstName},`,
            '',
            dto.body,
            '',
            `Need help? Contact us at ${supportEmail}`,
        ].join('\n');
    }

    private toHtmlParagraphs(body: string): string {
        return this.escapeHtml(body).replace(/\r?\n/g, '<br />');
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Writes one communication row per recipient so sends stay auditable. */
    private async persistAuditTrail(
        dto: SendRoleBroadcastDto,
        outcomes: readonly DeliveryOutcome[],
        sender: BroadcastSender,
        scope: OrgBranchScope,
    ): Promise<void> {
        const sentAt = new Date();
        const rows = outcomes.map(outcome =>
            this.communicationRepository.create({
                recipientEmail: outcome.recipient.email,
                recipientName: `${outcome.recipient.firstName} ${outcome.recipient.lastName}`.trim(),
                senderEmail: sender.email,
                senderName: sender.name,
                subject: dto.subject,
                body: outcome.rendered.html,
                plainTextBody: outcome.rendered.text,
                emailType: EmailType.CUSTOM,
                templateUsed: BROADCAST_TEMPLATE_NAME,
                status: outcome.succeeded ? EmailStatus.SENT : EmailStatus.FAILED,
                sentAt: outcome.succeeded ? sentAt : undefined,
                errorMessage: outcome.error,
                orgId: scope.orgId
                    ? ({ id: scope.orgId } as Organization)
                    : undefined,
                metadata: {
                    broadcastTitle: dto.title,
                    recipientRoles: dto.recipientRoles,
                    recipientRole: outcome.recipient.role,
                    recipientUserId: outcome.recipient.id,
                    sentByUserId: scope.userId,
                },
            }),
        );

        try {
            await this.communicationRepository.save(rows, {
                chunk: AUDIT_CHUNK_SIZE,
            });
        } catch (error) {
            // A failed audit write must not mask an otherwise successful send.
            this.logger.error('Failed to persist broadcast audit trail', error);
        }
    }

    private summarise(
        dto: SendRoleBroadcastDto,
        outcomes: readonly DeliveryOutcome[],
    ): RoleBroadcastResult {
        const failures = outcomes.filter(outcome => !outcome.succeeded);
        const sentCount = outcomes.length - failures.length;

        this.logger.log(
            `Role broadcast "${dto.title}" delivered to ${sentCount}/${outcomes.length} recipients across roles: ${dto.recipientRoles.join(', ')}`,
        );

        return {
            recipientRoles: dto.recipientRoles,
            totalRecipients: outcomes.length,
            sentCount,
            failedCount: failures.length,
            failedRecipients: failures
                .slice(0, MAX_REPORTED_FAILURES)
                .map(failure => failure.recipient.email),
            sentAt: new Date().toISOString(),
        };
    }
}
