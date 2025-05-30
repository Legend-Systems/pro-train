import { Module } from '@nestjs/common';
import { QuestionsOptionsService } from './questions_options.service';
import { QuestionsOptionsController } from './questions_options.controller';

@Module({
  controllers: [QuestionsOptionsController],
  providers: [QuestionsOptionsService],
})
export class QuestionsOptionsModule {}
