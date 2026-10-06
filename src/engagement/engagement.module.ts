import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseMaterialView } from '../course-materials/entities/course-material-view.entity';
import { CourseMaterial } from '../course-materials/entities/course-material.entity';
import { Course } from '../course/entities/course.entity';
import { User } from '../user/entities/user.entity';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
import { CourseModuleView } from './entities/course-module-view.entity';
import { TrainingManualDownload } from './entities/training-manual-download.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CourseModuleView,
            TrainingManualDownload,
            CourseMaterialView,
            CourseMaterial,
            Course,
            User,
        ]),
    ],
    controllers: [EngagementController],
    providers: [EngagementService],
    exports: [EngagementService],
})
export class EngagementModule {}
