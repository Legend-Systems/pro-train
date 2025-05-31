import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { Communication } from './entities/communication.entity';
import { EmailConfigService } from './services/email-config.service';
import { EmailTemplateService } from './services/email-template.service';
import { TemplateTestingService } from './services/template-testing.service';
import { EmailSMTPService } from './services/email-smtp.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailListener } from './listeners/email.listener';

@Module({
    imports: [TypeOrmModule.forFeature([Communication])],
    controllers: [CommunicationsController],
    providers: [
        CommunicationsService,
        EmailConfigService,
        EmailTemplateService,
        TemplateTestingService,
        EmailSMTPService,
        EmailQueueService,
        EmailListener,
    ],
    exports: [
        CommunicationsService,
        EmailConfigService,
        EmailTemplateService,
        TemplateTestingService,
        EmailSMTPService,
        EmailQueueService,
        TypeOrmModule,
    ],
})
export class CommunicationsModule {}
