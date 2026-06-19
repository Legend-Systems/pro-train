import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardsService } from './rewards.service';
import {
    XP_ACTIONS,
    XP_SOURCE_TYPES,
    XP_VALUES,
} from './constants/xp.constants';
import {
    AuthDailyLoginEvent,
    CourseCompletedEvent,
    CourseCreatedEvent,
    CourseMaterialViewedEvent,
    RewardsTestAttemptStartedEvent,
    TestCreatedEvent,
    UserProfileCompletedEvent,
} from '../common/events';
import { User, UserRole } from '../user/entities/user.entity';

/** Authoring roles eligible for create-course/test/material XP (Phase 4). */
const AUTHORING_ROLES: UserRole[] = [
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.BRANDON,
];

/**
 * Phase 3 — event-driven XP awards. All handlers are non-blocking (try/catch)
 * so rewards failures never break login, test submission, or result creation.
 */
@Injectable()
export class RewardsSubscriber {
    private readonly logger = new Logger(RewardsSubscriber.name);

    constructor(
        private readonly rewardsService: RewardsService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    @OnEvent('auth.daily_login')
    async handleDailyLogin(event: AuthDailyLoginEvent): Promise<void> {
        try {
            const dateKey = this.getUtcDateString(new Date());
            await this.rewardsService.awardXP(
                {
                    userId: event.userId,
                    amount: XP_VALUES.DAILY_LOGIN,
                    action: XP_ACTIONS.DAILY_LOGIN,
                    source: {
                        id: dateKey,
                        type: XP_SOURCE_TYPES.AUTH,
                        details: 'Daily login',
                    },
                    idempotencyKey: `daily-login:${event.userId}:${dateKey}`,
                },
                event.orgId,
                event.branchId,
            );
        } catch (error) {
            this.logger.error(
                `Failed to award daily login XP for user ${event.userId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    @OnEvent('user.profile.completed')
    async handleProfileCompleted(
        event: UserProfileCompletedEvent,
    ): Promise<void> {
        try {
            await this.rewardsService.awardXP(
                {
                    userId: event.userId,
                    amount: XP_VALUES.COMPLETE_PROFILE,
                    action: XP_ACTIONS.COMPLETE_PROFILE,
                    source: {
                        id: event.userId,
                        type: XP_SOURCE_TYPES.USER,
                        details: 'Profile completed',
                    },
                    idempotencyKey: `profile-complete:${event.userId}`,
                },
                event.orgId,
                event.branchId,
            );
        } catch (error) {
            this.logger.error(
                `Failed to award profile completion XP for user ${event.userId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    @OnEvent('test.attempt.started')
    async handleAttemptStarted(
        event: RewardsTestAttemptStartedEvent,
    ): Promise<void> {
        try {
            await this.rewardsService.awardXP(
                {
                    userId: event.userId,
                    amount: XP_VALUES.START_TEST_ATTEMPT,
                    action: XP_ACTIONS.START_TEST_ATTEMPT,
                    source: {
                        id: String(event.attemptId),
                        type: XP_SOURCE_TYPES.TEST_ATTEMPT,
                        details: `Started attempt ${event.attemptNumber} for test ${event.testId}`,
                    },
                    idempotencyKey: `attempt-start:${event.attemptId}`,
                },
                event.orgId,
                event.branchId,
            );
        } catch (error) {
            this.logger.error(
                `Failed to award start-attempt XP for attempt ${event.attemptId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    @OnEvent('course.completed')
    async handleCourseCompleted(event: CourseCompletedEvent): Promise<void> {
        // XP is awarded in evaluateAndAwardCourseCompletion before emit — log only.
        this.logger.debug(
            `Course ${event.courseId} completed by user ${event.userId}`,
        );
    }

    @OnEvent('course-material.viewed')
    async handleMaterialViewed(
        event: CourseMaterialViewedEvent,
    ): Promise<void> {
        try {
            await this.rewardsService.awardXP(
                {
                    userId: event.userId,
                    amount: XP_VALUES.VIEW_COURSE_MATERIAL,
                    action: XP_ACTIONS.VIEW_COURSE_MATERIAL,
                    source: {
                        id: String(event.materialId),
                        type: XP_SOURCE_TYPES.COURSE_MATERIAL,
                        details: `Viewed material ${event.materialId}`,
                    },
                    idempotencyKey: `material-view:${event.userId}:${event.materialId}`,
                },
                event.orgId,
                event.branchId,
            );

            const allViewed =
                await this.rewardsService.hasViewedAllCourseMaterials(
                    event.userId,
                    event.courseId,
                );

            if (allViewed) {
                await this.rewardsService.awardXP(
                    {
                        userId: event.userId,
                        amount: XP_VALUES.COMPLETE_ALL_MATERIALS,
                        action: XP_ACTIONS.COMPLETE_ALL_MATERIALS,
                        source: {
                            id: String(event.courseId),
                            type: XP_SOURCE_TYPES.COURSE_MATERIAL,
                            details: `Viewed all materials in course ${event.courseId}`,
                        },
                        idempotencyKey: `materials-complete:${event.userId}:${event.courseId}`,
                    },
                    event.orgId,
                    event.branchId,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to award material view XP for material ${event.materialId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    @OnEvent('course.created')
    async handleCourseCreated(event: CourseCreatedEvent): Promise<void> {
        try {
            if (!(await this.isAuthoringUser(event.creatorId))) {
                return;
            }

            await this.rewardsService.awardXP(
                {
                    userId: event.creatorId,
                    amount: XP_VALUES.CREATE_COURSE,
                    action: XP_ACTIONS.CREATE_COURSE,
                    source: {
                        id: String(event.courseId),
                        type: XP_SOURCE_TYPES.ADMIN,
                        details: `Created course ${event.title}`,
                    },
                    idempotencyKey: `create-course:${event.creatorId}:${event.courseId}`,
                },
                event.organizationId!,
                event.branchId,
            );
        } catch (error) {
            this.logger.error(
                `Failed to award create-course XP for course ${event.courseId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    @OnEvent('test.created')
    async handleTestCreated(event: TestCreatedEvent): Promise<void> {
        try {
            if (!event.creatorId) {
                return;
            }

            if (!(await this.isAuthoringUser(event.creatorId))) {
                return;
            }

            await this.rewardsService.awardXP(
                {
                    userId: event.creatorId,
                    amount: XP_VALUES.CREATE_TEST,
                    action: XP_ACTIONS.CREATE_TEST,
                    source: {
                        id: String(event.testId),
                        type: XP_SOURCE_TYPES.ADMIN,
                        details: `Created test ${event.title}`,
                    },
                    idempotencyKey: `create-test:${event.creatorId}:${event.testId}`,
                },
                event.organizationId!,
                event.branchId,
            );
        } catch (error) {
            this.logger.error(
                `Failed to award create-test XP for test ${event.testId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    @OnEvent('course-material.created')
    async handleMaterialCreated(payload: {
        materialId: number;
        courseId: number;
        createdBy: string;
        orgId?: string;
        branchId?: string;
    }): Promise<void> {
        try {
            if (!payload.orgId) {
                return;
            }

            if (!(await this.isAuthoringUser(payload.createdBy))) {
                return;
            }

            await this.rewardsService.awardXP(
                {
                    userId: payload.createdBy,
                    amount: XP_VALUES.ADD_COURSE_MATERIAL,
                    action: XP_ACTIONS.ADD_COURSE_MATERIAL,
                    source: {
                        id: String(payload.materialId),
                        type: XP_SOURCE_TYPES.ADMIN,
                        details: `Added course material ${payload.materialId}`,
                    },
                    idempotencyKey: `add-material:${payload.createdBy}:${payload.materialId}`,
                },
                payload.orgId,
                payload.branchId,
            );
        } catch (error) {
            this.logger.error(
                `Failed to award add-material XP for material ${payload.materialId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    private async isAuthoringUser(userId: string): Promise<boolean> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: { id: true, role: true },
        });

        if (!user?.role) {
            return false;
        }

        return AUTHORING_ROLES.includes(user.role);
    }

    private getUtcDateString(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
