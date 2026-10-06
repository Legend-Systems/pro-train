import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/** How the learner used a course material. */
export enum MaterialInteraction {
    OPEN = 'open',
    DOWNLOAD = 'download',
}

/** Optional body for POST /course-materials/:id/view. */
export class RecordMaterialInteractionDto {
    @ApiPropertyOptional({
        enum: MaterialInteraction,
        default: MaterialInteraction.OPEN,
        description: 'Open records a view. Download records a file download.',
    })
    @IsOptional()
    @IsEnum(MaterialInteraction)
    interaction?: MaterialInteraction;
}
