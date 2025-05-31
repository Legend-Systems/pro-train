export class OrganizationCreatedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly organizationName: string,
        public readonly organizationEmail: string,
        public readonly logoUrl?: string,
        public readonly website?: string,
    ) {}
}
