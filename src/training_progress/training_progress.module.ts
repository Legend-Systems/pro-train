import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingProgressService } from './training_progress.service';
import { TrainingProgressController } from './training_progress.controller';
import { TrainingProgress } from './entities/training_progress.entity';
import { User } from '../user/entities/user.entity';
import { Course } from '../course/entities/course.entity';
import { Test } from '../test/entities/test.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TrainingProgress, User, Course, Test])],
    controllers: [TrainingProgressController],
    providers: [TrainingProgressService],
    exports: [TrainingProgressService],
})
export class TrainingProgressModule {}
