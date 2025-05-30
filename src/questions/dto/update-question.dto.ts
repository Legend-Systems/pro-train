import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateQuestionDto } from './create-question.dto';

export class UpdateQuestionDto extends PartialType(
    OmitType(CreateQuestionDto, ['testId'] as const),
) {}
