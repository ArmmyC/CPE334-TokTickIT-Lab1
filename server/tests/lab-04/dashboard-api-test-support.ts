import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type Prisma } from '@prisma/client';
import { config } from 'dotenv';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/password.js';
import { getCookie } from '../lab-03/auth-test-harness.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '../..', '..');
config({ path: path.join(repositoryRoot, '.env.test'), override: true, quiet: true });

export const dashboardTestDatabase = new PrismaClient();
export const DASHBOARD_TEST_PASSWORD = 'Dashboard-Test-Password-1!';
const passwordHash = hashPassword(DASHBOARD_TEST_PASSWORD);
const rollbackMarker = new Error('Rollback dashboard API test transaction.');

export type DashboardStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type DashboardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;

export async function createDashboardTestContext(transaction: Prisma.TransactionClient) {
  const prefix = randomUUID();
  const hash = await passwordHash;
  const roles = {
    requester: ['Requester Dashboard Test', 'REQUESTER'],
    otherRequester: ['Other Requester Dashboard Test', 'REQUESTER'],
    staff: ['Staff Dashboard Test', 'IT_STAFF'],
    otherStaff: ['Other Staff Dashboard Test', 'IT_STAFF'],
    admin: ['Admin Dashboard Test', 'ADMINISTRATOR'],
  } as const;
  const users = {} as Record<keyof typeof roles, {
    id: number;
    name: string;
    email: string;
    role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  }>;

  for (const [key, [name, role]] of Object.entries(roles) as Array<[
    keyof typeof roles,
    (typeof roles)[keyof typeof roles]
  ]>) {
    users[key] = await transaction.user.create({
      data: {
        name,
        email: `lab4-dashboard-${key}-${prefix}@example.test`,
        passwordHash: hash,
        role,
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  const category = await transaction.category.create({
    data: { name: `Lab 4 dashboard category ${prefix}` },
  });
  const relatedSystem = await transaction.relatedSystem.create({
    data: { name: `Lab 4 dashboard system ${prefix}` },
  });

  return {
    database: transaction,
    app: createApp(transaction as never),
    users,
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
  };
}

export type DashboardTestContext = Awaited<ReturnType<typeof createDashboardTestContext>>;

export async function withDashboardTestTransaction<T>(
  run: (context: DashboardTestContext) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await dashboardTestDatabase.$transaction(async (transaction) => {
      const context = await createDashboardTestContext(transaction);
      result = await run(context);
      throw rollbackMarker;
    }, { isolationLevel: 'RepeatableRead', maxWait: 10_000, timeout: 90_000 });
  } catch (error) {
    if (error !== rollbackMarker) throw error;
  }
  return result!;
}

export async function loginDashboardUser(
  context: DashboardTestContext,
  user: DashboardTestContext['users'][keyof DashboardTestContext['users']],
) {
  const agent = request.agent(context.app);
  const response = await agent.post('/api/auth/login').send({
    email: user.email,
    password: DASHBOARD_TEST_PASSWORD,
  });
  if (response.status !== 200) {
    throw new Error(`Dashboard test login failed with status ${response.status}.`);
  }
  return { agent, csrfToken: getCookie(response, 'toktickit_csrf') };
}

export async function createDashboardTicket(
  context: DashboardTestContext,
  options: {
    requesterId?: number;
    ownerId?: number | null;
    status: DashboardStatus;
    priority: DashboardPriority;
    requesterActivityAt: Date;
    staffActivityAt: Date;
    ticketNumber?: string;
    summary?: string;
    createdAt?: Date;
  },
) {
  const createdAt = options.createdAt ?? options.requesterActivityAt;
  return context.database.ticket.create({
    data: {
      ticketNumber: options.ticketNumber ?? `L4-${randomUUID().replaceAll('-', '').slice(0, 29)}`,
      ticketDate: createdAt,
      requesterId: options.requesterId ?? context.users.requester.id,
      ownerId: options.ownerId ?? null,
      categoryId: context.categoryId,
      relatedSystemId: context.relatedSystemId,
      summary: options.summary ?? 'Dashboard fixture ticket',
      description: 'Ticket created by an isolated dashboard API test.',
      requestedPriority: 'MEDIUM',
      itPriority: options.priority,
      currentStatus: options.status,
      version: 0,
      lastStaffActivityAt: options.staffActivityAt,
      lastRequesterVisibleActivityAt: options.requesterActivityAt,
      createdAt,
      updatedAt: options.staffActivityAt,
    },
  });
}

export async function createDashboardAction(
  context: DashboardTestContext,
  options: {
    ticketId: number;
    performedById: number;
    actionAt: Date;
    result: string;
    followUpRequired?: boolean;
  },
) {
  return context.database.actionTaken.create({
    data: {
      ticketId: options.ticketId,
      actionAt: options.actionAt,
      description: 'Dashboard action fixture',
      result: options.result,
      performedById: options.performedById,
      followUpRequired: options.followUpRequired ?? false,
      followUpCompleted: false,
      followUpNote: options.followUpRequired ? 'Check that this remains stable.' : null,
      attachmentNotes: null,
      idempotencyKey: randomUUID(),
      idempotencyPayloadHash: 'a'.repeat(64),
      version: 1,
      updatedById: options.performedById,
    },
  });
}

export async function createDashboardStatusEvent(
  context: DashboardTestContext,
  options: {
    ticketId: number;
    fromStatus: DashboardStatus | null;
    toStatus: DashboardStatus;
    eventKind: 'INITIAL' | 'TRANSITION' | 'LEGACY_BASELINE';
    actorId: number | null;
    createdAt: Date;
  },
) {
  return context.database.ticketStatusHistory.create({ data: options });
}

export async function createDashboardInternalNote(
  context: DashboardTestContext,
  ticketId: number,
  authorId: number,
  createdAt: Date,
) {
  return context.database.internalNote.create({
    data: { ticketId, authorId, content: 'CONFIDENTIAL dashboard fixture note.', createdAt },
  });
}
