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
import { QuestionOption } from '../../questions_options/entities/questions_option.entity';

@Entity('question_option_translations')
@Unique('UQ_option_translations_option_locale', ['optionId', 'locale'])
@Index('IDX_option_translations_option', ['optionId'])
export class QuestionOptionTranslation {
    @PrimaryGeneratedColumn({ name: 'translationId' })
    translationId: number;

    @Column({ name: 'optionId' })
    optionId: number;

    @Column({ type: 'varchar', length: 10 })
    locale: string;

    @Column({ type: 'varchar', length: 1000, nullable: true })
    optionText?: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => QuestionOption, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'optionId', referencedColumnName: 'optionId' })
    option?: QuestionOption;
}
