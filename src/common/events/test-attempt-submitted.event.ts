/** Emitted when an attempt transitions to submitted status. */
export class TestAttemptSubmittedEvent {
    constructor(
        public readonly attemptId: number,
        public readonly testId: number,
        public readonly courseId: number,
        public readonly userId: string,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
