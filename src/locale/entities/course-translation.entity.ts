import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Course } from '../../course/entities/course.entity';

@Entity('course_translations')
@Unique('UQ_course_translations_course_locale', ['courseId', 'locale'])
@Index('IDX_course_translations_course', ['courseId'])
export class CourseTranslation {
    @PrimaryGeneratedColumn({ name: 'translationId' })
    translationId: number;

    @Column({ name: 'courseId' })
    courseId: number;

    @Column({ type: 'varchar', length: 10 })
    locale: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    title?: string | null;

    @Column({ type: 'text', nullable: true })
    description?: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
    course?: Course;
}
