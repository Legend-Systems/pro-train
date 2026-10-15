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

import { Organization } from '../../org/entities/org.entity';

/**
 * One weak-skill module assigned to a learner after the Digital Skills survey.
 *
 * Rows are replaced when the learner submits a new self-assessment.
 */
@Entity('digital_skills_assignments')
@Unique('UQ_DIGITAL_SKILLS_ASSIGNMENT_USER_SKILL', ['userId', 'skillKey'])
@Index('IDX_DIGITAL_SKILLS_ASSIGNMENT_USER', ['userId'])
export class DigitalSkillsAssignment {
    @PrimaryGeneratedColumn()
    assignmentId: number;

    @Column('uuid')
    userId: string;

    @Column({ length: 80 })
    skillKey: string;

    @Column({ length: 255 })
    skillTitle: string;

    @Column({ length: 80 })
    skillGroup: string;

    @Column({ type: 'int' })
    level: number;

    @Column({ type: 'int', nullable: true })
    materialId?: number | null;

    @Column({ type: 'int', nullable: true })
    testId?: number | null;

    @Column({ type: 'int' })
    assignedFromResultId: number;

    /** Calendar day the learner is expected to finish this booked check. */
    @Column({ type: 'datetime', nullable: true })
    expectedDueDate?: Date | null;

    /** Set after the booking email for this row is queued. Prevents duplicates. */
    @Column({ type: 'datetime', nullable: true })
    bookingNotifiedAt?: Date | null;

    @CreateDateColumn()
    assignedAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @JoinColumn({ name: 'orgId' })
    orgId: Organization;
}
