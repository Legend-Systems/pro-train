import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TrainingHoursService } from '../training-hours/training-hours.service';

/**
 * Backfills training_session rows from historical submitted attempts.
 *
 * yarn script:backfill-training-sessions
 */
async function bootstrap(): Promise<void> {
    const logger = new Logger('BackfillTrainingSessions');
    const application = await NestFactory.createApplicationContext(AppModule);

    try {
        const trainingHoursService = application.get(TrainingHoursService);
        const { syncedCount } =
            await trainingHoursService.backfillFromAttempts();
        logger.log(`Backfill complete; syncedCount=${syncedCount}`);
    } finally {
        await application.close();
    }
}

bootstrap().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
