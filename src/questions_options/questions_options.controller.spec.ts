import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsOptionsController } from './questions_options.controller';
import { QuestionsOptionsService } from './questions_options.service';

describe('QuestionsOptionsController', () => {
    let controller: QuestionsOptionsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [QuestionsOptionsController],
            providers: [QuestionsOptionsService],
        }).compile();

        controller = module.get<QuestionsOptionsController>(
            QuestionsOptionsController,
        );
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
