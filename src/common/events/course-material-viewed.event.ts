/** Emitted on first view of a course material by a learner. */
export class CourseMaterialViewedEvent {
    constructor(
        public readonly materialId: number,
        public readonly courseId: number,
        public readonly userId: string,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
