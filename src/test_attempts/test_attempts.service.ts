import { Injectable } from '@nestjs/common';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';

@Injectable()
export class TestAttemptsService {
    create(createTestAttemptDto: CreateTestAttemptDto) {
        return 'This action adds a new testAttempt';
    }

    findAll() {
        return `This action returns all testAttempts`;
    }

    findOne(id: number) {
        return `This action returns a #${id} testAttempt`;
    }

    update(id: number, updateTestAttemptDto: UpdateTestAttemptDto) {
        return `This action updates a #${id} testAttempt`;
    }

    remove(id: number) {
        return `This action removes a #${id} testAttempt`;
    }
}
