import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { parse } from 'dotenv';
import { assertTestDatabaseUrl } from '../../../scripts/test-db-guard.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(testDirectory, '../..');
const repositoryRoot = path.resolve(serverDirectory, '..');

function getDedicatedTestDatabaseUrl(): string {
  const envPath = path.join(repositoryRoot, '.env.test');
  if (!existsSync(envPath)) {
    throw new Error('Lab 4 database concurrency tests require an uncommitted .env.test file.');
  }
  const parsed = parse(readFileSync(envPath, 'utf8'));
  return assertTestDatabaseUrl(parsed.DATABASE_URL).toString();
}

function createSchemaDatabaseUrl(databaseUrl: string, schemaName: string): string {
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set('schema', schemaName);
  return isolatedUrl.toString();
}

function deployMigrations(databaseUrl: string): void {
  const command = process.platform === 'win32' ? process.execPath : 'npx';
  const prefix = process.platform === 'win32'
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    : [];
  const result = spawnSync(
    command,
    [...prefix, 'prisma', 'migrate', 'deploy', '--schema', path.join(serverDirectory, 'prisma', 'schema.prisma')],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
      encoding: 'utf8',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
    throw new Error(`Isolated test schema migration failed with status ${result.status}. ${output}`);
  }
}

export async function withIsolatedTestDatabase<T>(
  run: (database: PrismaClient) => Promise<T>,
): Promise<T> {
  const databaseUrl = getDedicatedTestDatabaseUrl();
  const schemaName = `lab4_concurrency_${randomUUID().replaceAll('-', '')}`;
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const isolatedUrl = createSchemaDatabaseUrl(databaseUrl, schemaName);
  let schemaCreated = false;
  let database: PrismaClient | undefined;

  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    deployMigrations(isolatedUrl);
    database = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
    return await run(database);
  } finally {
    await database?.$disconnect();
    if (schemaCreated) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
    }
    await admin.$disconnect();
  }
}
