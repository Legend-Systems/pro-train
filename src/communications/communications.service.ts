import { Injectable } from '@nestjs/common';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';

@Injectable()
export class CommunicationsService {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create(
        _createCommunicationDto: CreateCommunicationDto,
        _scope: OrgBranchScope,
        _userId: string,
    ) {
        return 'This action adds a new communication';
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    findAll(_scope: OrgBranchScope, _userId: string) {
        return `This action returns all communications`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    findOne(id: number, _scope: OrgBranchScope, _userId: string) {
        return `This action returns a #${id} communication`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(
        id: number,
        _updateCommunicationDto: UpdateCommunicationDto,
        _scope: OrgBranchScope,
        _userId: string,
    ) {
        return `This action updates a #${id} communication`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove(id: number, _scope: OrgBranchScope, _userId: string) {
        return `This action removes a #${id} communication`;
    }
}
