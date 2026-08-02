import { UserRole } from '../../user/entities/user.entity';

/**
 * Outcome of a single one-time role broadcast.
 *
 * Because the send happens synchronously the administrator receives exact
 * per-recipient counts rather than a "queued" acknowledgement.
 */
export interface RoleBroadcastResult {
    /** Roles that were targeted by the broadcast. */
    readonly recipientRoles: readonly UserRole[];
    /** Number of distinct users matched by the selected roles. */
    readonly totalRecipients: number;
    /** Number of emails accepted by the SMTP server. */
    readonly sentCount: number;
    /** Number of emails that could not be delivered. */
    readonly failedCount: number;
    /** Email addresses that failed, capped to keep the response small. */
    readonly failedRecipients: readonly string[];
    /** Moment the broadcast finished, in ISO-8601 format. */
    readonly sentAt: string;
}
