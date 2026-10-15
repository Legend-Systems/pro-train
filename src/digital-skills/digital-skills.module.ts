import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Answer } from '../answers/entities/answer.entity';
import { CommunicationsModule } from '../communications/communications.module';
import { CourseMaterial } from '../course-materials/entities/course-material.entity';
import { Result } from '../results/entities/result.entity';
import { TestInvitation } from '../test/entities/test-invitation.entity';
import { Test } from '../test/entities/test.entity';
import { User } from '../user/entities/user.entity';
import { DigitalSkillsLearnerController } from './digital-skills-learner.controller';
import { DigitalSkillsController } from './digital-skills.controller';
import { DigitalSkillsAssignment } from './entities/digital-skills-assignment.entity';
import { DigitalSkillsPlanListener } from './listeners/digital-skills-plan.listener';
import { DigitalSkillsAdminService } from './services/digital-skills-admin.service';
import { DigitalSkillsBookingService } from './services/digital-skills-booking.service';
import { DigitalSkillsPlanService } from './services/digital-skills-plan.service';

@Module({
    imports: [
        CommunicationsModule,
        TypeOrmModule.forFeature([
            User,
            Test,
            Result,
            Answer,
            CourseMaterial,
            DigitalSkillsAssignment,
            TestInvitation,
        ]),
    ],
    controllers: [DigitalSkillsController, DigitalSkillsLearnerController],
    providers: [
        DigitalSkillsAdminService,
        DigitalSkillsBookingService,
        DigitalSkillsPlanService,
        DigitalSkillsPlanListener,
    ],
    exports: [DigitalSkillsAdminService, DigitalSkillsPlanService],
})
export class DigitalSkillsModule {}
