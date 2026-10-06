import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
    CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { CourseMaterial } from '../../course-materials/entities/course-material.entity';
import { Course } from '../../course/entities/course.entity';

/**
 * One row per learner and material.
 * The first insert awards XP. Later opens and downloads update the counters.
 */
@Entity('course_material_view')
@Unique('UQ_material_view_user_material', ['userId', 'materialId'])
@Index('IDX_material_view_course', ['courseId'])
@Index('IDX_material_view_user', ['userId'])
export class CourseMaterialView {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('uuid')
    userId: string;

    @Column()
    materialId: number;

    @Column()
    courseId: number;

    @CreateDateColumn()
    viewedAt: Date;

    @Column({ type: 'datetime', nullable: true })
    lastViewedAt: Date | null;

    @Column({ type: 'int', default: 0 })
    openCount: number;

    @Column({ type: 'int', default: 0 })
    downloadCount: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => CourseMaterial)
    @JoinColumn({ name: 'materialId' })
    material: CourseMaterial;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'courseId' })
    course: Course;
}
