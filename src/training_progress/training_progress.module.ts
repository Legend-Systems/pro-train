import { Module } from '@nestjs/common';
import { TrainingProgressService } from './training_progress.service';
import { TrainingProgressController } from './training_progress.controller';

@Module({
  controllers: [TrainingProgressController],
  providers: [TrainingProgressService],
})
export class TrainingProgressModule {}
