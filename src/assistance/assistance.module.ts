import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branch/entities/branch.entity';
import { CommunicationsModule } from '../communications/communications.module';
import { CourseMaterial } from '../course-materials/entities/course-material.entity';
import { Course } from '../course/entities/course.entity';
import { Organization } from '../org/entities/org.entity';
import { Test } from '../test/entities/test.entity';
import { AssistanceController } from './assistance.controller';
import { AssistanceService } from './assistance.service';
import { AssistanceRequest } from './entities/assistance-request.entity';
import { AssistanceThrottlerGuard } from './guards/assistance-throttler.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AssistanceRequest,
            Course,
            Test,
            CourseMaterial,
            Organization,
            Branch,
        ]),
        CommunicationsModule,
    ],
    controllers: [AssistanceController],
    providers: [AssistanceService, AssistanceThrottlerGuard],
})
export class AssistanceModule {}
