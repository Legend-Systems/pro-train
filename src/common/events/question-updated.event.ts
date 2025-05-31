export class QuestionUpdatedEvent {
    constructor(
        public readonly questionId: number,
        public readonly testId: number,
        public readonly questionText: string,
        public readonly questionType: string,
        public readonly points: number,
        public readonly orderIndex: number,
        public readonly organizationId?: string,
        public readonly organizationName?: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
        public readonly updatedBy?: string,
        public readonly updatedFields?: string[],
    ) {}
}