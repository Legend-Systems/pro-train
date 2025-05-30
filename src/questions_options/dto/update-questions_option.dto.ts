import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateQuestionOptionDto } from './create-questions_option.dto';

export class UpdateQuestionOptionDto extends PartialType(
    OmitType(CreateQuestionOptionDto, ['questionId'] as const),
) {}
