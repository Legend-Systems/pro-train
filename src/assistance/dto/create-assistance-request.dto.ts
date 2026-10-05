import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    Validate,
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import {
    ASSISTANCE_MESSAGE_MAX_LENGTH,
    AssistanceContextType,
    AssistanceSource,
} from '../entities/assistance-request.entity';

/** Turns blank values into undefined and numeric strings into integers. */
function toOptionalInt(value: unknown): unknown {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) ? parsed : value;
}

/** Turns blank strings into undefined. */
function toOptionalString(value: unknown): unknown {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A course request must include courseId. A test request must include testId.
 */
@ValidatorConstraint({ name: 'assistanceContextIds', async: false })
class AssistanceContextIdsConstraint implements ValidatorConstraintInterface {
    validate(_value: unknown, args: ValidationArguments): boolean {
        const dto = args.object as CreateAssistanceRequestDto;
        if (dto.contextType === AssistanceContextType.COURSE) {
            return typeof dto.courseId === 'number';
        }
        if (dto.contextType === AssistanceContextType.TEST) {
            return typeof dto.testId === 'number';
        }
        return false;
    }

    defaultMessage(): string {
        return 'A course request requires courseId and a test request requires testId';
    }
}

/** Body sent by the web or mobile training screens. Identity is not accepted here. */
export class CreateAssistanceRequestDto {
    @ApiProperty({ enum: AssistanceSource, example: AssistanceSource.WEB })
    @IsEnum(AssistanceSource)
    source: AssistanceSource;

    @ApiProperty({ enum: AssistanceContextType, example: AssistanceContextType.COURSE })
    @IsEnum(AssistanceContextType)
    @Validate(AssistanceContextIdsConstraint)
    contextType: AssistanceContextType;

    @ApiPropertyOptional({ example: 12 })
    @Transform(({ value }) => toOptionalInt(value))
    @IsOptional()
    @IsInt()
    @Min(1)
    courseId?: number;

    @ApiPropertyOptional({ example: 'Food safety' })
    @Transform(({ value }) => toOptionalString(value))
    @IsOptional()
    @IsString()
    @MaxLength(255)
    courseTitle?: string;

    @ApiPropertyOptional({ example: 44 })
    @Transform(({ value }) => toOptionalInt(value))
    @IsOptional()
    @IsInt()
    @Min(1)
    materialId?: number;

    @ApiPropertyOptional({ example: 'Module 2 — Allergens' })
    @Transform(({ value }) => toOptionalString(value))
    @IsOptional()
    @IsString()
    @MaxLength(255)
    materialTitle?: string;

    @ApiPropertyOptional({ example: 7 })
    @Transform(({ value }) => toOptionalInt(value))
    @IsOptional()
    @IsInt()
    @Min(1)
    testId?: number;

    @ApiPropertyOptional({ example: 'Week 1 quiz' })
    @Transform(({ value }) => toOptionalString(value))
    @IsOptional()
    @IsString()
    @MaxLength(255)
    testTitle?: string;

    @ApiPropertyOptional({ example: 'I cannot open the PDF.' })
    @Transform(({ value }) => toOptionalString(value))
    @IsOptional()
    @IsString()
    @MaxLength(ASSISTANCE_MESSAGE_MAX_LENGTH)
    message?: string;
}
