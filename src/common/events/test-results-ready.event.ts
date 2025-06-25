export class TestResultsReadyEvent {
    constructor(
        public readonly resultId: string,
        public readonly testId: number,
        public readonly title: string,
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly userFirstName: string,
        public readonly userLastName: string,
        public readonly score: number,
        public readonly percentage: number,
        public readonly passed: boolean,
        public readonly resultsUrl: string,
        public readonly organizationId?: string,
        public readonly branchId?: string,
    ) {}
} 