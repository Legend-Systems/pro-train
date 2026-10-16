import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../user/entities/user.entity';
import { ReportAudienceService } from './services/report-audience.service';

/** Shared report audience rules for every report generator. */
@Module({
    imports: [TypeOrmModule.forFeature([User])],
    providers: [ReportAudienceService],
    exports: [ReportAudienceService],
})
export class ReportAudienceModule {}
