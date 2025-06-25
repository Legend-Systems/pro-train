export class TestAttemptStartedEvent {
    constructor(
        public readonly attemptId: string,
        public readonly testId: number,
        public readonly title: string,
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly userFirstName: string,
        public readonly userLastName: string,
        public readonly startTime: Date,
        public readonly expiresAt?: Date,
        public readonly durationMinutes?: number,
        public readonly organizationId?: string,
        public readonly branchId?: string,
    ) {}
} 