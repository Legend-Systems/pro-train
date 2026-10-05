/** Fields rendered into the assistance-request email. */
export interface AssistanceRequestEmailData {
    readonly recipientEmail: string;
    readonly learnerUserId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly learnerEmail: string;
    readonly organizationId: string;
    readonly organizationName: string;
    readonly branchId?: string | null;
    readonly branchName?: string | null;
    readonly source: string;
    readonly contextType: string;
    readonly courseId?: number | null;
    readonly courseTitle: string;
    readonly materialId?: number | null;
    readonly materialTitle?: string | null;
    readonly testId?: number | null;
    readonly testTitle?: string | null;
    readonly message?: string | null;
    readonly requestedAt: string;
    readonly contextUrl?: string | null;
}
