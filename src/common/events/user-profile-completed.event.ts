/** Emitted when a user profile meets completion criteria (avatar + name). */
export class UserProfileCompletedEvent {
    constructor(
        public readonly userId: string,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
