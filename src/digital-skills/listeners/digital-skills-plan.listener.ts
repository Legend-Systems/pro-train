import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { TestResultCreatedEvent } from '../../common/events/test-result-created.event';
import { DigitalSkillsPlanService } from '../services/digital-skills-plan.service';

/**
 * Assigns weak-area modules when the Digital Skills survey is scored.
 */
@Injectable()
export class DigitalSkillsPlanListener {
    private readonly logger = new Logger(DigitalSkillsPlanListener.name);

    constructor(private readonly planService: DigitalSkillsPlanService) {}

    @OnEvent('test.result.created', { async: true })
    async handleResultCreated(event: TestResultCreatedEvent): Promise<void> {
        if (!this.planService.isBaselineAssessmentEvent(event)) {
            return;
        }

        try {
            await this.planService.assignFromResult(event);
        } catch (error) {
            this.logger.error(
                `Failed to assign Digital Skills plan for user ${event.userId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
