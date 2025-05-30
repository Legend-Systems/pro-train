import { PartialType } from '@nestjs/swagger';
import { CreateQuestionsOptionDto } from './create-questions_option.dto';

export class UpdateQuestionsOptionDto extends PartialType(CreateQuestionsOptionDto) {}
