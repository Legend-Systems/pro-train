import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Body,
    UseGuards,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../user/entities/user.entity';
import { StandardResponse } from '../../common/types/standard-response.type';
import { ContentTranslationOrchestratorService } from './content-translation.orchestrator';
import { RetryTranslationDto } from './dto/retry-translation.dto';
import {
    TRANSLATION_ENTITY_TYPES,
    type TranslationEntityType,
} from './translation.constants';
import type { TranslationStatusResponse } from './content-translation.types';

function isTranslationEntityType(
    value: string,
): value is TranslationEntityType {
    return (TRANSLATION_ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Admin retry and status APIs for automatic pt-PT content translation.
 */
@ApiTags('🌐 Content Translations')
@Controller('admin/translations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class TranslationAdminController {
    private readonly logger = new Logger(TranslationAdminController.name);

    constructor(
        private readonly orchestrator: ContentTranslationOrchestratorService,
    ) {}

    @Get('status/:entityType/:entityId')
    @ApiOperation({
        summary: 'Get pt-PT translation job status for one content entity',
    })
    @ApiParam({ name: 'entityType', enum: TRANSLATION_ENTITY_TYPES })
    @ApiParam({ name: 'entityId', type: Number })
    async getStatus(
        @Param('entityType') entityType: string,
        @Param('entityId', ParseIntPipe) entityId: number,
    ): Promise<StandardResponse<TranslationStatusResponse>> {
        const normalized = this.parseEntityType(entityType);
        const data = await this.orchestrator.getStatus(normalized, entityId);
        return {
            success: true,
            message: 'Translation status retrieved',
            data,
        };
    }

    @Post('retry')
    @ApiOperation({
        summary: 'Re-run English → pt-PT translation for one content entity',
    })
    async retry(
        @Body() dto: RetryTranslationDto,
    ): Promise<StandardResponse<TranslationStatusResponse>> {
        this.logger.log(
            `translation.retry.requested entity=${dto.entityType} id=${dto.entityId}`,
        );
        const data = await this.orchestrator.retry(dto.entityType, dto.entityId);
        return {
            success: true,
            message: 'Translation retry completed',
            data,
        };
    }

    private parseEntityType(entityType: string): TranslationEntityType {
        if (!isTranslationEntityType(entityType)) {
            throw new BadRequestException(
                `Unsupported translation entity type: ${entityType}`,
            );
        }
        return entityType;
    }
}
