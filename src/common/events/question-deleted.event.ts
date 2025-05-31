export class QuestionDeletedEvent {
    constructor(
        public readonly questionId: number,
        public readonly testId: number,
        public readonly questionText: string,
        public readonly organizationId?: string,
        public readonly organizationName?: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
        public readonly deletedBy?: string,
    ) {}
}