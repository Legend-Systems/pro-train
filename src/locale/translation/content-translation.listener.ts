import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
    CourseContentSavedEvent,
    QuestionContentSavedEvent,
    QuestionOptionContentSavedEvent,
    TestContentSavedEvent,
} from '../../common/events';
import { CONTENT_SAVED_EVENTS } from './translation.constants';
import { ContentTranslationOrchestratorService } from './content-translation.orchestrator';
import { formatTranslationProviderError } from './translation-error.util';

/**
 * Async post-commit listener. Translation failures are logged and recorded
 * on the job row; they never fail the original HTTP mutation.
 */
@Injectable()
export class ContentTranslationListener {
    private readonly logger = new Logger(ContentTranslationListener.name);

    constructor(
        private readonly orchestrator: ContentTranslationOrchestratorService,
    ) {}

    @OnEvent(CONTENT_SAVED_EVENTS.COURSE, { async: true })
    async handleCourseSaved(event: CourseContentSavedEvent): Promise<void> {
        await this.safeRun('course', event.courseId, () =>
            this.orchestrator.translateCourse(event.courseId, {
                force: event.force,
                changedFields: event.changedFields,
                orgId: event.orgId,
                branchId: event.branchId,
            }),
        );
    }

    @OnEvent(CONTENT_SAVED_EVENTS.TEST, { async: true })
    async handleTestSaved(event: TestContentSavedEvent): Promise<void> {
        await this.safeRun('test', event.testId, () =>
            this.orchestrator.translateTest(event.testId, {
                force: event.force,
                includeQuestions: event.includeQuestions,
                changedFields: event.changedFields,
                orgId: event.orgId,
                branchId: event.branchId,
                courseId: event.courseId,
            }),
        );
    }

    @OnEvent(CONTENT_SAVED_EVENTS.QUESTION, { async: true })
    async handleQuestionSaved(
        event: QuestionContentSavedEvent,
    ): Promise<void> {
        await this.safeRun('question', event.questionId, () =>
            this.orchestrator.translateQuestion(event.questionId, {
                force: event.force,
                changedFields: event.changedFields,
                orgId: event.orgId,
                branchId: event.branchId,
            }),
        );
    }

    @OnEvent(CONTENT_SAVED_EVENTS.OPTION, { async: true })
    async handleOptionSaved(
        event: QuestionOptionContentSavedEvent,
    ): Promise<void> {
        await this.safeRun('option', event.optionId, () =>
            this.orchestrator.translateOption(event.optionId, {
                force: event.force,
                changedFields: event.changedFields,
                orgId: event.orgId,
                branchId: event.branchId,
            }),
        );
    }

    private async safeRun(
        entityType: string,
        entityId: number,
        work: () => Promise<void>,
    ): Promise<void> {
        if (!this.orchestrator.isEnabled()) {
            this.logger.debug(
                `translation.disabled entity=${entityType} id=${entityId}`,
            );
            return;
        }

        try {
            await work();
        } catch (error) {
            this.logger.error(
                `translation.listener.failed entity=${entityType} id=${entityId} error=${formatTranslationProviderError(error)}`,
            );
        }
    }
}
