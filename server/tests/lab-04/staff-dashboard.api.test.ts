import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  createDashboardAction,
  createDashboardInternalNote,
  createDashboardTicket,
  dashboardTestDatabase,
  loginDashboardUser,
  withDashboardTestTransaction,
  type DashboardTestContext,
  type DashboardStatus,
} from './dashboard-api-test-support.js';

const asOf = new Date('2099-10-30T12:00:00.000Z');
const windowStart = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
const older = new Date(windowStart.getTime() - 1);
const activeStatuses: DashboardStatus[] = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'];
const statusKeys = [...activeStatuses];
const priorityKeys = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'UNASSIGNED'] as const;

async function readBaseCounts(context: DashboardTestContext, userId: number) {
  const [unassigned, ownedByMe, actionsTakenByMe, statusRows, priorityRows] = await Promise.all([
    context.database.ticket.count({ where: { currentStatus: { in: activeStatuses }, ownerId: null } }),
    context.database.ticket.count({ where: { currentStatus: { in: activeStatuses }, ownerId: userId } }),
    context.database.actionTaken.count({ where: { performedById: userId } }),
    context.database.ticket.groupBy({
      by: ['currentStatus'],
      where: { currentStatus: { in: activeStatuses } },
      _count: { _all: true },
    }),
    context.database.ticket.groupBy({
      by: ['itPriority'],
      where: { currentStatus: { in: activeStatuses } },
      _count: { _all: true },
    }),
  ]);
  const activeByStatus = Object.fromEntries(statusKeys.map((key) => [key, 0])) as Record<string, number>;
  const activeByItPriority = Object.fromEntries(priorityKeys.map((key) => [key, 0])) as Record<string, number>;
  for (const row of statusRows) activeByStatus[row.currentStatus] = row._count._all;
  for (const row of priorityRows) activeByItPriority[row.itPriority ?? 'UNASSIGNED'] = row._count._all;
  return { unassigned, ownedByMe, actionsTakenByMe, activeByStatus, activeByItPriority };
}

async function useFixedClock<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(asOf);
  try {
    return await run();
  } finally {
    vi.useRealTimers();
  }
}

describe('Lab 4 Staff dashboard API', () => {
  afterAll(async () => dashboardTestDatabase.$disconnect());

  it('calculates actor and status/priority aggregates from bounded staff-visible activity', async () => useFixedClock(async () => {
    await withDashboardTestTransaction(async (context) => {
      const staffId = context.users.staff.id;
      const otherStaffId = context.users.otherStaff.id;
      const base = await readBaseCounts(context, staffId);
      const unassigned = await createDashboardTicket(context, {
        status: 'NEW', priority: 'LOW', requesterActivityAt: asOf, staffActivityAt: asOf,
        ticketNumber: 'L4-STAFF-UNASSIGNED', summary: 'Unassigned active ticket',
      });
      const owned = await createDashboardTicket(context, {
        ownerId: staffId, status: 'IN_PROGRESS', priority: 'HIGH',
        requesterActivityAt: asOf, staffActivityAt: new Date(asOf.getTime() - 60_000),
        ticketNumber: 'L4-STAFF-OWNED', summary: 'Current-user-owned ticket',
      });
      const otherOwned = await createDashboardTicket(context, {
        ownerId: otherStaffId, status: 'WAITING_FOR_REQUESTER', priority: null,
        requesterActivityAt: windowStart, staffActivityAt: windowStart,
        ticketNumber: 'L4-STAFF-OTHER-OWNER', summary: 'Another staff member owns this action',
      });
      const reopenedOwned = await createDashboardTicket(context, {
        ownerId: staffId, status: 'REOPENED', priority: 'MEDIUM',
        requesterActivityAt: older, staffActivityAt: older,
        ticketNumber: 'L4-STAFF-REOPENED-OLD', summary: 'Older active ticket',
      });
      const terminalWithStaffNote = await createDashboardTicket(context, {
        ownerId: staffId, status: 'CLOSED', priority: 'URGENT',
        requesterActivityAt: older, staffActivityAt: asOf,
        ticketNumber: 'L4-STAFF-TERMINAL-NOTE', summary: 'Staff-only recent activity',
      });
      await createDashboardInternalNote(context, terminalWithStaffNote.id, staffId, asOf);

      const latestAction = await createDashboardAction(context, {
        ticketId: otherOwned.id,
        performedById: staffId,
        actionAt: asOf,
        result: 'The network adapter is stable.',
        followUpRequired: true,
      });
      const boundaryAction = await createDashboardAction(context, {
        ticketId: terminalWithStaffNote.id,
        performedById: staffId,
        actionAt: windowStart,
        result: 'The required follow-up was confirmed.',
      });
      const olderAction = await createDashboardAction(context, {
        ticketId: owned.id,
        performedById: staffId,
        actionAt: older,
        result: 'An older action still contributes to the total.',
      });
      await createDashboardAction(context, {
        ticketId: owned.id,
        performedById: otherStaffId,
        actionAt: asOf,
        result: 'Owner and performer are different identities.',
      });
      const staff = await loginDashboardUser(context, context.users.staff);

      const response = await staff.agent.get('/api/staff/dashboard');

      expect(response.status).toBe(200);
      const dashboard = response.body.dashboard;
      expect(dashboard).toMatchObject({
        asOf: asOf.toISOString(),
        windowStart: windowStart.toISOString(),
        metrics: {
          unassigned: base.unassigned + 1,
          ownedByMe: base.ownedByMe + 2,
          actionsTakenByMe: base.actionsTakenByMe + 3,
          recentlyUpdated: 4,
        },
        activeByStatus: {
          NEW: base.activeByStatus.NEW! + 1,
          OPEN: base.activeByStatus.OPEN!,
          IN_PROGRESS: base.activeByStatus.IN_PROGRESS! + 1,
          WAITING_FOR_REQUESTER: base.activeByStatus.WAITING_FOR_REQUESTER! + 1,
          REOPENED: base.activeByStatus.REOPENED! + 1,
        },
        activeByItPriority: {
          LOW: base.activeByItPriority.LOW! + 1,
          MEDIUM: base.activeByItPriority.MEDIUM! + 1,
          HIGH: base.activeByItPriority.HIGH! + 1,
          URGENT: base.activeByItPriority.URGENT!,
          UNASSIGNED: base.activeByItPriority.UNASSIGNED! + 1,
        },
      });
      expect(dashboard.recentlyUpdatedTickets).toHaveLength(4);
      expect(dashboard.recentlyUpdatedTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([
        'L4-STAFF-UNASSIGNED',
        'L4-STAFF-TERMINAL-NOTE',
        'L4-STAFF-OWNED',
        'L4-STAFF-OTHER-OWNER',
      ]);
      expect(dashboard.recentActionsTakenByMe).toHaveLength(3);
      expect(dashboard.recentActionsTakenByMe.map((action: { actionId: number }) => action.actionId)).toEqual([
        latestAction.id,
        boundaryAction.id,
        olderAction.id,
      ]);
      expect(dashboard.recentActionsTakenByMe[0]).toMatchObject({
        ticketId: otherOwned.id,
        actionAt: asOf.toISOString(),
        result: 'The network adapter is stable.',
        followUpRequired: true,
      });
      expect(JSON.stringify(response.body)).not.toContain('CONFIDENTIAL dashboard fixture note.');
      expect(dashboard.recentActionsTakenByMe.every((action: { actionId: number }) =>
        [latestAction.id, boundaryAction.id, olderAction.id].includes(action.actionId))).toBe(true);
      expect(reopenedOwned).toBeDefined();
      expect(unassigned.ownerId).toBeNull();

      const activeQuery = new URLSearchParams({
        statusGroup: 'ACTIVE',
        ownerId: 'ME',
        activitySince: windowStart.toISOString(),
        activityUntil: asOf.toISOString(),
      });
      const activeDrillDown = await staff.agent.get(`/api/staff/tickets?${activeQuery.toString()}`);
      const actionQuery = new URLSearchParams({
        actionPerformedBy: 'ME',
        activitySince: windowStart.toISOString(),
        activityUntil: asOf.toISOString(),
      });
      const actionDrillDown = await staff.agent.get(`/api/staff/tickets?${actionQuery.toString()}`);

      expect(activeDrillDown.status).toBe(200);
      expect(activeDrillDown.body.items.map((ticket: { id: number }) => ticket.id)).toEqual([owned.id]);
      expect(actionDrillDown.status).toBe(200);
      expect(actionDrillDown.body.items.map((ticket: { id: number }) => ticket.id)).toEqual([
        terminalWithStaffNote.id,
        owned.id,
        otherOwned.id,
      ]);
    });
  }));

  it('lets Administrators read and filter the queue while preserving all existing write restrictions', async () => useFixedClock(async () => {
    await withDashboardTestTransaction(async (context) => {
      const adminId = context.users.admin.id;
      const staffId = context.users.staff.id;
      const base = await readBaseCounts(context, adminId);
      const adminOwned = await createDashboardTicket(context, {
        ownerId: adminId, status: 'OPEN', priority: 'LOW',
        requesterActivityAt: asOf, staffActivityAt: asOf,
        ticketNumber: 'L4-ADMIN-QUEUE-OWNED', summary: 'Administrator-owned queue row',
      });
      const staffPerformed = await createDashboardTicket(context, {
        ownerId: staffId, status: 'IN_PROGRESS', priority: 'HIGH',
        requesterActivityAt: asOf, staffActivityAt: asOf,
        ticketNumber: 'L4-ADMIN-ACTION-PERFORMED', summary: 'Administrator-performed action row',
      });
      await createDashboardAction(context, {
        ticketId: staffPerformed.id,
        performedById: adminId,
        actionAt: asOf,
        result: 'Administrator performed this action.',
      });
      const admin = await loginDashboardUser(context, context.users.admin);
      const queueByOwner = await admin.agent.get('/api/staff/tickets?ownerId=ME');
      const queueByAction = await admin.agent.get('/api/staff/tickets?actionPerformedBy=ME');
      const dashboard = await admin.agent.get('/api/staff/dashboard');
      const statusWrite = await admin.agent
        .patch(`/api/staff/tickets/${adminOwned.id}/status`)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ expectedVersion: 0, nextStatus: 'CANCELLED', confirmed: true });
      const ownerWrite = await admin.agent
        .patch(`/api/staff/tickets/${adminOwned.id}/owner`)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ ownerId: staffId, expectedVersion: 0 });
      const commentWrite = await admin.agent
        .post(`/api/staff/tickets/${adminOwned.id}/comments`)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ content: 'Not permitted through the Staff Queue increment.' });
      const noteWrite = await admin.agent
        .post(`/api/staff/tickets/${adminOwned.id}/notes`)
        .set('X-CSRF-Token', admin.csrfToken)
        .send({ content: 'Not permitted through the Staff Queue increment.' });

      expect(queueByOwner.status).toBe(200);
      expect(queueByOwner.body.items.map((ticket: { id: number }) => ticket.id)).toEqual([adminOwned.id]);
      expect(queueByOwner.body.items[0]).not.toHaveProperty('internalNotes');
      expect(queueByOwner.body.items[0]).not.toHaveProperty('actionsTaken');
      expect(queueByAction.status).toBe(200);
      expect(queueByAction.body.items.map((ticket: { id: number }) => ticket.id)).toEqual([staffPerformed.id]);
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.dashboard.metrics).toMatchObject({
        unassigned: base.unassigned,
        ownedByMe: base.ownedByMe + 1,
        actionsTakenByMe: base.actionsTakenByMe + 1,
      });
      for (const write of [statusWrite, ownerWrite, commentWrite, noteWrite]) {
        expect(write.status).toBe(403);
        expect(write.body.code).toBe('FORBIDDEN');
      }
    });
  }));

  it('denies Requester reads of the Staff dashboard and Staff Queue', async () => {
    await withDashboardTestTransaction(async (context) => {
      const requester = await loginDashboardUser(context, context.users.requester);

      const dashboard = await requester.agent.get('/api/staff/dashboard');
      const queue = await requester.agent.get('/api/staff/tickets');

      expect(dashboard.status).toBe(403);
      expect(queue.status).toBe(403);
    });
  });
});
