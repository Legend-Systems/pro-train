import type { OptionChangedFields } from '../../locale/translation/content-translation.types';

/** Emitted after a question-option create/update commits English source fields. */
export class QuestionOptionContentSavedEvent {
    constructor(
        public readonly optionId: number,
        public readonly questionId?: number,
        public readonly orgId?: string,
        public readonly branchId?: string,
        public readonly changedFields?: OptionChangedFields,
        public readonly force: boolean = false,
    ) {}
}
