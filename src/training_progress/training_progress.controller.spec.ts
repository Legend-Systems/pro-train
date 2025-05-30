import { Test, TestingModule } from '@nestjs/testing';
import { TrainingProgressController } from './training_progress.controller';
import { TrainingProgressService } from './training_progress.service';

describe('TrainingProgressController', () => {
  let controller: TrainingProgressController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainingProgressController],
      providers: [TrainingProgressService],
    }).compile();

    controller = module.get<TrainingProgressController>(TrainingProgressController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
