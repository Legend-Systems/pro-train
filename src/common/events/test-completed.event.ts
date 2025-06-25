export class TestCompletedEvent {
    constructor(
        public readonly attemptId: string,
        public readonly testId: number,
        public readonly title: string,
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly userFirstName: string,
        public readonly userLastName: string,
        public readonly score?: number,
        public readonly percentage?: number,
        public readonly completionTime?: string,
        public readonly organizationId?: string,
        public readonly branchId?: string,
    ) {}
} 