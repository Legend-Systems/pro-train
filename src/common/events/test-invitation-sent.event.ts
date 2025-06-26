export class TestInvitationSentEvent {
    constructor(
        public readonly invitationId: string,
        public readonly testId: number,
        public readonly testTitle: string,
        public readonly testType: string,
        public readonly courseId: number,
        public readonly courseTitle: string,
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly userFirstName: string,
        public readonly userLastName: string,
        public readonly invitedBy: string,
        public readonly inviterName: string,
        public readonly message?: string,
        public readonly expiresAt?: Date,
        public readonly durationMinutes?: number,
        public readonly maxAttempts?: number,
        public readonly organizationId?: string,
        public readonly branchId?: string,
    ) {}
}
