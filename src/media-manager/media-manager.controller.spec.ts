import { Test, TestingModule } from '@nestjs/testing';
import { MediaManagerController } from './media-manager.controller';
import { MediaManagerService } from './media-manager.service';

describe('MediaManagerController', () => {
  let controller: MediaManagerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaManagerController],
      providers: [MediaManagerService],
    }).compile();

    controller = module.get<MediaManagerController>(MediaManagerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
