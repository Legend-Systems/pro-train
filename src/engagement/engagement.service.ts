import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { StandardResponse } from '../common/types/standard-response.type';
import { CourseMaterialView } from '../course-materials/entities/course-material-view.entity';
import {
    CourseMaterial,
    MaterialStatus,
} from '../course-materials/entities/course-material.entity';
import { Course, CourseStatus } from '../course/entities/course.entity';
import {
    isLearnerRole,
    LEARNER_USER_ROLES,
    User,
    UserStatus,
} from '../user/entities/user.entity';
import { trainingManualTitle } from './constants/training-manuals';
import { EngagementOverviewQueryDto } from './dto/engagement-overview-query.dto';
import {
    EngagementOverview,
    LearnerEngagementRow,
    MaterialActivityRow,
    MaterialDownloadStatus,
} from './dto/engagement-overview.types';
import { CourseModuleView } from './entities/course-module-view.entity';
import { TrainingManualDownload } from './entities/training-manual-download.entity';

interface LearnerTotals {
    coursesOpened: number;
    lastCourseViewedAt: Date | null;
    materialsOpened: number;
    materialsDownloaded: number;
    downloadedMaterialTitles: string[];
    manualDownloadCount: number;
    lastActivityAt: Date | null;
}

const RECENT_MATERIAL_LIMIT = 40;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;

/**
 * Records learner course opens and manual downloads, and reports that
 * activity to organization admins.
 */
@Injectable()
export class EngagementService {
    constructor(
        @InjectRepository(CourseModuleView)
        private readonly courseViewRepository: Repository<CourseModuleView>,
        @InjectRepository(TrainingManualDownload)
        private readonly manualRepository: Repository<TrainingManualDownload>,
        @InjectRepository(CourseMaterialView)
        private readonly materialViewRepository: Repository<CourseMaterialView>,
        @InjectRepository(CourseMaterial)
        private readonly materialRepository: Repository<CourseMaterial>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    /**
     * Records that a learner opened a training course.
     * Admins are ignored so previewing a course does not count as learner engagement.
     */
    async recordCourseView(
        scope: OrgBranchScope,
        courseId: number,
    ): Promise<StandardResponse<{ recorded: boolean }>> {
        if (!isLearnerRole(scope.userRole)) {
            return this.skipped('Course view skipped');
        }

        const orgId = this.requireOrgId(scope);
        await this.requireCourseInOrg(courseId, orgId);
        const existing = await this.courseViewRepository.findOne({
            where: { userId: scope.userId, courseId },
        });

        if (!existing) {
            await this.courseViewRepository.save(
                this.courseViewRepository.create({
                    userId: scope.userId,
                    courseId,
                    orgId,
                    viewCount: 1,
                }),
            );
        } else {
            existing.viewCount = Number(existing.viewCount) + 1;
            await this.courseViewRepository.save(existing);
        }

        return {
            success: true,
            message: 'Course view recorded',
            data: { recorded: true },
        };
    }

    /**
     * Records a download of a known training manual.
     */
    async recordManualDownload(
        scope: OrgBranchScope,
        manualKey: string,
    ): Promise<StandardResponse<{ recorded: boolean }>> {
        if (!trainingManualTitle(manualKey)) {
            throw new BadRequestException('Unknown training manual');
        }
        if (!isLearnerRole(scope.userRole)) {
            return this.skipped('Manual download skipped');
        }

        const orgId = this.requireOrgId(scope);
        const existing = await this.manualRepository.findOne({
            where: { userId: scope.userId, manualKey },
        });

        if (!existing) {
            await this.manualRepository.save(
                this.manualRepository.create({
                    userId: scope.userId,
                    orgId,
                    manualKey,
                    downloadCount: 1,
                }),
            );
        } else {
            existing.downloadCount = Number(existing.downloadCount) + 1;
            await this.manualRepository.save(existing);
        }

        return {
            success: true,
            message: 'Manual download recorded',
            data: { recorded: true },
        };
    }

    /**
     * Lists learner engagement for the caller's organization.
     */
    async getOverview(
        scope: OrgBranchScope,
        query: EngagementOverviewQueryDto,
    ): Promise<StandardResponse<EngagementOverview>> {
        const orgId = this.requireOrgId(scope);
        const page = query.page ?? DEFAULT_PAGE;
        const limit = query.limit ?? DEFAULT_LIMIT;
        const learners = await this.loadLearners(orgId, query.search);
        const learnerIds = new Set(learners.map(learner => learner.id));
        const [courseViews, materialViews, manuals, materialTotal, courses] =
            await Promise.all([
                this.loadCourseViews(orgId, query.courseId),
                this.loadMaterialViews(orgId, query.courseId),
                this.manualRepository.find({ where: { orgId } }),
                this.countMaterials(orgId, query.courseId),
                this.loadCourses(orgId),
            ]);

        const totals = this.buildTotals(
            learnerIds,
            courseViews,
            materialViews,
            manuals,
        );
        const rows = learners
            .map(learner =>
                this.toLearnerRow(learner, totals.get(learner.id), materialTotal),
            )
            .sort((left, right) => this.compareActivity(left, right));
        const start = (page - 1) * limit;

        return {
            success: true,
            message: 'Material engagement loaded',
            data: {
                summary: this.buildSummary(rows, materialTotal),
                courses: courses.map(course => ({
                    courseId: course.courseId,
                    title: course.title,
                })),
                learners: rows.slice(start, start + limit),
                recentMaterials: this.toRecentMaterials(materialViews, learnerIds),
                total: rows.length,
                page,
                limit,
            },
        };
    }

    private async loadLearners(orgId: string, search?: string): Promise<User[]> {
        const query = this.userRepository
            .createQueryBuilder('user')
            .where('user.role IN (:...learnerRoles)', {
                learnerRoles: LEARNER_USER_ROLES,
            })
            .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
            .andWhere('user.orgId = :orgId', { orgId });

        const term = search?.trim();
        if (term) {
            query.andWhere(
                '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
                { search: `%${this.escapeLike(term)}%` },
            );
        }

        return query.orderBy('user.lastName', 'ASC').getMany();
    }

    private loadCourseViews(
        orgId: string,
        courseId?: number,
    ): Promise<CourseModuleView[]> {
        const query = this.courseViewRepository
            .createQueryBuilder('view')
            .where('view.orgId = :orgId', { orgId });
        if (courseId) {
            query.andWhere('view.courseId = :courseId', { courseId });
        }
        return query.getMany();
    }

    private loadMaterialViews(
        orgId: string,
        courseId?: number,
    ): Promise<CourseMaterialView[]> {
        const query = this.materialViewRepository
            .createQueryBuilder('view')
            .innerJoinAndSelect('view.user', 'user')
            .innerJoinAndSelect('view.material', 'material')
            .innerJoinAndSelect('view.course', 'course')
            .innerJoin('course.orgId', 'organization')
            .where('organization.id = :orgId', { orgId })
            .orderBy('view.lastViewedAt', 'DESC');
        if (courseId) {
            query.andWhere('view.courseId = :courseId', { courseId });
        }
        return query.getMany();
    }

    private countMaterials(orgId: string, courseId?: number): Promise<number> {
        const query = this.materialRepository
            .createQueryBuilder('material')
            .innerJoin('material.course', 'course')
            .innerJoin('course.orgId', 'organization')
            .where('organization.id = :orgId', { orgId })
            .andWhere('material.isActive = :active', { active: true })
            .andWhere('material.status != :deleted', {
                deleted: MaterialStatus.DELETED,
            });
        if (courseId) {
            query.andWhere('material.courseId = :courseId', { courseId });
        }
        return query.getCount();
    }

    private loadCourses(orgId: string): Promise<Course[]> {
        return this.courseRepository
            .createQueryBuilder('course')
            .innerJoin('course.orgId', 'organization')
            .where('organization.id = :orgId', { orgId })
            .andWhere('course.status != :deleted', {
                deleted: CourseStatus.DELETED,
            })
            .orderBy('course.title', 'ASC')
            .getMany();
    }

    private buildTotals(
        learnerIds: ReadonlySet<string>,
        courseViews: readonly CourseModuleView[],
        materialViews: readonly CourseMaterialView[],
        manuals: readonly TrainingManualDownload[],
    ): Map<string, LearnerTotals> {
        const totals = new Map<string, LearnerTotals>();
        const ensure = (userId: string): LearnerTotals => {
            const current = totals.get(userId);
            if (current) {
                return current;
            }
            const created: LearnerTotals = {
                coursesOpened: 0,
                lastCourseViewedAt: null,
                materialsOpened: 0,
                materialsDownloaded: 0,
                downloadedMaterialTitles: [],
                manualDownloadCount: 0,
                lastActivityAt: null,
            };
            totals.set(userId, created);
            return created;
        };

        courseViews.forEach(view => {
            if (!learnerIds.has(view.userId)) {
                return;
            }
            const row = ensure(view.userId);
            row.coursesOpened += 1;
            row.lastCourseViewedAt = this.later(row.lastCourseViewedAt, view.lastViewedAt);
            row.lastActivityAt = this.later(row.lastActivityAt, view.lastViewedAt);
        });

        materialViews.forEach(view => {
            if (!learnerIds.has(view.userId)) {
                return;
            }
            const row = ensure(view.userId);
            if (Number(view.openCount) > 0) {
                row.materialsOpened += 1;
            }
            if (Number(view.downloadCount) > 0) {
                row.materialsDownloaded += 1;
                const title = view.material?.title;
                if (title && !row.downloadedMaterialTitles.includes(title)) {
                    row.downloadedMaterialTitles.push(title);
                }
            }
            row.lastActivityAt = this.later(
                row.lastActivityAt,
                view.lastViewedAt ?? view.viewedAt,
            );
        });

        manuals.forEach(download => {
            if (!learnerIds.has(download.userId)) {
                return;
            }
            const row = ensure(download.userId);
            row.manualDownloadCount += Number(download.downloadCount);
            row.lastActivityAt = this.later(row.lastActivityAt, download.lastDownloadedAt);
        });

        return totals;
    }

    private toLearnerRow(
        learner: User,
        totals: LearnerTotals | undefined,
        materialTotal: number,
    ): LearnerEngagementRow {
        const materialsDownloaded = totals?.materialsDownloaded ?? 0;
        return {
            userId: learner.id,
            firstName: learner.firstName,
            lastName: learner.lastName,
            email: learner.email,
            coursesOpened: totals?.coursesOpened ?? 0,
            lastCourseViewedAt: this.toIso(totals?.lastCourseViewedAt),
            materialsOpened: totals?.materialsOpened ?? 0,
            materialsDownloaded,
            materialTotal,
            downloadStatus: this.downloadStatus(materialsDownloaded, materialTotal),
            downloadedMaterialTitles: totals?.downloadedMaterialTitles ?? [],
            manualDownloaded: (totals?.manualDownloadCount ?? 0) > 0,
            manualDownloadCount: totals?.manualDownloadCount ?? 0,
            lastActivityAt: this.toIso(totals?.lastActivityAt),
        };
    }

    private downloadStatus(
        downloaded: number,
        materialTotal: number,
    ): MaterialDownloadStatus {
        if (materialTotal > 0 && downloaded >= materialTotal) {
            return 'downloaded';
        }
        if (downloaded > 0) {
            return 'partial';
        }
        return 'not_downloaded';
    }

    private toRecentMaterials(
        views: readonly CourseMaterialView[],
        learnerIds: ReadonlySet<string>,
    ): MaterialActivityRow[] {
        return views
            .filter(view => learnerIds.has(view.userId))
            .slice(0, RECENT_MATERIAL_LIMIT)
            .map(view => ({
                userId: view.userId,
                firstName: view.user?.firstName ?? '',
                lastName: view.user?.lastName ?? '',
                email: view.user?.email ?? '',
                materialId: view.materialId,
                materialTitle: view.material?.title ?? 'Course material',
                courseId: view.courseId,
                courseTitle: view.course?.title ?? 'Course',
                openCount: Number(view.openCount),
                downloadCount: Number(view.downloadCount),
                lastViewedAt: this.toIso(view.lastViewedAt ?? view.viewedAt),
            }));
    }

    private buildSummary(
        rows: readonly LearnerEngagementRow[],
        materialTotal: number,
    ): EngagementOverview['summary'] {
        return {
            learnerCount: rows.length,
            learnersWhoOpenedCourse: rows.filter(row => row.coursesOpened > 0).length,
            learnersWhoOpenedMaterial: rows.filter(row => row.materialsOpened > 0).length,
            learnersWhoDownloadedMaterial: rows.filter(row => row.materialsDownloaded > 0)
                .length,
            learnersWhoDownloadedAllMaterials: rows.filter(
                row => row.downloadStatus === 'downloaded',
            ).length,
            learnersWhoDownloadedManual: rows.filter(row => row.manualDownloaded).length,
            materialTotal,
        };
    }

    private compareActivity(left: LearnerEngagementRow, right: LearnerEngagementRow): number {
        const leftTime = left.lastActivityAt ? Date.parse(left.lastActivityAt) : 0;
        const rightTime = right.lastActivityAt ? Date.parse(right.lastActivityAt) : 0;
        return rightTime - leftTime;
    }

    private async requireCourseInOrg(courseId: number, orgId: string): Promise<void> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
            relations: { orgId: true },
        });
        if (!course || course.orgId?.id !== orgId) {
            throw new ForbiddenException('You cannot record a view for this course');
        }
    }

    private requireOrgId(scope: OrgBranchScope): string {
        if (!scope.orgId) {
            throw new ForbiddenException('Your account is not assigned to an organization');
        }
        return scope.orgId;
    }

    private skipped(message: string): StandardResponse<{ recorded: boolean }> {
        return { success: true, message, data: { recorded: false } };
    }

    private later(
        current: Date | null,
        next: Date | string | null | undefined,
    ): Date | null {
        const nextTime = this.asTime(next);
        if (nextTime == null) {
            return current;
        }
        const currentTime = this.asTime(current);
        if (currentTime == null || nextTime > currentTime) {
            return new Date(nextTime);
        }
        return current;
    }

    private asTime(value: Date | string | null | undefined): number | null {
        if (!value) {
            return null;
        }
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? null : time;
    }

    private toIso(value: Date | null | undefined): string | null {
        if (!value) {
            return null;
        }
        return new Date(value).toISOString();
    }

    private escapeLike(value: string): string {
        return value.replace(/[\\%_]/g, '\\$&');
    }
}
