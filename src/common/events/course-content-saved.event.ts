import type { CourseChangedFields } from '../../locale/translation/content-translation.types';

/** Emitted after a course create/update commits English source fields. */
export class CourseContentSavedEvent {
    constructor(
        public readonly courseId: number,
        public readonly orgId?: string,
        public readonly branchId?: string,
        public readonly changedFields?: CourseChangedFields,
        public readonly force: boolean = false,
    ) {}
}
