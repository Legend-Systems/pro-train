/** One organization course for the admin filter. */
export interface EngagementCourseOption {
    readonly courseId: number;
    readonly title: string;
}

/** Whether the learner has downloaded the materials in the current filter. */
export type MaterialDownloadStatus = 'not_downloaded' | 'partial' | 'downloaded';

/** Per-learner engagement inside the selected course scope. */
export interface LearnerEngagementRow {
    readonly userId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly coursesOpened: number;
    readonly lastCourseViewedAt: string | null;
    readonly materialsOpened: number;
    readonly materialsDownloaded: number;
    readonly materialTotal: number;
    readonly downloadStatus: MaterialDownloadStatus;
    readonly downloadedMaterialTitles: readonly string[];
    readonly manualDownloaded: boolean;
    readonly manualDownloadCount: number;
    readonly lastActivityAt: string | null;
}

/** A recent open or download of one course material. */
export interface MaterialActivityRow {
    readonly userId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly materialId: number;
    readonly materialTitle: string;
    readonly courseId: number;
    readonly courseTitle: string;
    readonly openCount: number;
    readonly downloadCount: number;
    readonly lastViewedAt: string | null;
}

/** Counts across the filtered learner set, not only the current page. */
export interface EngagementSummary {
    readonly learnerCount: number;
    readonly learnersWhoOpenedCourse: number;
    readonly learnersWhoOpenedMaterial: number;
    readonly learnersWhoDownloadedMaterial: number;
    readonly learnersWhoDownloadedAllMaterials: number;
    readonly learnersWhoDownloadedManual: number;
    readonly materialTotal: number;
}

/** Admin payload for material and course engagement. */
export interface EngagementOverview {
    readonly summary: EngagementSummary;
    readonly courses: readonly EngagementCourseOption[];
    readonly learners: readonly LearnerEngagementRow[];
    readonly recentMaterials: readonly MaterialActivityRow[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
}
