import { Test, TestingModule } from '@nestjs/testing';
import { CourseMaterialsService } from './course-materials.service';

describe('CourseMaterialsService', () => {
    let service: CourseMaterialsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CourseMaterialsService],
        }).compile();

        service = module.get<CourseMaterialsService>(CourseMaterialsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
