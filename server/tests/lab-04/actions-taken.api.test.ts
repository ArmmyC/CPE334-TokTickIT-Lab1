import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createAuthTestHarness, withAuthDatabase } from '../lab-03/auth-test-harness.js';
import {
  createDashboardTestContext,
  createDashboardTicket,
  loginDashboardUser,
} from './dashboard-api-test-support.js';
import { withIsolatedTestDatabase } from './isolated-database-test-support.js';

const actionKey = '11111111-1111-4111-8111-111111111111';

function actionPayload(overrides: Record<string, unknown> = {}) {
  return {
    actionAt: new Date(Date.now() - 60_000).toISOString(),
    description: 'Replaced the damaged power adapter.',
    result: 'The workstation starts normally.',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: 'See the existing power test report in Attachments.',
    ...overrides,
  };
}

async function createActionHarness() {
  const auth = await createAuthTestHarness();
  const staffTemplate = auth.users.get(3)!;
  const admin = {
    ...staffTemplate,
    id: 4,
    name: 'Nok Administrator',
    email: 'admin@example.test',
    role: 'ADMINISTRATOR' as const,
  };
  auth.users.set(admin.id, admin);

  const ticket = {
    id: 12,
    ticketNumber: 'TKT-2026-000012',
    ticketDate: new Date('2026-10-01T00:00:00.000Z'),
    requesterId: 1,
    ownerId: 4,
    requesterResolvedAt: null,
    requesterResolvedById: null,
    categoryId: 2,
    relatedSystemId: 5,
    summary: 'Campus Wi-Fi disconnects',
    description: 'The wireless connection drops every few minutes.',
    requestedPriority: 'HIGH',
    itPriority: 'URGENT',
    currentStatus: 'IN_PROGRESS',
    version: 0,
    lastStaffActivityAt: new Date('2026-10-01T00:00:00.000Z'),
    lastRequesterVisibleActivityAt: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
    owner: { id: 4, name: admin.name, email: admin.email, role: admin.role },
    requesterResolvedBy: null,
    category: { id: 2, name: 'Network' },
    relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
  };
  const actions = new Map<number, Record<string, any>>();
  const statusHistory: Record<string, any>[] = [];
  let nextActionId = 101;
  const userById = (id: number) => id === admin.id
    ? { id: admin.id, name: admin.name, role: admin.role }
    : { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' as const };
  const withUsers = (record: Record<string, any>) => ({
    ...record,
    performedBy: userById(record.performedById),
    updatedBy: userById(record.updatedById),
  });
  const actionTaken = {
    findUnique: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      const compound = where.performedById_idempotencyKey;
      const record = compound
        ? [...actions.values()].find((candidate) =>
            candidate.performedById === compound.performedById
            && candidate.idempotencyKey === compound.idempotencyKey)
        : [...actions.values()].find((candidate) => candidate.id === where.id);
      return record ? withUsers(record) : null;
    }),
    findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => {
      const record = actions.get(where.id);
      return record && record.ticketId === where.ticketId ? withUsers(record) : null;
    }),
    findMany: vi.fn(async ({ where }: { where: { ticketId: number } }) =>
      [...actions.values()]
        .filter((record) => record.ticketId === where.ticketId)
        .sort((a, b) => a.actionAt.getTime() - b.actionAt.getTime() || a.id - b.id)
        .map(withUsers)),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const record = {
        id: nextActionId++,
        ...data,
        version: data.version ?? 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      actions.set(record.id, record);
      return withUsers(record);
    }),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: Record<string, any> }) => {
      const record = actions.get(where.id);
      if (!record) throw new Error('Action Taken fixture not found.');
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null && 'increment' in value) {
          record[key] += (value as { increment: number }).increment;
        } else {
          record[key] = value;
        }
      }
      record.updatedAt = data.updatedAt ?? new Date();
      return withUsers(record);
    }),
  };
  const ticketFindUnique = vi.fn(async ({ where }: { where: { id: number } }) =>
    where.id === ticket.id ? ticket : null);
  const ticketUpdate = vi.fn(async ({ data }: { data: Record<string, any> }) => {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && 'increment' in value) {
        (ticket as Record<string, any>)[key] += (value as { increment: number }).increment;
      } else {
        (ticket as Record<string, any>)[key] = value;
      }
    }
    ticket.updatedAt = new Date();
    return ticket;
  });
  const database = withAuthDatabase({
    ticket: { findUnique: ticketFindUnique, update: ticketUpdate },
    actionTaken,
    $queryRaw: vi.fn(async () => [{ id: ticket.id }]),
    $transaction: vi.fn(async (callback: (transaction: Record<string, any>) => Promise<unknown>) =>
      callback(database as unknown as Record<string, any>)),
    attachment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    publicComment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    internalNote: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ticketStatusHistory: {
      findMany: vi.fn(async () => [...statusHistory]),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const record = {
          id: statusHistory.length + 1,
          ...data,
          actor: userById(data.actorId),
        };
        statusHistory.push(record);
        return record;
      }),
    },
  }, auth.database);
  const app = createApp(database as never);

  return {
    ...auth,
    app,
    admin,
    ticket,
    actions,
    statusHistory,
    actionTaken,
    ticketFindUnique,
    ticketUpdate,
  };
}

describe('Lab 4 Actions Taken API', () => {
  it('invalidates a stale Ticket status form after an Action Taken write', async () => {
    const harness = await createActionHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');
    const created = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(actionPayload());
    expect(created.status).toBe(201);
    expect(harness.ticket.version).toBe(1);

    const staleStatus = await staff.agent
      .patch('/api/staff/tickets/12/status')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ expectedVersion: 0, nextStatus: 'WAITING_FOR_REQUESTER' });

    expect(staleStatus.status).toBe(409);
    expect(staleStatus.body).toMatchObject({
      code: 'TICKET_VERSION_CONFLICT',
      currentStatus: 'IN_PROGRESS',
      currentVersion: 1,
    });
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.statusHistory).toHaveLength(0);
  });

  it('uses the authenticated performer independently of the Ticket Owner and exposes requester-safe reads', async () => {
    const harness = await createActionHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const created = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(actionPayload());

    expect(created.status).toBe(201);
    expect(created.body.actionTaken).toMatchObject({
      ticketId: 12,
      performedBy: { id: 3, role: 'IT_STAFF' },
      updatedBy: { id: 3, role: 'IT_STAFF' },
      followUpRequired: false,
      followUpCompleted: false,
      version: 1,
    });
    expect(harness.ticket.ownerId).toBe(4);
    expect(harness.ticket.version).toBe(1);

    const requester = await harness.login(harness.app);
    const detail = await requester.agent.get('/api/tickets/12');
    expect(detail.status).toBe(200);
    expect(detail.body.ticket.actionsTaken).toHaveLength(1);
    expect(detail.body.ticket.actionsTaken[0]).toMatchObject({
      id: created.body.actionTaken.id,
      performedBy: { id: 3, name: 'Somsak Staff' },
    });
    expect(detail.body.ticket.actionsTaken[0]).not.toHaveProperty('updatedBy');
  });

  it('enforces authenticated roles, CSRF, ownership, and server-owned identity fields', async () => {
    const harness = await createActionHarness();
    const payload = actionPayload();

    const anonymous = await request(harness.app)
      .post('/api/staff/tickets/12/actions')
      .set('Idempotency-Key', actionKey)
      .send(payload);
    expect(anonymous.status).toBe(401);

    const requester = await harness.login(harness.app);
    const forbiddenWrite = await requester.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', requester.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(payload);
    expect(forbiddenWrite.status).toBe(403);

    const staff = await harness.login(harness.app, 'somsak@example.test');
    const missingCsrf = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('Idempotency-Key', actionKey)
      .send(payload);
    expect(missingCsrf.status).toBe(403);

    const forgedIdentity = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send({ ...payload, performedById: 4, updatedById: 4, ownerId: 3 });
    expect(forgedIdentity.status).toBe(400);
    expect(harness.actions.size).toBe(0);
  });

  it('returns the edited current row for an exact create replay and rejects mismatched key reuse', async () => {
    const harness = await createActionHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');
    const original = actionPayload({ followUpRequired: true, followUpNote: 'Check battery health next week.' });

    const created = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(original);
    expect(created.status).toBe(201);

    const admin = await harness.login(harness.app, 'admin@example.test');
    const updated = await admin.agent
      .patch(`/api/staff/tickets/12/actions/${created.body.actionTaken.id}`)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({
        expectedVersion: 1,
        ...original,
        description: 'Replaced the adapter and confirmed stable power.',
        followUpCompleted: true,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.actionTaken).toMatchObject({
      description: 'Replaced the adapter and confirmed stable power.',
      followUpRequired: true,
      followUpCompleted: true,
      performedBy: { id: 3 },
      updatedBy: { id: 4, role: 'ADMINISTRATOR' },
      version: 2,
    });

    const replay = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(original);
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.actionTaken).toMatchObject({
      id: created.body.actionTaken.id,
      description: 'Replaced the adapter and confirmed stable power.',
      version: 2,
    });
    expect(harness.actions.size).toBe(1);

    const reused = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(actionPayload({ result: 'A different result.' }));
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('locks changed writes on terminal Tickets, returns stale conflicts, and accepts an identical no-op retry', async () => {
    const harness = await createActionHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');
    const created = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(actionPayload());
    expect(created.status).toBe(201);

    const original = harness.actions.get(created.body.actionTaken.id)!;
    harness.ticket.currentStatus = 'RESOLVED';
    const changed = await staff.agent
      .patch(`/api/staff/tickets/12/actions/${original.id}`)
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ expectedVersion: 1, ...actionPayload({ description: 'Corrected description.' }), followUpCompleted: false });
    expect(changed.status).toBe(409);
    expect(changed.body.code).toBe('ACTION_TAKEN_LOCKED');
    expect(original.description).toBe('Replaced the damaged power adapter.');

    harness.ticket.currentStatus = 'IN_PROGRESS';
    const stale = await staff.agent
      .patch(`/api/staff/tickets/12/actions/${original.id}`)
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ expectedVersion: 9, ...actionPayload({ description: 'Corrected description.' }), followUpCompleted: false });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('ACTION_TAKEN_VERSION_CONFLICT');
    expect(original.description).toBe('Replaced the damaged power adapter.');

    harness.ticket.currentStatus = 'CLOSED';
    const noOp = await staff.agent
      .patch(`/api/staff/tickets/12/actions/${original.id}`)
      .set('X-CSRF-Token', staff.csrfToken)
      .send({
        expectedVersion: 9,
        actionAt: original.actionAt.toISOString(),
        description: original.description,
        result: original.result,
        followUpRequired: original.followUpRequired,
        followUpCompleted: original.followUpCompleted,
        followUpNote: original.followUpNote,
        attachmentNotes: original.attachmentNotes,
      });
    expect(noOp.status).toBe(200);
    expect(noOp.body.replayed).toBe(true);
    expect(original.version).toBe(1);
    expect(harness.ticket.version).toBe(1);

    harness.ticket.currentStatus = 'REOPENED';
    const afterReopen = await staff.agent
      .patch(`/api/staff/tickets/12/actions/${original.id}`)
      .set('X-CSRF-Token', staff.csrfToken)
      .send({
        expectedVersion: 1,
        ...actionPayload({ description: 'Corrected after reopening.' }),
        followUpCompleted: false,
      });
    expect(afterReopen.status).toBe(200);
    expect(afterReopen.body.actionTaken).toMatchObject({
      description: 'Corrected after reopening.',
      version: 2,
    });
    expect(harness.ticket.version).toBe(2);
  });

  it('locks creation in terminal statuses and allows it after reopening', async () => {
    const harness = await createActionHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    for (const currentStatus of ['RESOLVED', 'CLOSED', 'CANCELLED']) {
      harness.ticket.currentStatus = currentStatus;
      const locked = await staff.agent
        .post('/api/staff/tickets/12/actions')
        .set('X-CSRF-Token', staff.csrfToken)
        .set('Idempotency-Key', actionKey)
        .send(actionPayload());
      expect(locked.status).toBe(409);
      expect(locked.body.code).toBe('ACTION_TAKEN_LOCKED');
    }
    expect(harness.actions.size).toBe(0);

    harness.ticket.currentStatus = 'REOPENED';
    const reopened = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', actionKey)
      .send(actionPayload());
    expect(reopened.status).toBe(201);
    expect(reopened.body.actionTaken.performedBy.id).toBe(3);
    expect(harness.actions.size).toBe(1);
  });

  it('hides a foreign Ticket from Requester detail reads and rejects malformed idempotency keys', async () => {
    const harness = await createActionHarness();
    const requester = await harness.login(harness.app, 'mali@example.test');
    const foreignDetail = await requester.agent.get('/api/tickets/12');
    expect(foreignDetail.status).toBe(404);
    expect(foreignDetail.body.code).toBe('TICKET_NOT_FOUND');

    const staff = await harness.login(harness.app, 'somsak@example.test');
    const missingKey = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .send(actionPayload());
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.code).toBe('VALIDATION_FAILED');

    const malformedKey = await staff.agent
      .post('/api/staff/tickets/12/actions')
      .set('X-CSRF-Token', staff.csrfToken)
      .set('Idempotency-Key', 'not-a-uuid')
      .send(actionPayload());
    expect(malformedKey.status).toBe(400);
    expect(harness.actions.size).toBe(0);
  });

  it('serializes concurrent create retries and stale Action Taken edits in PostgreSQL', async () => {
    await withIsolatedTestDatabase(async (database) => {
      const context = await createDashboardTestContext(database as never);
      const ticket = await createDashboardTicket(context, {
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        requesterActivityAt: new Date(),
        staffActivityAt: new Date(),
      });
      const [firstStaff, secondStaff] = await Promise.all([
        loginDashboardUser(context, context.users.staff),
        loginDashboardUser(context, context.users.staff),
      ]);
      const key = randomUUID();
      const payload = actionPayload();
      const createRequest = (staff: typeof firstStaff) => staff.agent
        .post(`/api/staff/tickets/${ticket.id}/actions`)
        .set('X-CSRF-Token', staff.csrfToken)
        .set('Idempotency-Key', key)
        .send(payload);

      const created = await Promise.all([createRequest(firstStaff), createRequest(secondStaff)]);
      expect(created.map(({ status }) => status).sort()).toEqual([200, 201]);
      const replay = created.find(({ status }) => status === 200);
      const original = created.find(({ status }) => status === 201);
      expect(replay?.body.replayed).toBe(true);
      expect(replay?.body.actionTaken.id).toBe(original?.body.actionTaken.id);

      const actionId = original?.body.actionTaken.id as number;
      const editRequest = (staff: typeof firstStaff, description: string) => staff.agent
        .patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`)
        .set('X-CSRF-Token', staff.csrfToken)
        .send({
          expectedVersion: 1,
          ...payload,
          followUpCompleted: false,
          description,
        });
      const edits = await Promise.all([
        editRequest(firstStaff, 'Concurrent edit from the first Staff session.'),
        editRequest(secondStaff, 'Concurrent edit from the second Staff session.'),
      ]);

      expect(edits.map(({ status }) => status).sort()).toEqual([200, 409]);
      const conflict = edits.find(({ status }) => status === 409);
      expect(conflict?.body.code).toBe('ACTION_TAKEN_VERSION_CONFLICT');
      const storedAction = await database.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
      expect(storedAction.version).toBe(2);
      expect([
        'Concurrent edit from the first Staff session.',
        'Concurrent edit from the second Staff session.',
      ]).toContain(storedAction.description);
      const storedTicket = await database.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: { version: true },
      });
      expect(storedTicket.version).toBe(2);
    });
  }, 90_000);
});
