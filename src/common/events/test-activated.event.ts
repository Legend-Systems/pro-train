export class TestActivatedEvent {
    constructor(
        public readonly testId: number,
        public readonly title: string,
        public readonly courseTitle: string,
        public readonly testType: string,
        public readonly courseId: number,
        public readonly durationMinutes?: number,
        public readonly maxAttempts?: number,
    ) {}
} 