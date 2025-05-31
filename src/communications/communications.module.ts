import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { Communication } from './entities/communication.entity';
import { EmailConfigService } from './services/email-config.service';

@Module({
    imports: [TypeOrmModule.forFeature([Communication])],
    controllers: [CommunicationsController],
    providers: [CommunicationsService, EmailConfigService],
    exports: [CommunicationsService, EmailConfigService, TypeOrmModule],
})
export class CommunicationsModule {}
