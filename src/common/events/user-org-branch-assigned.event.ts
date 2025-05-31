export class UserOrgBranchAssignedEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly organizationId?: string,
        public readonly organizationName?: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
        public readonly avatar?: string,
        public readonly assignedBy?: string,
    ) {}
}
