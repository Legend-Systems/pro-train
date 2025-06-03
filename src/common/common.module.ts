import { Global, Module } from '@nestjs/common';
import { RetryService } from './services/retry.service';

@Global()
@Module({
    providers: [RetryService],
    exports: [RetryService],
})
export class CommonModule {}
