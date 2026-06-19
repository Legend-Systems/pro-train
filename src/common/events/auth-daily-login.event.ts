/** Emitted after successful sign-in — subscriber awards daily login XP once per UTC day. */
export class AuthDailyLoginEvent {
    constructor(
        public readonly userId: string,
        public readonly orgId: string,
        public readonly branchId?: string,
    ) {}
}
