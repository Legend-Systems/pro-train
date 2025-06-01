import { Test, TestingModule } from '@nestjs/testing';
import { CourseMaterialsController } from './course-materials.controller';
import { CourseMaterialsService } from './course-materials.service';

describe('CourseMaterialsController', () => {
    let controller: CourseMaterialsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CourseMaterialsController],
            providers: [CourseMaterialsService],
        }).compile();

        controller = module.get<CourseMaterialsController>(
            CourseMaterialsController,
        );
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
