import { PartialType } from '@nestjs/swagger';
import { CreateTrainingProgressDto } from './create-training_progress.dto';

export class UpdateTrainingProgressDto extends PartialType(CreateTrainingProgressDto) {}
