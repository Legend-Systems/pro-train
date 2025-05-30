import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswersService } from './answers.service';
import { AnswersController } from './answers.controller';
import { Answer } from './entities/answer.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Answer,
            TestAttempt,
            Question,
            QuestionOption,
        ]),
    ],
    controllers: [AnswersController],
    providers: [AnswersService],
    exports: [AnswersService],
})
export class AnswersModule {}
