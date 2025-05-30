import { Test, TestingModule } from '@nestjs/testing';
import { TestAttemptsController } from './test_attempts.controller';
import { TestAttemptsService } from './test_attempts.service';

describe('TestAttemptsController', () => {
    let controller: TestAttemptsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TestAttemptsController],
            providers: [TestAttemptsService],
        }).compile();

        controller = module.get<TestAttemptsController>(TestAttemptsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
