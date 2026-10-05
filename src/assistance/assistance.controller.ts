import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StandardResponse } from '../common/types/standard-response.type';
import { AssistanceService } from './assistance.service';
import { CreateAssistanceRequestDto } from './dto/create-assistance-request.dto';
import { AssistanceThrottlerGuard } from './guards/assistance-throttler.guard';

/**
 * Learner endpoint for requesting help from inside a course or test.
 */
@ApiTags('assistance')
@ApiBearerAuth()
@Controller('assistance')
@UseGuards(JwtAuthGuard, AssistanceThrottlerGuard)
export class AssistanceController {
    constructor(private readonly assistanceService: AssistanceService) {}

    /**
     * Records a help request and emails the configured support address.
     */
    @Post('requests')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ short: { limit: 3, ttl: 900000 } })
    @ApiOperation({ summary: 'Request assistance during training' })
    create(
        @GetUser() user: AuthenticatedUser,
        @Body() dto: CreateAssistanceRequestDto,
    ): Promise<StandardResponse<{ requestId: string }>> {
        return this.assistanceService.createRequest(user, dto);
    }
}
