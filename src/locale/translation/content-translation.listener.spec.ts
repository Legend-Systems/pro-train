import { ContentTranslationListener } from './content-translation.listener';
import { ContentTranslationOrchestratorService } from './content-translation.orchestrator';
import { CourseContentSavedEvent } from '../../common/events';

describe('ContentTranslationListener', () => {
    const orchestrator = {
        isEnabled: jest.fn(),
        translateCourse: jest.fn(),
    };

    let listener: ContentTranslationListener;

    beforeEach(() => {
        jest.clearAllMocks();
        listener = new ContentTranslationListener(
            orchestrator as unknown as ContentTranslationOrchestratorService,
        );
    });

    it('does not translate when the feature flag is off', async () => {
        orchestrator.isEnabled.mockReturnValue(false);

        await listener.handleCourseSaved(
            new CourseContentSavedEvent(1, '2', '3'),
        );

        expect(orchestrator.translateCourse).not.toHaveBeenCalled();
    });

    it('translates when the feature flag is on', async () => {
        orchestrator.isEnabled.mockReturnValue(true);
        orchestrator.translateCourse.mockResolvedValue(undefined);

        await listener.handleCourseSaved(
            new CourseContentSavedEvent(12, '2', '3', { title: true }),
        );

        expect(orchestrator.translateCourse).toHaveBeenCalledWith(12, {
            force: false,
            changedFields: { title: true },
            orgId: '2',
            branchId: '3',
        });
    });

    it('swallows provider errors so the original save is unaffected', async () => {
        orchestrator.isEnabled.mockReturnValue(true);
        orchestrator.translateCourse.mockRejectedValue(
            new Error('quota exceeded'),
        );

        await expect(
            listener.handleCourseSaved(new CourseContentSavedEvent(1)),
        ).resolves.toBeUndefined();
    });
});
