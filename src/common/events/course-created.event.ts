export class CourseCreatedEvent {
    constructor(
        public readonly courseId: number,
        public readonly title: string,
        public readonly description: string,
        public readonly creatorId: string,
        public readonly creatorEmail: string,
        public readonly creatorFirstName: string,
        public readonly creatorLastName: string,
        public readonly organizationId?: string,
        public readonly organizationName?: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
    ) {}
}
