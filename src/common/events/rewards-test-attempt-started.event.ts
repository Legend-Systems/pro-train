/**
 * XP-specific payload for test.attempt.started — includes course and attempt context.
 * Distinct from TestAttemptStartedEvent used by email templates.
 */
export class RewardsTestAttemptStartedEvent {
    constructor(
        public readonly attemptId: number,
        public readonly testId: number,
        public readonly courseId: number,
        public readonly userId: string,
        public readonly attemptNumber: number,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
