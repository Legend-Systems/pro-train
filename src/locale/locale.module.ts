import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../org/entities/org.entity';
import { LocaleService } from './locale.service';
import { ContentLocalizationService } from './content-localization.service';
import { LocaleInterceptor } from './locale.interceptor';
import { CourseTranslation } from './entities/course-translation.entity';
import { TestTranslation } from './entities/test-translation.entity';
import { QuestionTranslation } from './entities/question-translation.entity';
import { QuestionOptionTranslation } from './entities/question-option-translation.entity';
import { TranslationModule } from './translation/translation.module';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            Organization,
            CourseTranslation,
            TestTranslation,
            QuestionTranslation,
            QuestionOptionTranslation,
        ]),
        TranslationModule,
    ],
    providers: [
        LocaleService,
        ContentLocalizationService,
        LocaleInterceptor,
        {
            provide: APP_INTERCEPTOR,
            useClass: LocaleInterceptor,
        },
    ],
    exports: [LocaleService, ContentLocalizationService, TranslationModule],
})
export class LocaleModule {}
