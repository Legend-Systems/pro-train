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
 * Tracks first-time material views per user — one row per (userId, materialId).
 * Used for VIEW_COURSE_MATERIAL and COMPLETE_ALL_MATERIALS XP awards.
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
