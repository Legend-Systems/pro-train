import type { QuestionChangedFields } from '../../locale/translation/content-translation.types';

/** Emitted after a question create/update commits English source fields. */
export class QuestionContentSavedEvent {
    constructor(
        public readonly questionId: number,
        public readonly testId?: number,
        public readonly orgId?: string,
        public readonly branchId?: string,
        public readonly changedFields?: QuestionChangedFields,
        public readonly force: boolean = false,
    ) {}
}
