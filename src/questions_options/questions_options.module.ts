import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { QuestionsOptionsService } from './questions_options.service';
import { QuestionsOptionsController } from './questions_options.controller';
import { QuestionOption } from './entities/questions_option.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionsModule } from '../questions/questions.module';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([QuestionOption, Question]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        forwardRef(() => QuestionsModule),
        CommonModule,
    ],
    controllers: [QuestionsOptionsController],
    providers: [QuestionsOptionsService],
    exports: [QuestionsOptionsService, TypeOrmModule],
})
export class QuestionsOptionsModule {}
