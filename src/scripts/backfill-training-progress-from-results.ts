import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TrainingProgressService } from '../training_progress/training_progress.service';

/**
 * Phase 6: One-off reconciliation (run against production cautiously — may touch many rows).
 *
 * npm run script:backfill-training-progress
 */
async function bootstrap(): Promise<void> {
    const logger = new Logger('BackfillTrainingProgressFromResults');
    const application = await NestFactory.createApplicationContext(AppModule);

    try {
        const trainingProgressService = application.get(TrainingProgressService);
        const { syncedRowCount } =
            await trainingProgressService.backfillFromLatestResults();
        logger.log(`Backfill complete; syncedRowCount=${syncedRowCount}`);
    } finally {
        await application.close();
    }
}

bootstrap().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
