import { Test, TestingModule } from '@nestjs/testing';
import { MediaManagerService } from './media-manager.service';

describe('MediaManagerService', () => {
  let service: MediaManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaManagerService],
    }).compile();

    service = module.get<MediaManagerService>(MediaManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
