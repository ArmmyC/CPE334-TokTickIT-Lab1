import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createAuthTestHarness, withAuthDatabase } from '../lab-03/auth-test-harness.js';

const fixedTime = new Date('2026-09-08T12:00:00.000Z');

function actionRecord({
  followUpRequired = false,
  followUpCompleted = false,
}: {
  followUpRequired?: boolean;
  followUpCompleted?: boolean;
} = {}) {
  return {
    id: 41,
    ticketId: 12,
    actionAt: new Date('2026-09-08T10:00:00.000Z'),
    description: 'Replaced the damaged power adapter.',
    result: 'The workstation starts normally.',
    performedBy: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
    performedById: 3,
    followUpRequired,
    followUpCompleted,
    followUpNote: followUpRequired ? 'Confirm the replacement remains stable.' : null,
    attachmentNotes: null,
    version: 1,
    createdAt: fixedTime,
    updatedAt: fixedTime,
    updatedBy: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
    updatedById: 3,
  };
}

async function createWorkflowHarness({
  currentStatus = 'IN_PROGRESS',
  version = 0,
  actions = [] as ReturnType<typeof actionRecord>[],
  history = [] as Array<Record<string, any>>,
}: {
  currentStatus?: string;
  version?: number;
  actions?: ReturnType<typeof actionRecord>[];
  history?: Array<Record<string, any>>;
} = {}) {
  const auth = await createAuthTestHarness();
  const ticket = {
    id: 12,
    ticketNumber: 'TKT-2026-000012',
    ticketDate: new Date('2026-09-08T10:00:00.000Z'),
    requesterId: 1,
    ownerId: 4,
    requesterResolvedAt: null,
    requesterResolvedById: null,
    categoryId: 2,
    relatedSystemId: 5,
    summary: 'Campus Wi-Fi disconnects',
    description: 'The wireless connection drops every few minutes in the engineering lab.',
    requestedPriority: 'HIGH',
    itPriority: 'URGENT',
    currentStatus,
    version,
    lastStaffActivityAt: fixedTime,
    lastRequesterVisibleActivityAt: fixedTime,
    createdAt: fixedTime,
    updatedAt: fixedTime,
    requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
    owner: { id: 4, name: 'Nok Administrator', email: 'admin@example.test', role: 'ADMINISTRATOR' },
    requesterResolvedBy: null,
    category: { id: 2, name: 'Network' },
    relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
  };
  const statusHistory = [...history];
  const userById = (id: number) => ({
    id,
    name: id === 1 ? 'Ariya Anderson' : id === 3 ? 'Somsak Staff' : 'Nok Administrator',
    role: id === 1 ? 'REQUESTER' : id === 3 ? 'IT_STAFF' : 'ADMINISTRATOR',
  });
  const ticketFindUnique = vi.fn(async ({ where }: { where: { id: number } }) =>
    where.id === ticket.id ? ticket : null);
  const ticketUpdate = vi.fn(async ({ data }: { data: Record<string, any> }) => {
    const mutableTicket = ticket as unknown as Record<string, any>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && 'increment' in value) {
        mutableTicket[key] += value.increment;
      } else {
        mutableTicket[key] = value;
      }
    }
    ticket.updatedAt = fixedTime;
    return ticket;
  });
  const historyFindMany = vi.fn(async () => [...statusHistory].sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id));
  const historyCreate = vi.fn(async ({ data }: { data: Record<string, any> }) => {
    const created = {
      id: 80 + statusHistory.length,
      ...data,
      createdAt: data.createdAt ?? fixedTime,
      actor: data.actorId === null ? null : userById(data.actorId),
    };
    statusHistory.push(created);
    return created;
  });
  const actionTaken = {
    findMany: vi.fn(async () => actions),
  };
  const transaction = {
    $queryRaw: vi.fn(async () => [{ id: ticket.id }]),
    ticket: { findUnique: ticketFindUnique, update: ticketUpdate },
    actionTaken,
    ticketStatusHistory: { findMany: historyFindMany, create: historyCreate },
  };
  const database = withAuthDatabase({
    $transaction: vi.fn(async (callback: (database: typeof transaction) => Promise<unknown>) => callback(transaction)),
    $queryRaw: transaction.$queryRaw,
    ticket: { findUnique: ticketFindUnique, update: ticketUpdate },
    actionTaken,
    ticketStatusHistory: { findMany: historyFindMany, create: historyCreate },
    attachment: { findMany: vi.fn().mockResolvedValue([]) },
    publicComment: { findMany: vi.fn().mockResolvedValue([]) },
    internalNote: { findMany: vi.fn().mockResolvedValue([]) },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database as never),
    ticket,
    actions,
    statusHistory,
    ticketUpdate,
    historyFindMany,
    historyCreate,
    transaction,
  };
}

async function transition(
  harness: Awaited<ReturnType<typeof createWorkflowHarness>>,
  nextStatus: string,
  expectedVersion = 0,
  confirmed = false,
) {
  const staff = await harness.login(harness.app, 'somsak@example.test');
  const response = await staff.agent
    .patch('/api/staff/tickets/12/status')
    .set('X-CSRF-Token', staff.csrfToken)
    .send({ expectedVersion, nextStatus, confirmed });
  return { response, staff };
}

const permittedTransitions: Array<[string, string]> = [
  ['NEW', 'OPEN'],
  ['NEW', 'CANCELLED'],
  ['OPEN', 'IN_PROGRESS'],
  ['OPEN', 'WAITING_FOR_REQUESTER'],
  ['OPEN', 'CANCELLED'],
  ['IN_PROGRESS', 'WAITING_FOR_REQUESTER'],
  ['IN_PROGRESS', 'RESOLVED'],
  ['IN_PROGRESS', 'CANCELLED'],
  ['WAITING_FOR_REQUESTER', 'IN_PROGRESS'],
  ['WAITING_FOR_REQUESTER', 'RESOLVED'],
  ['WAITING_FOR_REQUESTER', 'CANCELLED'],
  ['RESOLVED', 'CLOSED'],
  ['RESOLVED', 'REOPENED'],
  ['CLOSED', 'REOPENED'],
  ['REOPENED', 'IN_PROGRESS'],
  ['REOPENED', 'WAITING_FOR_REQUESTER'],
  ['REOPENED', 'CANCELLED'],
  ['CANCELLED', 'REOPENED'],
];

describe('Lab 4 Ticket workflow API', () => {
  it.each(permittedTransitions)('accepts the documented transition %s -> %s', async (currentStatus, nextStatus) => {
    const actions = nextStatus === 'RESOLVED' || nextStatus === 'CLOSED'
      ? [actionRecord()]
      : [];
    const harness = await createWorkflowHarness({ currentStatus, actions });
    const confirmed = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(nextStatus);
    const { response } = await transition(harness, nextStatus, 0, confirmed);

    expect(response.status).toBe(200);
    expect(harness.ticket.currentStatus).toBe(nextStatus);
    expect(harness.historyCreate).toHaveBeenCalledTimes(1);
  });

  it('commits a permitted transition, one immutable event, and one Ticket version increment', async () => {
    const harness = await createWorkflowHarness();
    const { response } = await transition(harness, 'WAITING_FOR_REQUESTER');

    expect(response.status).toBe(200);
    expect(harness.ticket.currentStatus).toBe('WAITING_FOR_REQUESTER');
    expect(harness.ticket.version).toBe(1);
    expect(harness.historyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ticketId: 12,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'WAITING_FOR_REQUESTER',
        actorId: 3,
        eventKind: 'TRANSITION',
      }),
    }));
    expect(response.body.ticket.statusHistory).toEqual([expect.objectContaining({
      fromStatus: 'IN_PROGRESS',
      toStatus: 'WAITING_FOR_REQUESTER',
      actor: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
      eventKind: 'TRANSITION',
    })]);
  });

  it('rejects a stale Ticket version without changing status or appending history', async () => {
    const harness = await createWorkflowHarness({ version: 2 });
    const { response } = await transition(harness, 'WAITING_FOR_REQUESTER', 1);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'TICKET_VERSION_CONFLICT',
      currentStatus: 'IN_PROGRESS',
      currentVersion: 2,
    });
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.ticket.version).toBe(2);
    expect(harness.historyCreate).not.toHaveBeenCalled();
  });

  it('rejects an older status form after a successful transition has advanced the Ticket version', async () => {
    const harness = await createWorkflowHarness();
    const first = await transition(harness, 'WAITING_FOR_REQUESTER', 0);
    expect(first.response.status).toBe(200);

    const stale = await transition(harness, 'IN_PROGRESS', 0);
    expect(stale.response.status).toBe(409);
    expect(stale.response.body).toMatchObject({
      code: 'TICKET_VERSION_CONFLICT',
      currentStatus: 'WAITING_FOR_REQUESTER',
      currentVersion: 1,
    });
    expect(harness.ticket.currentStatus).toBe('WAITING_FOR_REQUESTER');
    expect(harness.historyCreate).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale status form after Owner and IT Priority changes', async () => {
    const harness = await createWorkflowHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const owner = await staff.agent
      .patch('/api/staff/tickets/12/owner')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ ownerId: 3 });
    expect(owner.status).toBe(200);
    expect(harness.ticket.version).toBe(1);

    const priority = await staff.agent
      .patch('/api/staff/tickets/12/priority')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ itPriority: 'LOW' });
    expect(priority.status).toBe(200);
    expect(harness.ticket.version).toBe(2);

    const staleStatus = await staff.agent
      .patch('/api/staff/tickets/12/status')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ expectedVersion: 0, nextStatus: 'WAITING_FOR_REQUESTER' });
    expect(staleStatus.status).toBe(409);
    expect(staleStatus.body).toMatchObject({
      code: 'TICKET_VERSION_CONFLICT',
      currentStatus: 'IN_PROGRESS',
      currentVersion: 2,
    });
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.historyCreate).not.toHaveBeenCalled();
  });

  it('keeps Requester resolution advisory while incrementing Ticket version', async () => {
    const harness = await createWorkflowHarness();
    const requester = await harness.login(harness.app);
    const indication = await requester.agent
      .post('/api/tickets/12/requester-resolution')
      .set('X-CSRF-Token', requester.csrfToken);

    expect(indication.status).toBe(200);
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.ticket.version).toBe(1);

    const { response: staleStatus } = await transition(harness, 'WAITING_FOR_REQUESTER', 0);
    expect(staleStatus.status).toBe(409);
    expect(staleStatus.body).toMatchObject({
      code: 'TICKET_VERSION_CONFLICT',
      currentStatus: 'IN_PROGRESS',
      currentVersion: 1,
    });
    expect(harness.historyCreate).not.toHaveBeenCalled();
  });

  it('blocks resolution when there are no Actions Taken', async () => {
    const harness = await createWorkflowHarness();
    const { response } = await transition(harness, 'RESOLVED', 0, true);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'RESOLUTION_GATE_BLOCKED',
      currentStatus: 'IN_PROGRESS',
      currentVersion: 0,
      gate: { requiresAtLeastOneActionTaken: true, incompleteRequiredFollowUps: 0 },
    });
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.ticket.version).toBe(0);
    expect(harness.historyCreate).not.toHaveBeenCalled();
  });

  it('blocks resolution until every required follow-up is completed', async () => {
    const harness = await createWorkflowHarness({
      actions: [actionRecord({ followUpRequired: true, followUpCompleted: false })],
    });
    const { response } = await transition(harness, 'RESOLVED', 0, true);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'RESOLUTION_GATE_BLOCKED',
      gate: { requiresAtLeastOneActionTaken: false, incompleteRequiredFollowUps: 1 },
    });
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.historyCreate).not.toHaveBeenCalled();
  });

  it('resolves after required follow-ups complete without clearing their original requirement', async () => {
    const action = actionRecord({ followUpRequired: true, followUpCompleted: true });
    const harness = await createWorkflowHarness({ actions: [action] });
    const { response } = await transition(harness, 'RESOLVED', 0, true);

    expect(response.status).toBe(200);
    expect(harness.ticket.currentStatus).toBe('RESOLVED');
    expect(response.body.ticket.actionsTaken[0]).toMatchObject({
      followUpRequired: true,
      followUpCompleted: true,
    });
    expect(harness.historyCreate).toHaveBeenCalledTimes(1);
  });

  it('acquires the parent Ticket lock before reading Actions Taken for the resolution gate', async () => {
    const harness = await createWorkflowHarness({ actions: [actionRecord()] });
    const { response } = await transition(harness, 'RESOLVED', 0, true);

    expect(response.status).toBe(200);
    const lockOrder = harness.transaction.$queryRaw.mock.invocationCallOrder[0];
    const gateReadOrder = harness.transaction.actionTaken.findMany.mock.invocationCallOrder[0];
    expect(lockOrder).toBeDefined();
    expect(gateReadOrder).toBeGreaterThan(lockOrder ?? 0);
  });

  it('returns the matrix conflict without changing the Ticket or status history', async () => {
    const harness = await createWorkflowHarness();
    const { response } = await transition(harness, 'CLOSED', 0, true);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'STATUS_TRANSITION_CONFLICT',
      currentStatus: 'IN_PROGRESS',
      allowedStatuses: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
    });
    expect(harness.ticket.currentStatus).toBe('IN_PROGRESS');
    expect(harness.historyCreate).not.toHaveBeenCalled();
  });

  it('returns status history to the owning Requester in stable chronological order', async () => {
    const history = [
      {
        id: 2,
        ticketId: 12,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'WAITING_FOR_REQUESTER',
        actorId: 3,
        actor: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
        eventKind: 'TRANSITION',
        createdAt: new Date('2026-09-08T11:00:00.000Z'),
      },
      {
        id: 1,
        ticketId: 12,
        fromStatus: null,
        toStatus: 'NEW',
        actorId: null,
        actor: null,
        eventKind: 'LEGACY_BASELINE',
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
      },
    ];
    const harness = await createWorkflowHarness({ history });
    const requester = await harness.login(harness.app);
    const response = await requester.agent.get('/api/tickets/12');

    expect(response.status).toBe(200);
    expect(response.body.ticket.statusHistory.map((event: { id: number }) => event.id)).toEqual([1, 2]);
    expect(response.body.ticket.statusHistory[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'NEW',
      actor: null,
      eventKind: 'LEGACY_BASELINE',
    });
    expect(harness.historyFindMany).toHaveBeenCalled();
  });
});
