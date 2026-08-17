import type { TestChangedFields } from '../../locale/translation/content-translation.types';

/** Emitted after a test create/update commits English source fields. */
export class TestContentSavedEvent {
    constructor(
        public readonly testId: number,
        public readonly includeQuestions: boolean = false,
        public readonly orgId?: string,
        public readonly branchId?: string,
        public readonly courseId?: number,
        public readonly changedFields?: TestChangedFields,
        public readonly force: boolean = false,
    ) {}
}
