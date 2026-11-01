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

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(testDirectory, '../..');
const repositoryRoot = path.resolve(serverDirectory, '..');
const migrationsDirectory = path.join(serverDirectory, 'prisma', 'migrations');
const recoveryGuidePath = path.join(repositoryRoot, 'docs', 'lab-04', 'migration-recovery.md');
const migrationNames = [
  '20260813000000_lab_01_foundation',
  '20260821070937_lab_02_data_model',
  '20260908000000_lab_03_authentication',
  '20261029000000_lab_04_actions_taken',
] as const;
const legacy = {
  categoryId: 9201,
  relatedSystemId: 9202,
  requesterId: 9203,
  staffId: 9204,
  ticketId: 9205,
  attachmentId: 9206,
  publicCommentId: 9207,
  internalNoteId: 9208,
};

function getDedicatedTestDatabaseUrl() {
  const envPath = path.join(repositoryRoot, '.env.test');
  if (!existsSync(envPath)) {
    throw new Error('Lab 4 migration regression test requires an uncommitted .env.test file.');
  }
  const parsed = parse(readFileSync(envPath, 'utf8'));
  return assertTestDatabaseUrl(parsed.DATABASE_URL).toString();
}

function createSchemaDatabaseUrl(databaseUrl: string, schemaName: string) {
  const isolatedUrl = new URL(databaseUrl);
  isolatedUrl.searchParams.set('schema', schemaName);
  return isolatedUrl.toString();
}

async function createTemporaryMigrationRoot() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'toktickit-lab4-migration-'));
  await mkdir(path.join(temporaryRoot, 'migrations'), { recursive: true });
  await writeFile(
    path.join(temporaryRoot, 'migrations', 'migration_lock.toml'),
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

async function copyMigration(temporaryRoot: string, migrationName: string, contents?: string) {
  const destinationDirectory = path.join(temporaryRoot, 'migrations', migrationName);
  await mkdir(destinationDirectory, { recursive: true });
  const sourcePath = path.join(migrationsDirectory, migrationName, 'migration.sql');
  if (contents === undefined) {
    await copyFile(sourcePath, path.join(destinationDirectory, 'migration.sql'));
    return;
  }
  await writeFile(path.join(destinationDirectory, 'migration.sql'), contents, 'utf8');
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
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
    throw new Error(`Temporary migration deployment failed with status ${result.status}. ${output}`);
  }
}

async function copyBaseMigrations(temporaryRoot: string) {
  for (const migrationName of migrationNames.slice(0, 3)) {
    await copyMigration(temporaryRoot, migrationName);
  }
}

async function insertLegacyLab3Rows(database: PrismaClient) {
  const statements = [
    `INSERT INTO "Category" ("id", "name") VALUES (${legacy.categoryId}, 'Migration Category')`,
    `
    INSERT INTO "RelatedSystem" ("id", "name", "isActive", "createdAt", "updatedAt")
    VALUES (${legacy.relatedSystemId}, 'Migration System', true, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
    `,
    `
    INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
    VALUES
      (${legacy.requesterId}, 'Legacy Requester', 'legacy@example.test', 'test-hash', 'REQUESTER', true, false, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
      (${legacy.staffId}, 'Legacy Staff', 'staff@example.test', 'test-hash', 'IT_STAFF', true, false, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
    `,
    `
    INSERT INTO "Ticket" (
      "id", "ticketNumber", "ticketDate", "requesterId", "ownerId", "requesterResolvedAt", "requesterResolvedById",
      "categoryId", "relatedSystemId", "summary", "description", "requestedPriority", "itPriority", "currentStatus", "createdAt", "updatedAt"
    ) VALUES (
      ${legacy.ticketId}, 'MIG-09205', '2026-10-01T00:00:00Z', ${legacy.requesterId}, ${legacy.staffId},
      '2026-10-04T00:00:00Z', ${legacy.requesterId}, ${legacy.categoryId}, ${legacy.relatedSystemId},
      'Legacy Ticket', 'This business row must survive the Lab 4 migration.', 'HIGH', 'MEDIUM', 'RESOLVED',
      '2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z'
    )
    `,
    `
    INSERT INTO "Attachment" (
      "id", "ticketId", "originalName", "storageKey", "mimeType", "sizeBytes", "uploadedAt", "removedAt", "removalReason"
    ) VALUES (
      ${legacy.attachmentId}, ${legacy.ticketId}, 'legacy-report.pdf', '9206-legacy-report', 'application/pdf', 421,
      '2026-10-03T00:00:00Z', '2026-10-04T00:00:00Z', 'Removed after the report was replaced.'
    )
    `,
    `
    INSERT INTO "PublicComment" ("id", "ticketId", "authorId", "content", "createdAt")
    VALUES (${legacy.publicCommentId}, ${legacy.ticketId}, ${legacy.requesterId}, 'Public history must survive.', '2026-10-02T00:00:00Z')
    `,
    `
    INSERT INTO "InternalNote" ("id", "ticketId", "authorId", "content", "createdAt")
    VALUES (${legacy.internalNoteId}, ${legacy.ticketId}, ${legacy.staffId}, 'Private history must survive.', '2026-10-05T00:00:00Z')
    `,
  ];
  for (const statement of statements) await database.$executeRawUnsafe(statement);
}

async function prepareLab3Schema(databaseUrl: string, schemaName: string) {
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const temporaryRoot = await createTemporaryMigrationRoot();
  const isolatedUrl = createSchemaDatabaseUrl(databaseUrl, schemaName);
  const database = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
  let schemaCreated = false;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    await copyBaseMigrations(temporaryRoot);
    runPrismaDeploy(temporaryRoot, isolatedUrl);
    await insertLegacyLab3Rows(database);
    return { admin, database, temporaryRoot, isolatedUrl };
  } catch (error) {
    await database.$disconnect();
    if (schemaCreated) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
    }
    await admin.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

describe('Lab 4 migration safety', () => {
  it('preserves Lab 3 rows, backfills truthful timestamps and baselines, and protects append-only history', async () => {
    const databaseUrl = getDedicatedTestDatabaseUrl();
    const schemaName = `lab4_migration_${randomUUID().replaceAll('-', '')}`;
    let prepared: Awaited<ReturnType<typeof prepareLab3Schema>> | undefined;

    try {
      prepared = await prepareLab3Schema(databaseUrl, schemaName);
      const { admin, database, temporaryRoot, isolatedUrl } = prepared;
      const before = await database.$queryRawUnsafe<Array<{
        users: number;
        tickets: number;
        attachments: number;
        comments: number;
        notes: number;
      }>>(`
        SELECT
          (SELECT COUNT(*)::int FROM "User") AS users,
          (SELECT COUNT(*)::int FROM "Ticket") AS tickets,
          (SELECT COUNT(*)::int FROM "Attachment") AS attachments,
          (SELECT COUNT(*)::int FROM "PublicComment") AS comments,
          (SELECT COUNT(*)::int FROM "InternalNote") AS notes
      `);
      const beforeTicket = await database.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT "id", "ticketNumber", "requesterId", "ownerId", "currentStatus", "requestedPriority", "itPriority", "createdAt", "updatedAt"
        FROM "Ticket" WHERE "id" = ${legacy.ticketId}
      `);
      const beforeAttachment = await database.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT "id", "ticketId", "originalName", "storageKey", "mimeType", "sizeBytes", "uploadedAt", "removedAt", "removalReason"
        FROM "Attachment" WHERE "id" = ${legacy.attachmentId}
      `);

      await copyMigration(temporaryRoot, migrationNames[3]);
      runPrismaDeploy(temporaryRoot, isolatedUrl);

      const after = await database.$queryRawUnsafe<Array<{
        users: number;
        tickets: number;
        attachments: number;
        comments: number;
        notes: number;
      }>>(`
        SELECT
          (SELECT COUNT(*)::int FROM "User") AS users,
          (SELECT COUNT(*)::int FROM "Ticket") AS tickets,
          (SELECT COUNT(*)::int FROM "Attachment") AS attachments,
          (SELECT COUNT(*)::int FROM "PublicComment") AS comments,
          (SELECT COUNT(*)::int FROM "InternalNote") AS notes
      `);
      const afterTicket = await database.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT "id", "ticketNumber", "requesterId", "ownerId", "currentStatus", "requestedPriority", "itPriority", "createdAt", "updatedAt"
        FROM "Ticket" WHERE "id" = ${legacy.ticketId}
      `);
      const afterAttachment = await database.$queryRawUnsafe<Array<Record<string, unknown>>>(`
        SELECT "id", "ticketId", "originalName", "storageKey", "mimeType", "sizeBytes", "uploadedAt", "removedAt", "removalReason"
        FROM "Attachment" WHERE "id" = ${legacy.attachmentId}
      `);
      const activity = await database.$queryRawUnsafe<Array<{
        version: number;
        staffAt: Date;
        requesterAt: Date;
      }>>(`
        SELECT "version", "lastStaffActivityAt" AS "staffAt", "lastRequesterVisibleActivityAt" AS "requesterAt"
        FROM "Ticket" WHERE "id" = ${legacy.ticketId}
      `);
      const history = await database.$queryRawUnsafe<Array<{
        fromStatus: string | null;
        toStatus: string;
        actorId: number | null;
        eventKind: string;
      }>>(`
        SELECT "fromStatus", "toStatus", "actorId", "eventKind"
        FROM "TicketStatusHistory" WHERE "ticketId" = ${legacy.ticketId}
        ORDER BY "createdAt" ASC, "id" ASC
      `);
      const actionRows = await database.$queryRawUnsafe<Array<{ count: number }>>(`
        SELECT COUNT(*)::int AS count FROM "ActionTaken" WHERE "ticketId" = ${legacy.ticketId}
      `);

      expect(after).toEqual(before);
      expect(afterTicket).toEqual(beforeTicket);
      expect(afterAttachment).toEqual(beforeAttachment);
      expect(activity[0]).toMatchObject({
        version: 0,
        staffAt: new Date('2026-10-05T00:00:00.000Z'),
        requesterAt: new Date('2026-10-04T00:00:00.000Z'),
      });
      expect(history).toEqual([{
        fromStatus: null,
        toStatus: 'RESOLVED',
        actorId: null,
        eventKind: 'LEGACY_BASELINE',
      }]);
      expect(actionRows[0]?.count).toBe(0);

      const historyId = await database.$queryRawUnsafe<Array<{ id: number }>>(`
        SELECT "id" FROM "TicketStatusHistory" WHERE "ticketId" = ${legacy.ticketId}
      `);
      await expect(database.$executeRawUnsafe(`
        UPDATE "TicketStatusHistory" SET "toStatus" = 'CLOSED' WHERE "id" = ${historyId[0]?.id}
      `)).rejects.toThrow();
      await expect(database.$executeRawUnsafe(`
        DELETE FROM "TicketStatusHistory" WHERE "id" = ${historyId[0]?.id}
      `)).rejects.toThrow();
      const historyAfterRejectedWrites = await database.$queryRawUnsafe<Array<{
        toStatus: string;
        eventKind: string;
      }>>(`
        SELECT "toStatus", "eventKind" FROM "TicketStatusHistory" WHERE "id" = ${historyId[0]?.id}
      `);
      expect(historyAfterRejectedWrites).toEqual([{ toStatus: 'RESOLVED', eventKind: 'LEGACY_BASELINE' }]);

      const recoveryGuide = readFileSync(recoveryGuidePath, 'utf8');
      expect(recoveryGuide).toMatch(/backup/i);
      expect(recoveryGuide).toMatch(/forward.fix|forward fix/i);
      expect(recoveryGuide).toMatch(/restore/i);
    } finally {
      if (prepared) {
        await prepared.database.$disconnect();
        await prepared.admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
        await prepared.admin.$disconnect();
        await rm(prepared.temporaryRoot, { recursive: true, force: true });
      }
    }
  }, 60_000);

  it('rolls back a failed Lab 4 migration without changing legacy rows', async () => {
    const databaseUrl = getDedicatedTestDatabaseUrl();
    const schemaName = `lab4_recovery_${randomUUID().replaceAll('-', '')}`;
    let prepared: Awaited<ReturnType<typeof prepareLab3Schema>> | undefined;

    try {
      prepared = await prepareLab3Schema(databaseUrl, schemaName);
      const { admin, database, temporaryRoot, isolatedUrl } = prepared;
      const migrationSql = readFileSync(
        path.join(migrationsDirectory, migrationNames[3], 'migration.sql'),
        'utf8',
      );
      expect(migrationSql).toMatch(/COMMIT;\s*$/i);
      await copyMigration(
        temporaryRoot,
        migrationNames[3],
        migrationSql.replace(/COMMIT;\s*$/i, 'SELECT 1 / 0;\nCOMMIT;\n'),
      );
      expect(() => runPrismaDeploy(temporaryRoot, isolatedUrl)).toThrow(/Temporary migration deployment failed/);

      const versionColumn = await database.$queryRawUnsafe<Array<{ present: boolean }>>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${schemaName}' AND table_name = 'Ticket' AND column_name = 'version'
        ) AS present
      `);
      const historyTable = await database.$queryRawUnsafe<Array<{ present: boolean }>>(`
        SELECT to_regclass('"${schemaName}"."TicketStatusHistory"') IS NOT NULL AS present
      `);
      const preserved = await database.$queryRawUnsafe<Array<{
        ticketNumber: string;
        currentStatus: string;
        ownerId: number | null;
      }>>(`
        SELECT "ticketNumber", "currentStatus", "ownerId" FROM "Ticket" WHERE "id" = ${legacy.ticketId}
      `);
      expect(versionColumn[0]?.present).toBe(false);
      expect(historyTable[0]?.present).toBe(false);
      expect(preserved).toEqual([{
        ticketNumber: 'MIG-09205',
        currentStatus: 'RESOLVED',
        ownerId: legacy.staffId,
      }]);
    } finally {
      if (prepared) {
        await prepared.database.$disconnect();
        await prepared.admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
        await prepared.admin.$disconnect();
        await rm(prepared.temporaryRoot, { recursive: true, force: true });
      }
    }
  }, 60_000);
});
