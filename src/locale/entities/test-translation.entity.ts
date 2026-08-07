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
import { Test } from '../../test/entities/test.entity';

@Entity('test_translations')
@Unique('UQ_test_translations_test_locale', ['testId', 'locale'])
@Index('IDX_test_translations_test', ['testId'])
export class TestTranslation {
    @PrimaryGeneratedColumn({ name: 'translationId' })
    translationId: number;

    @Column({ name: 'testId' })
    testId: number;

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

    @ManyToOne(() => Test, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'testId', referencedColumnName: 'testId' })
    test?: Test;
}
