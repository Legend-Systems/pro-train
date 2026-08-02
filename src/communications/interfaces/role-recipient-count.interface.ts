import { UserRole } from '../../user/entities/user.entity';

/**
 * How many contactable users sit behind a single role, used to preview the
 * reach of a broadcast before the administrator commits to sending it.
 */
export interface RoleRecipientCount {
    readonly role: UserRole;
    readonly recipientCount: number;
}
