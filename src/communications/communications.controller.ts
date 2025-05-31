import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Req,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiExcludeController, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiExcludeController()
export class CommunicationsController {
    constructor(
        private readonly communicationsService: CommunicationsService,
    ) {}

    @Post()
    create(
        @Body() createCommunicationDto: CreateCommunicationDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.communicationsService.create(
            createCommunicationDto,
            scope,
            req.user.id,
        );
    }

    @Get()
    findAll(
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.communicationsService.findAll(scope, req.user.id);
    }

    @Get(':id')
    findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.communicationsService.findOne(id, scope, req.user.id);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCommunicationDto: UpdateCommunicationDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.communicationsService.update(
            id,
            updateCommunicationDto,
            scope,
            req.user.id,
        );
    }

    @Delete(':id')
    remove(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.communicationsService.remove(id, scope, req.user.id);
    }
}
