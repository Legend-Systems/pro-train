import { Test, TestingModule } from '@nestjs/testing';
import { TestAttemptsService } from './test_attempts.service';

describe('TestAttemptsService', () => {
  let service: TestAttemptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestAttemptsService],
    }).compile();

    service = module.get<TestAttemptsService>(TestAttemptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
