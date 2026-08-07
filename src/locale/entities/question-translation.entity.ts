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
import { Question } from '../../questions/entities/question.entity';

@Entity('question_translations')
@Unique('UQ_question_translations_question_locale', ['questionId', 'locale'])
@Index('IDX_question_translations_question', ['questionId'])
export class QuestionTranslation {
    @PrimaryGeneratedColumn({ name: 'translationId' })
    translationId: number;

    @Column({ name: 'questionId' })
    questionId: number;

    @Column({ type: 'varchar', length: 10 })
    locale: string;

    @Column({ type: 'text', nullable: true })
    questionText?: string | null;

    @Column({ type: 'text', nullable: true })
    explanation?: string | null;

    @Column({ type: 'text', nullable: true })
    hint?: string | null;

    @Column({ type: 'text', nullable: true })
    mediaInstructions?: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Question, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'questionId', referencedColumnName: 'questionId' })
    question?: Question;
}
