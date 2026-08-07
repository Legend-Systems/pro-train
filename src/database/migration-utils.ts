import type { QueryRunner } from 'typeorm';

/** Returns true when a table exists in the current database schema. */
export async function tableExists(
    queryRunner: QueryRunner,
    tableName: string,
): Promise<boolean> {
    const rows: Array<{ cnt: string }> = await queryRunner.query(
        `
        SELECT COUNT(*) AS cnt
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        `,
        [tableName],
    );

    return Number(rows[0]?.cnt ?? 0) > 0;
}

/** Returns true when a column exists on a table in the current database schema. */
export async function columnExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
): Promise<boolean> {
    const rows: Array<{ cnt: string }> = await queryRunner.query(
        `
        SELECT COUNT(*) AS cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        `,
        [tableName, columnName],
    );

    return Number(rows[0]?.cnt ?? 0) > 0;
}
