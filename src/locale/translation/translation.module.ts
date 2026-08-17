import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { Course } from '../../course/entities/course.entity';
import { Test } from '../../test/entities/test.entity';
import { Question } from '../../questions/entities/question.entity';
import { QuestionOption } from '../../questions_options/entities/questions_option.entity';
import { CourseTranslation } from '../entities/course-translation.entity';
import { TestTranslation } from '../entities/test-translation.entity';
import { QuestionTranslation } from '../entities/question-translation.entity';
import { QuestionOptionTranslation } from '../entities/question-option-translation.entity';
import { ContentTranslationJob } from '../entities/content-translation-job.entity';
import { TRANSLATION_PROVIDER_TOKEN } from './translation.constants';
import { GoogleCloudTranslationProvider } from './google-cloud-translation.provider';
import { NoopTranslationProvider } from './noop-translation.provider';
import { MachineTranslationService } from './machine-translation.service';
import { ContentTranslationWriterService } from './content-translation-writer.service';
import { ContentTranslationJobService } from './content-translation-job.service';
import { ContentTranslationOrchestratorService } from './content-translation.orchestrator';
import { ContentTranslationListener } from './content-translation.listener';
import { TranslationAdminController } from './translation-admin.controller';
import type { TranslationProvider } from './content-translation.types';

/**
 * Write-side translation pipeline: Google Cloud Translation v3, upserts,
 * async listeners, and admin retry/status endpoints.
 */
@Global()
@Module({
    imports: [
        ConfigModule,
        CacheModule.register({
            ttl: 300,
            max: 1000,
        }),
        TypeOrmModule.forFeature([
            Course,
            Test,
            Question,
            QuestionOption,
            CourseTranslation,
            TestTranslation,
            QuestionTranslation,
            QuestionOptionTranslation,
            ContentTranslationJob,
        ]),
    ],
    controllers: [TranslationAdminController],
    providers: [
        GoogleCloudTranslationProvider,
        NoopTranslationProvider,
        {
            provide: TRANSLATION_PROVIDER_TOKEN,
            inject: [
                ConfigService,
                GoogleCloudTranslationProvider,
                NoopTranslationProvider,
            ],
            useFactory: (
                configService: ConfigService,
                google: GoogleCloudTranslationProvider,
                noop: NoopTranslationProvider,
            ): TranslationProvider => {
                const provider = (
                    configService.get<string>('CONTENT_TRANSLATION_PROVIDER') ??
                    'google'
                ).toLowerCase();
                return provider === 'noop' ? noop : google;
            },
        },
        MachineTranslationService,
        ContentTranslationWriterService,
        ContentTranslationJobService,
        ContentTranslationOrchestratorService,
        ContentTranslationListener,
    ],
    exports: [
        MachineTranslationService,
        ContentTranslationWriterService,
        ContentTranslationOrchestratorService,
    ],
})
export class TranslationModule {}
