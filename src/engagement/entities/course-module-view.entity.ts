import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';

/**
 * Records that a learner opened a training course.
 * One row per user and course.
 */
@Entity('course_module_views')
@Unique('UQ_course_module_view_user_course', ['userId', 'courseId'])
@Index('IDX_course_module_view_org', ['orgId'])
export class CourseModuleView {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('uuid')
    userId: string;

    @Column()
    courseId: number;

    @Column('uuid')
    orgId: string;

    @CreateDateColumn()
    firstViewedAt: Date;

    @UpdateDateColumn()
    lastViewedAt: Date;

    @Column({ type: 'int', default: 1 })
    viewCount: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'courseId' })
    course: Course;
}
