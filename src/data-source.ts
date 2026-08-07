import { DataSource } from 'typeorm';

// Load .env for CLI migrations (uses dotenv from @nestjs/config dependency tree).
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: '.env' });
} catch {
    // Env vars may already be set in the shell.
}

/**
 * Standalone TypeORM DataSource for CLI migrations.
 * Mirrors AppModule connection settings — keep synchronize disabled in production.
 */
export default new DataSource({
    type: 'mysql',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    // Migrations are SQL-only — no entity loading required (avoids tsconfig path alias issues in CLI).
    entities: [],
    migrations: ['src/migrations/[0-9]*.ts'],
    // Data migrations (e.g. org-wide branchId) commit per statement — avoids long
    // lock holds and lock-wait timeouts when Workbench or the dev server is connected.
    migrationsTransactionMode: 'none',
    synchronize: false,
    logging: false,
});
