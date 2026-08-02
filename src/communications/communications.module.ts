import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { AdminCommunicationsController } from './admin-communications.controller';
import { Communication } from './entities/communication.entity';
import { User } from '../user/entities/user.entity';
import { EmailConfigService } from './services/email-config.service';
import { EmailTemplateService } from './services/email-template.service';
import { TemplateTestingService } from './services/template-testing.service';
import { EmailSMTPService } from './services/email-smtp.service';
import { EmailQueueService } from './services/email-queue.service';
import { RoleBroadcastService } from './services/role-broadcast.service';
import { EmailListener } from './listeners/email.listener';
import { OrgModule } from '../org/org.module';

@Module({
    imports: [
        // `User` is registered here (rather than importing `UserModule`) so the
        // broadcast service can read the recipient audience without creating a
        // circular dependency between the user and communications modules.
        TypeOrmModule.forFeature([Communication, User]),
        OrgModule,
    ],
    controllers: [CommunicationsController, AdminCommunicationsController],
    providers: [
        CommunicationsService,
        EmailConfigService,
        EmailTemplateService,
        TemplateTestingService,
        EmailSMTPService,
        EmailQueueService,
        RoleBroadcastService,
        EmailListener,
    ],
    exports: [
        CommunicationsService,
        EmailConfigService,
        EmailTemplateService,
        TemplateTestingService,
        EmailSMTPService,
        EmailQueueService,
        RoleBroadcastService,
        TypeOrmModule,
    ],
})
export class CommunicationsModule {}
