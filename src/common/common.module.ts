import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RetryService } from './services/retry.service';
import { DatabaseHealthService } from './services/database-health.service';

@Module({
    imports: [ScheduleModule.forRoot()],
    providers: [RetryService, DatabaseHealthService],
    exports: [RetryService, DatabaseHealthService],
})
export class CommonModule {}
