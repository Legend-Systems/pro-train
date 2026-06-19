/** Emitted when a learner passes all active tests in a course. */
export class CourseCompletedEvent {
    constructor(
        public readonly courseId: number,
        public readonly userId: string,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
