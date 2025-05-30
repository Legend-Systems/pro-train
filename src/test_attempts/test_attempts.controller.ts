import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
import { TestAttemptsService } from './test_attempts.service';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';

@Controller('test-attempts')
export class TestAttemptsController {
    constructor(private readonly testAttemptsService: TestAttemptsService) {}

    @Post()
    create(@Body() createTestAttemptDto: CreateTestAttemptDto) {
        return this.testAttemptsService.create(createTestAttemptDto);
    }

    @Get()
    findAll() {
        return this.testAttemptsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.testAttemptsService.findOne(+id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateTestAttemptDto: UpdateTestAttemptDto,
    ) {
        return this.testAttemptsService.update(+id, updateTestAttemptDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.testAttemptsService.remove(+id);
    }
}
