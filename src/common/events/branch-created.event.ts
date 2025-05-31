export class BranchCreatedEvent {
    constructor(
        public readonly branchId: string,
        public readonly branchName: string,
        public readonly branchEmail: string,
        public readonly organizationId: string,
        public readonly organizationName: string,
        public readonly address?: string,
        public readonly contactNumber?: string,
        public readonly managerName?: string,
    ) {}
}
