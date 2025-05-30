import { PartialType } from '@nestjs/swagger';
import { CreateTestAttemptDto } from './create-test_attempt.dto';

export class UpdateTestAttemptDto extends PartialType(CreateTestAttemptDto) {}
