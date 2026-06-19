/** Emitted from ResultsService after a result is saved — triggers course completion evaluation. */
export class TestResultCreatedEvent {
    constructor(
        public readonly resultId: number,
        public readonly attemptId: number,
        public readonly testId: number,
        public readonly courseId: number,
        public readonly userId: string,
        public readonly score: number,
        public readonly percentage: number,
        public readonly passed: boolean,
        public readonly attemptNumber: number,
        public readonly testTitle: string,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
