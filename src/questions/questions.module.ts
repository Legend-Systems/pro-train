import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { Question } from './entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { TestModule } from '../test/test.module';
import { AnswersModule } from '../answers/answers.module';
import { QuestionsOptionsModule } from '../questions_options/questions_options.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Question, Test]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        forwardRef(() => TestModule),
        AnswersModule,
        forwardRef(() => QuestionsOptionsModule),
    ],
    controllers: [QuestionsController],
    providers: [QuestionsService],
    exports: [QuestionsService, TypeOrmModule],
})
export class QuestionsModule {}
