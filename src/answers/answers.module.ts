import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AnswersService } from './answers.service';
import { AnswersController } from './answers.controller';
import { Answer } from './entities/answer.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import { CommonModule } from '../common/common.module';
import { QuestionsModule } from '../questions/questions.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Answer,
            TestAttempt,
            Question,
            QuestionOption,
        ]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        CommonModule,
        forwardRef(() => QuestionsModule),
    ],
    controllers: [AnswersController],
    providers: [AnswersService],
    exports: [AnswersService],
})
export class AnswersModule {}
