import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsOptionsService } from './questions_options.service';

describe('QuestionsOptionsService', () => {
    let service: QuestionsOptionsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [QuestionsOptionsService],
        }).compile();

        service = module.get<QuestionsOptionsService>(QuestionsOptionsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
