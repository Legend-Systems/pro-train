import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';
import { TRANSLATION_ENTITY_TYPES } from '../translation.constants';
import type { TranslationEntityType } from '../translation.constants';

/** Admin request to re-run machine translation for one content entity. */
export class RetryTranslationDto {
    @ApiProperty({
        description: 'Content entity to re-translate',
        enum: TRANSLATION_ENTITY_TYPES,
        example: 'test',
    })
    @IsIn(TRANSLATION_ENTITY_TYPES)
    entityType: TranslationEntityType;

    @ApiProperty({
        description: 'Primary key of the course, test, question, or option',
        example: 43,
    })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    entityId: number;
}
