import { existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from '../../../scripts/test-db-guard.mjs';
import { verifyPassword } from '../../src/auth/password.js';
import { LEGACY_MIGRATION_PLACEHOLDER_HASH, legacyInitialPassword } from '../../src/lib/lab-03-credentials.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(testDirectory, '../..');
const repositoryRoot = path.resolve(serverDirectory, '..');
const migrationsDirectory = path.join(serverDirectory, 'prisma', 'migrations');
const legacyMigrationNames = [
  '20260813000000_lab_01_foundation',
  '20260821070937_lab_02_data_model',
] as const;
const lab3MigrationName = '20260908000000_lab_03_authentication';

function getDedicatedTestDatabaseUrl() {
  const envPath = path.join(repositoryRoot, '.env.test');
  if (!existsSync(envPath)) {
    throw new Error('Migration regression test requires an uncommitted .env.test file.');
  }
  const parsed = parse(readFileSync(envPath, 'utf8'));
  return assertTestDatabaseUrl(parsed.DATABASE_URL).toString();
}

function createSchemaDatabaseUrl(databaseUrl: string, schemaName: string) {
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set('schema', schemaName);
  return isolatedUrl.toString();
}

async function createTemporaryMigrationSet() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'toktickit-lab3-migration-'));
  const temporaryMigrationsDirectory = path.join(temporaryRoot, 'migrations');
  await mkdir(temporaryMigrationsDirectory, { recursive: true });
  await writeFile(
    path.join(temporaryMigrationsDirectory, 'migration_lock.toml'),
    'provider = "postgresql"\n',
    'utf8',
  );
  await writeFile(
    path.join(temporaryRoot, 'schema.prisma'),
    [
      'generator client {',
      '  provider = "prisma-client-js"',
      '}',
      '',
      'datasource db {',
      '  provider = "postgresql"',
      '  url      = env("DATABASE_URL")',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  return temporaryRoot;
}

async function copyMigration(temporaryRoot: string, migrationName: string) {
  const destinationDirectory = path.join(temporaryRoot, 'migrations', migrationName);
  await mkdir(destinationDirectory, { recursive: true });
  await copyFile(
    path.join(migrationsDirectory, migrationName, 'migration.sql'),
    path.join(destinationDirectory, 'migration.sql'),
  );
}

function runPrismaDeploy(temporaryRoot: string, databaseUrl: string) {
  const command = process.platform === 'win32' ? process.execPath : 'npx';
  const prefix = process.platform === 'win32'
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    : [];
  const result = spawnSync(
    command,
    [...prefix, 'prisma', 'migrate', 'deploy', '--schema', path.join(temporaryRoot, 'schema.prisma')],
    {
      cwd: serverDirectory,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
      encoding: 'utf8',
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
    throw new Error(`Temporary migration deployment failed with status ${result.status}. ${output}`);
  }
}

function runCredentialRepair(databaseUrl: string) {
  const command = process.platform === 'win32' ? process.execPath : 'npx';
  const prefix = process.platform === 'win32'
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    : [];
  const result = spawnSync(
    command,
    [...prefix, 'tsx', 'prisma/migrate-lab3-credentials.ts'],
    {
      cwd: serverDirectory,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      encoding: 'utf8',
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
    throw new Error(`Credential repair failed with status ${result.status}. ${output}`);
  }
}

describe('Lab 3 legacy data migration', () => {
  it('preserves Ticket and Attachment data while converting an arbitrary legacy Requester id', async () => {
    const baseDatabaseUrl = getDedicatedTestDatabaseUrl();
    const schemaName = `lab3_migration_${randomUUID().replaceAll('-', '')}`;
    const isolatedDatabaseUrl = createSchemaDatabaseUrl(baseDatabaseUrl, schemaName);
    const admin = new PrismaClient({ datasources: { db: { url: baseDatabaseUrl } } });
    const database = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl } } });
    let temporaryRoot: string | undefined;

    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
      temporaryRoot = await createTemporaryMigrationSet();
      for (const migrationName of legacyMigrationNames) {
        await copyMigration(temporaryRoot, migrationName);
      }
      runPrismaDeploy(temporaryRoot, isolatedDatabaseUrl);

      const fixture = {
        categoryId: 1001,
        relatedSystemId: 1002,
        requesterId: 4242,
        ticketId: 5001,
        attachmentId: 6001,
      };
      await database.$executeRawUnsafe(`
        INSERT INTO "Category" ("id", "name")
        VALUES (${fixture.categoryId}, 'Migration Category')
      `);
      await database.$executeRawUnsafe(`
        INSERT INTO "RelatedSystem" ("id", "name", "isActive", "createdAt", "updatedAt")
        VALUES (${fixture.relatedSystemId}, 'Migration Portal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      await database.$executeRawUnsafe(`
        INSERT INTO "DevelopmentRequester" ("id", "name", "email", "isActive", "createdAt", "updatedAt")
        VALUES (
          ${fixture.requesterId}, 'Legacy User', ' Legacy.User@Example.Test ', true,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);
      await database.$executeRawUnsafe(`
        INSERT INTO "Ticket" (
          "id", "ticketNumber", "ticketDate", "requesterId", "categoryId", "relatedSystemId",
          "summary", "description", "requestedPriority", "currentStatus", "createdAt", "updatedAt"
        ) VALUES (
          ${fixture.ticketId}, 'MIG-04242', CURRENT_TIMESTAMP, ${fixture.requesterId},
          ${fixture.categoryId}, ${fixture.relatedSystemId}, 'Legacy migration ticket',
          'This row must survive the Lab 3 identity migration.', 'HIGH', 'NEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);
      await database.$executeRawUnsafe(`
        INSERT INTO "Attachment" (
          "id", "ticketId", "originalName", "storageKey", "mimeType", "sizeBytes", "uploadedAt"
        ) VALUES (
          ${fixture.attachmentId}, ${fixture.ticketId}, 'legacy.txt', 'legacy-migration-key',
          'text/plain', 42, CURRENT_TIMESTAMP
        )
      `);

      const beforeTickets = await database.$queryRawUnsafe<Array<{
        id: number;
        ticketNumber: string;
        requesterId: number;
      }>>(`
        SELECT "id", "ticketNumber", "requesterId"
        FROM "Ticket"
        WHERE "id" = ${fixture.ticketId}
      `);
      const beforeAttachments = await database.$queryRawUnsafe<Array<{
        id: number;
        ticketId: number;
        storageKey: string;
        sizeBytes: number;
      }>>(`
        SELECT "id", "ticketId", "storageKey", "sizeBytes"
        FROM "Attachment"
        WHERE "id" = ${fixture.attachmentId}
      `);
      const beforeTicketCount = Number((await database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS "count" FROM "Ticket"',
      ))[0]?.count ?? 0);
      const beforeAttachmentCount = Number((await database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS "count" FROM "Attachment"',
      ))[0]?.count ?? 0);

      await copyMigration(temporaryRoot, lab3MigrationName);
      runPrismaDeploy(temporaryRoot, isolatedDatabaseUrl);
      runCredentialRepair(isolatedDatabaseUrl);

      const afterTickets = await database.$queryRawUnsafe<Array<{
        id: number;
        ticketNumber: string;
        requesterId: number;
      }>>(`
        SELECT "id", "ticketNumber", "requesterId"
        FROM "Ticket"
        WHERE "id" = ${fixture.ticketId}
      `);
      const afterAttachments = await database.$queryRawUnsafe<Array<{
        id: number;
        ticketId: number;
        storageKey: string;
        sizeBytes: number;
      }>>(`
        SELECT "id", "ticketId", "storageKey", "sizeBytes"
        FROM "Attachment"
        WHERE "id" = ${fixture.attachmentId}
      `);
      const afterTicketCount = Number((await database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS "count" FROM "Ticket"',
      ))[0]?.count ?? 0);
      const afterAttachmentCount = Number((await database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS "count" FROM "Attachment"',
      ))[0]?.count ?? 0);
      const migratedUser = await database.user.findUnique({
        where: { id: fixture.requesterId },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      });
      const legacyTable = await database.$queryRawUnsafe<Array<{ relation: string | null }>>(
        `SELECT to_regclass('DevelopmentRequester')::text AS "relation"`,
      );

      expect(beforeTickets).toEqual([{
        id: fixture.ticketId,
        ticketNumber: 'MIG-04242',
        requesterId: fixture.requesterId,
      }]);
      expect(beforeAttachments).toEqual([{
        id: fixture.attachmentId,
        ticketId: fixture.ticketId,
        storageKey: 'legacy-migration-key',
        sizeBytes: 42,
      }]);
      expect(afterTicketCount).toBe(beforeTicketCount);
      expect(afterAttachmentCount).toBe(beforeAttachmentCount);
      expect(afterTickets).toEqual(beforeTickets);
      expect(afterAttachments).toEqual(beforeAttachments);
      expect(legacyTable[0]?.relation).toBeNull();
      expect(migratedUser).toMatchObject({
        id: fixture.requesterId,
        email: 'legacy.user@example.test',
        role: 'REQUESTER',
        isActive: true,
        mustChangePassword: true,
      });
      expect(migratedUser?.passwordHash).not.toBe(LEGACY_MIGRATION_PLACEHOLDER_HASH);
      expect(await verifyPassword(
        legacyInitialPassword(fixture.requesterId),
        migratedUser!.passwordHash,
      )).toBe(true);
    } finally {
      await database.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
      await admin.$disconnect();
      if (temporaryRoot) {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    }
  }, 30_000);
});
