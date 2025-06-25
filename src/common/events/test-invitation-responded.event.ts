import { InvitationStatus } from '../../test/entities/test-invitation.entity';

export class TestInvitationRespondedEvent {
    constructor(
        public readonly invitationId: string,
        public readonly testId: number,
        public readonly testTitle: string,
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly userFirstName: string,
        public readonly userLastName: string,
        public readonly response: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED,
        public readonly responseNotes?: string,
        public readonly respondedAt?: Date,
        public readonly organizationId?: string,
        public readonly branchId?: string,
    ) {}
} 