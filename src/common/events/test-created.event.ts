export class TestCreatedEvent {
    constructor(
        public readonly testId: number,
        public readonly title: string,
        public readonly testType: string,
        public readonly courseId: number,
        public readonly courseTitle: string,
        public readonly durationMinutes?: number,
        public readonly maxAttempts?: number,
        public readonly organizationId?: string,
        public readonly branchId?: string,
        public readonly isActive?: boolean,
    ) {}
} 