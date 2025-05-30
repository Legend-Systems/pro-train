import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { Question } from './entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { TestModule } from '../test/test.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Question, Test]),
        forwardRef(() => TestModule),
    ],
    controllers: [QuestionsController],
    providers: [QuestionsService],
    exports: [QuestionsService, TypeOrmModule],
})
export class QuestionsModule {}
