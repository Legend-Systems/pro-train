import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { User } from './user/entities/user.entity';
import { Course } from './course/entities/course.entity';
import { Test } from './test/entities/test.entity';
import { Question } from './questions/entities/question.entity';
import { QuestionOption } from './questions_options/entities/questions_option.entity';
import { TestAttempt } from './test_attempts/entities/test_attempt.entity';
import { CourseModule } from './course/course.module';
import { TestModule } from './test/test.module';
import { QuestionsModule } from './questions/questions.module';
import { QuestionsOptionsModule } from './questions_options/questions_options.module';
import { TestAttemptsModule } from './test_attempts/test_attempts.module';
import { AnswersModule } from './answers/answers.module';
import { ResultsModule } from './results/results.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { TrainingProgressModule } from './training_progress/training_progress.module';
import { ReportsModule } from './reports/reports.module';
import { Answer } from './answers/entities/answer.entity';
import { Result } from './results/entities/result.entity';
import { Leaderboard } from './leaderboard/entities/leaderboard.entity';
import { TrainingProgress } from './training_progress/entities/training_progress.entity';
import { Communication } from './communications/entities/communication.entity';
import { CommunicationsModule } from './communications/communications.module';
import { OrgModule } from './org/org.module';
import { BranchModule } from './branch/branch.module';

@Module({
    imports: [
        // Load environment variables
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Configure rate limiting
        ThrottlerModule.forRoot([
            {
                name: 'short',
                ttl: 60000, // 1 minute
                limit: 10, // 10 requests per minute
            },
            {
                name: 'medium',
                ttl: 600000, // 10 minutes
                limit: 50, // 50 requests per 10 minutes
            },
            {
                name: 'long',
                ttl: 3600000, // 1 hour
                limit: 100, // 100 requests per hour
            },
        ]),

        // Configure TypeORM with MySQL
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'mysql',
                host: configService.get('DATABASE_HOST'),
                port: +configService.get('DATABASE_PORT'),
                username: configService.get('DATABASE_USERNAME'),
                password: configService.get('DATABASE_PASSWORD'),
                database: configService.get('DATABASE_NAME'),
                entities: [
                    User,
                    Course,
                    Test,
                    Question,
                    QuestionOption,
                    TestAttempt,
                    Answer,
                    Result,
                    Leaderboard,
                    TrainingProgress,
                    Communication,
                ],
                synchronize: true,
                logging: false,
                autoLoadEntities: true,
                // Connection pool configuration
                extra: {
                    connectionLimit: 20,
                    acquireTimeout: 30000,
                    timeout: 30000,
                    reconnect: true,
                    idleTimeout: 30000,
                    charset: 'utf8mb4',
                },
                // Retry configuration
                retryAttempts: 3,
                retryDelay: 3000,
                // Connection timeout
                connectTimeout: 30000,
                // Keep alive
                keepConnectionAlive: true,
            }),
            inject: [ConfigService],
        }),

        UserModule,
        AuthModule,
        CourseModule,
        TestModule,
        QuestionsModule,
        QuestionsOptionsModule,
        TestAttemptsModule,
        AnswersModule,
        ResultsModule,
        LeaderboardModule,
        TrainingProgressModule,
        ReportsModule,
        CommunicationsModule,
        OrgModule,
        BranchModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}
