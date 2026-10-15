import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { AppModule } from '../app.module';
import { Course, CourseStatus } from '../course/entities/course.entity';
import {
    DIGITAL_SKILL_CATALOGUE,
    DIGITAL_SKILL_LEVELS,
    DIGITAL_SKILLS_COURSE_ID,
    DIGITAL_SKILLS_MAX_ATTEMPTS,
    DIGITAL_SKILLS_QUESTION_POINTS,
    DIGITAL_SKILLS_TEST_DESCRIPTION,
    DIGITAL_SKILLS_TEST_TITLE,
} from '../digital-skills/constants/digital-skills.constant';
import { Question, QuestionType } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import { Test, TestType } from '../test/entities/test.entity';

/**
 * Phase 1: Activate course 50 and create the self-assessment shell.
 *
 * npm run script:setup-digital-skills
 *
 * Idempotent: skips question create when the named test already exists.
 */
async function bootstrap(): Promise<void> {
    const logger = new Logger('SetupDigitalSkillsAssessment');
    const application = await NestFactory.createApplicationContext(AppModule);
    const dataSource = application.get(DataSource);

    try {
        const courseRepository = dataSource.getRepository(Course);
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

        if (course.status !== CourseStatus.ACTIVE) {
            course.status = CourseStatus.ACTIVE;
            await courseRepository.save(course);
            logger.log(`Activated course ${course.courseId} (${course.title})`);
        } else {
            logger.log(`Course ${course.courseId} is already active`);
        }

        let test = await testRepository.findOne({
            where: {
                courseId: DIGITAL_SKILLS_COURSE_ID,
                title: DIGITAL_SKILLS_TEST_TITLE,
            },
            relations: ['orgId', 'branchId'],
        });

        if (!test) {
            test = testRepository.create({
                courseId: DIGITAL_SKILLS_COURSE_ID,
                title: DIGITAL_SKILLS_TEST_TITLE,
                description: DIGITAL_SKILLS_TEST_DESCRIPTION,
                testType: TestType.TRAINING,
                durationMinutes: undefined,
                maxAttempts: DIGITAL_SKILLS_MAX_ATTEMPTS,
                examStartDate: null,
                examEndDate: null,
                isActive: true,
                orgId: course.orgId,
                branchId: course.branchId,
            });
            test = await testRepository.save(test);
            logger.log(`Created test ${test.testId}`);
        } else if (!test.isActive) {
            test.isActive = true;
            test = await testRepository.save(test);
            logger.log(`Reactivated test ${test.testId}`);
        } else {
            logger.log(`Test ${test.testId} already exists`);
        }

        const existingCount = await questionRepository.count({
            where: { testId: test.testId },
        });
        if (existingCount >= DIGITAL_SKILL_CATALOGUE.length) {
            logger.log(
                `Test ${test.testId} already has ${existingCount} questions — skipping seed`,
            );
            return;
        }

        for (const [index, skill] of DIGITAL_SKILL_CATALOGUE.entries()) {
            const question = await questionRepository.save(
                questionRepository.create({
                    testId: test.testId,
                    questionText: `Rate your current ability: ${skill.title}`,
                    questionType: QuestionType.MULTIPLE_CHOICE,
                    points: DIGITAL_SKILLS_QUESTION_POINTS,
                    orderIndex: index + 1,
                    explanation: DIGITAL_SKILLS_TEST_DESCRIPTION,
                    difficulty: 'easy',
                    tags: [skill.key, skill.group],
                    orgId: course.orgId,
                    branchId: course.branchId,
                }),
            );

            for (const level of DIGITAL_SKILL_LEVELS) {
                await optionRepository.save(
                    optionRepository.create({
                        questionId: question.questionId,
                        optionText: `${level.level} — ${level.label}: ${level.meaning}`,
                        isCorrect: false,
                        orderIndex: level.level,
                        orgId: course.orgId,
                        branchId: course.branchId,
                    }),
                );
            }
        }

        logger.log(
            `Seeded ${DIGITAL_SKILL_CATALOGUE.length} rating questions on test ${test.testId}`,
        );
    } finally {
        await application.close();
    }
}

bootstrap().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
