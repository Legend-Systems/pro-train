import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists } from '../database/migration-utils';

/**
 * Columns TypeORM creates for ManyToOne relations that have no `@JoinColumn`.
 * The build currently on Render still selects these names. They stay nullable so
 * inserts from the corrected entity, which writes `testId`, `invitedBy`, and
 * `orgId` instead, are not rejected.
 */
const LEGACY_RELATION_COLUMNS: ReadonlyArray<{
    readonly name: string;
    readonly definition: string;
}> = [
    { name: 'testTestId', definition: 'int NULL' },
    { name: 'inviterId', definition: 'varchar(36) NULL' },
    { name: 'organizationId', definition: 'varchar(36) NULL' },
];

/**
 * Adds the implicit relation columns the undeployed entity still queries.
 */
export class AddTestInvitationRelationColumns1741600000000
    implements MigrationInterface
{
    name = 'AddTestInvitationRelationColumns1741600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const column of LEGACY_RELATION_COLUMNS) {
            if (await columnExists(queryRunner, 'test_invitations', column.name)) {
                continue;
            }

            await queryRunner.query(
                `ALTER TABLE \`test_invitations\` ADD \`${column.name}\` ${column.definition}`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const column of [...LEGACY_RELATION_COLUMNS].reverse()) {
            if (
                !(await columnExists(
                    queryRunner,
                    'test_invitations',
                    column.name,
                ))
            ) {
                continue;
            }

            await queryRunner.query(
                `ALTER TABLE \`test_invitations\` DROP COLUMN \`${column.name}\``,
            );
        }
    }
}
