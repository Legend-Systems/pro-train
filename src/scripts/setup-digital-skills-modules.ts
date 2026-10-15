import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull } from 'typeorm';

import { AppModule } from '../app.module';
import { TestResultCreatedEvent } from '../common/events/test-result-created.event';
import { Course } from '../course/entities/course.entity';
import {
    CourseMaterial,
    MaterialStatus,
    MaterialType,
} from '../course-materials/entities/course-material.entity';
import { DIGITAL_SKILLS_KNOWLEDGE_QUESTIONS } from '../digital-skills/constants/digital-skills-knowledge-questions.constant';
import {
    DIGITAL_SKILL_CATALOGUE,
    DIGITAL_SKILLS_COURSE_ID,
    DIGITAL_SKILLS_KNOWLEDGE_MAX_ATTEMPTS,
    DIGITAL_SKILLS_KNOWLEDGE_TEST_DURATION_MINUTES,
    DIGITAL_SKILLS_KNOWLEDGE_WINDOW_DAYS,
    DIGITAL_SKILLS_TEST_TITLE,
    digitalSkillsCheckTitle,
    digitalSkillsModuleTitle,
} from '../digital-skills/constants/digital-skills.constant';
import { DigitalSkillsPlanService } from '../digital-skills/services/digital-skills-plan.service';
import { Question, QuestionType } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import { Result } from '../results/entities/result.entity';
import { Test, TestType } from '../test/entities/test.entity';

/**
 * Phase 4–5: one module + knowledge test per Digital Skills catalogue row.
 *
 * yarn script:setup-digital-skills-modules
 */
async function bootstrap(): Promise<void> {
    const logger = new Logger('SetupDigitalSkillsModules');
    const application = await NestFactory.createApplicationContext(AppModule);
    const dataSource = application.get(DataSource);

    try {
        const courseRepository = dataSource.getRepository(Course);
        const materialRepository = dataSource.getRepository(CourseMaterial);
        const testRepository = dataSource.getRepository(Test);
        const questionRepository = dataSource.getRepository(Question);
        const optionRepository = dataSource.getRepository(QuestionOption);

        const course = await courseRepository.findOne({
            where: { courseId: DIGITAL_SKILLS_COURSE_ID },
            relations: ['orgId', 'branchId'],
        });
        if (!course) {
            throw new Error(
                `Course ${DIGITAL_SKILLS_COURSE_ID} was not found. Do not create a replacement.`,
            );
        }

        const windowStart = new Date();
        const windowEnd = new Date(windowStart);
        windowEnd.setUTCDate(
            windowEnd.getUTCDate() + DIGITAL_SKILLS_KNOWLEDGE_WINDOW_DAYS,
        );

        let createdMaterials = 0;
        let createdTests = 0;

        for (const [index, skill] of DIGITAL_SKILL_CATALOGUE.entries()) {
            const materialTitle = digitalSkillsModuleTitle(skill.title);
            let material = await materialRepository.findOne({
                where: {
                    courseId: DIGITAL_SKILLS_COURSE_ID,
                    title: materialTitle,
                },
            });
            if (!material) {
                material = await materialRepository.save(
                    materialRepository.create({
                        title: materialTitle,
                        description:
                            `Training module for ${skill.title} (${skill.group}). ` +
                            'Watch the video when it is published, or attend the Saturday support session. ' +
                            `skillKey:${skill.key}`,
                        type: MaterialType.DOCUMENT,
                        sortOrder: index + 1,
                        isActive: true,
                        status: MaterialStatus.ACTIVE,
                        courseId: DIGITAL_SKILLS_COURSE_ID,
                        createdBy: course.createdBy,
                        orgId: course.orgId,
                        branchId: course.branchId,
                    }),
                );
                createdMaterials += 1;
            }

            const testTitle = digitalSkillsCheckTitle(skill.title);
            let test = await testRepository.findOne({
                where: {
                    courseId: DIGITAL_SKILLS_COURSE_ID,
                    title: testTitle,
                },
            });
            if (!test) {
                test = await testRepository.save(
                    testRepository.create({
                        courseId: DIGITAL_SKILLS_COURSE_ID,
                        title: testTitle,
                        description:
                            `Knowledge check for ${skill.title}. This is an exam, not a self-rating. ` +
                            'It does not change your Digital Skills Score. ' +
                            `skillKey:${skill.key}`,
                        testType: TestType.EXAM,
                        durationMinutes:
                            DIGITAL_SKILLS_KNOWLEDGE_TEST_DURATION_MINUTES,
                        maxAttempts: DIGITAL_SKILLS_KNOWLEDGE_MAX_ATTEMPTS,
                        examStartDate: windowStart,
                        examEndDate: windowEnd,
                        isActive: true,
                        orgId: course.orgId,
                        branchId: course.branchId,
                    }),
                );
                createdTests += 1;
            }

            const existingQuestions = await questionRepository.count({
                where: { testId: test.testId },
            });
            if (existingQuestions > 0) {
                continue;
            }

            const bank = DIGITAL_SKILLS_KNOWLEDGE_QUESTIONS[skill.key] ?? [];
            for (const [questionIndex, item] of bank.entries()) {
                const question = await questionRepository.save(
                    questionRepository.create({
                        testId: test.testId,
                        questionText: item.questionText,
                        questionType: QuestionType.MULTIPLE_CHOICE,
                        points: 1,
                        orderIndex: questionIndex + 1,
                        difficulty: 'easy',
                        tags: [skill.key, 'digital-skills-check'],
                        orgId: course.orgId,
                        branchId: course.branchId,
                    }),
                );
                for (const [optionIndex, option] of item.options.entries()) {
                    await optionRepository.save(
                        optionRepository.create({
                            questionId: question.questionId,
                            optionText: option.text,
                            isCorrect: option.isCorrect,
                            orderIndex: optionIndex + 1,
                            orgId: course.orgId,
                            branchId: course.branchId,
                        }),
                    );
                }
            }
        }

        logger.log(
            `Digital Skills modules: ${createdMaterials} materials, ${createdTests} knowledge tests on course ${course.courseId}`,
        );

        const survey = await testRepository.findOne({
            where: {
                courseId: DIGITAL_SKILLS_COURSE_ID,
                title: DIGITAL_SKILLS_TEST_TITLE,
            },
        });
        if (survey) {
            const planService = application.get(DigitalSkillsPlanService);
            const resultRepository = dataSource.getRepository(Result);
            const results = await resultRepository.find({
                where: {
                    testId: survey.testId,
                    voidedByResetId: IsNull(),
                },
                relations: ['orgId', 'branchId'],
                order: { calculatedAt: 'DESC' },
            });

            const seenUsers = new Set<string>();
            let assignedUsers = 0;
            for (const result of results) {
                if (seenUsers.has(result.userId) || !result.orgId?.id) {
                    continue;
                }
                seenUsers.add(result.userId);
                await planService.assignFromResult(
                    new TestResultCreatedEvent(
                        result.resultId,
                        result.attemptId,
                        result.testId,
                        result.courseId,
                        result.userId,
                        Number(result.score),
                        Number(result.percentage),
                        result.passed,
                        1,
                        DIGITAL_SKILLS_TEST_TITLE,
                        result.orgId.id,
                        result.branchId?.id,
                    ),
                );
                assignedUsers += 1;
            }
            logger.log(
                `Backfilled Digital Skills plans for ${assignedUsers} assessed learners`,
            );
        }
    } finally {
        await application.close();
    }
}

bootstrap().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
