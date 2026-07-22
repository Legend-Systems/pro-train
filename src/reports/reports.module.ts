import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseReportsService } from './services/course-reports.service';
import { UserReportsService } from './services/user-reports.service';
import { TestReportsService } from './services/test-reports.service';
import { ResultsReportsService } from './services/results-reports.service';
import { LeaderboardReportsService } from './services/leaderboard-reports.service';
import { TrainingProgressReportsService } from './services/training-progress-reports.service';
import { AdminInsightsReportsService } from './services/admin-insights-reports.service';
import { ReportsController } from './reports.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { Course } from '../course/entities/course.entity';
import { Test } from '../test/entities/test.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { User } from '../user/entities/user.entity';
import { Result } from '../results/entities/result.entity';
import { Question } from '../questions/entities/question.entity';
import { Answer } from '../answers/entities/answer.entity';
import { Leaderboard } from '../leaderboard/entities/leaderboard.entity';
import { TrainingProgress } from '../training_progress/entities/training_progress.entity';
import { TrainingSession } from '../training-hours/entities/training-session.entity';
import { TrainingHoursModule } from '../training-hours/training-hours.module';

@Module({
    imports: [
        CacheModule.register({
            ttl: 60 * 60, // Default 1 hour in seconds
            max: 1000, // Maximum number of items in cache
        }),
        TypeOrmModule.forFeature([
            Course,
            User,
            Test,
            TestAttempt,
            Result,
            Question,
            Answer,
            Leaderboard,
            TrainingProgress,
            TrainingSession,
        ]),
        TrainingHoursModule,
    ],
    controllers: [ReportsController, AdminReportsController],
    providers: [
        CourseReportsService,
        UserReportsService,
        TestReportsService,
        ResultsReportsService,
        LeaderboardReportsService,
        TrainingProgressReportsService,
        AdminInsightsReportsService,
    ],
    exports: [
        CourseReportsService,
        UserReportsService,
        TestReportsService,
        ResultsReportsService,
        LeaderboardReportsService,
        TrainingProgressReportsService,
        AdminInsightsReportsService,
    ],
})
export class ReportsModule {}
