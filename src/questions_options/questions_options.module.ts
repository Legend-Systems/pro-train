import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionsOptionsService } from './questions_options.service';
import { QuestionsOptionsController } from './questions_options.controller';
import { QuestionOption } from './entities/questions_option.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionsModule } from '../questions/questions.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([QuestionOption, Question]),
        forwardRef(() => QuestionsModule),
    ],
    controllers: [QuestionsOptionsController],
    providers: [QuestionsOptionsService],
    exports: [QuestionsOptionsService, TypeOrmModule],
})
export class QuestionsOptionsModule {}
