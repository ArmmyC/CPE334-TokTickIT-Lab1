import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  createDashboardInternalNote,
  createDashboardStatusEvent,
  createDashboardTicket,
  dashboardTestDatabase,
  loginDashboardUser,
  type DashboardTestContext,
  withDashboardTestTransaction,
} from './dashboard-api-test-support.js';

const asOf = new Date('2099-10-30T12:00:00.000Z');
const windowStart = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
const older = new Date(windowStart.getTime() - 1);

async function useFixedClock<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(asOf);
  try {
    return await run();
  } finally {
    vi.useRealTimers();
  }
}

async function createRequesterDashboardFixtures(context: DashboardTestContext) {
  const requesterId = context.users.requester.id;
  const staffId = context.users.staff.id;
  const activeAtStart = await createDashboardTicket(context, {
    requesterId,
    ownerId: staffId,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    requesterActivityAt: windowStart,
    staffActivityAt: windowStart,
    ticketNumber: 'L4-REQ-ACTIVE-START',
    summary: 'Activity at the lower window boundary',
  });
  const activeAtEnd = await createDashboardTicket(context, {
    requesterId,
    status: 'WAITING_FOR_REQUESTER',
    priority: 'URGENT',
    requesterActivityAt: asOf,
    staffActivityAt: asOf,
    ticketNumber: 'L4-REQ-ACTIVE-END',
    summary: 'Activity at the upper window boundary',
  });
  const reopenedAfterRecentResolution = await createDashboardTicket(context, {
    requesterId,
    status: 'REOPENED',
    priority: null,
    requesterActivityAt: older,
    staffActivityAt: asOf,
    ticketNumber: 'L4-REQ-REOPENED',
    summary: 'Recently reopened after a resolution',
  });
  await createDashboardStatusEvent(context, {
    ticketId: reopenedAfterRecentResolution.id,
    fromStatus: 'IN_PROGRESS',
    toStatus: 'RESOLVED',
    eventKind: 'TRANSITION',
    actorId: staffId,
    createdAt: new Date(asOf.getTime() - 2 * 60 * 60 * 1000),
  });
  await createDashboardStatusEvent(context, {
    ticketId: reopenedAfterRecentResolution.id,
    fromStatus: 'RESOLVED',
    toStatus: 'REOPENED',
    eventKind: 'TRANSITION',
    actorId: staffId,
    createdAt: new Date(asOf.getTime() - 60 * 60 * 1000),
  });
  const resolvedByRealTransition = await createDashboardTicket(context, {
    requesterId,
    status: 'RESOLVED',
    priority: 'MEDIUM',
    requesterActivityAt: older,
    staffActivityAt: asOf,
    ticketNumber: 'L4-REQ-RESOLVED-REAL',
    summary: 'Resolved by a real recent transition',
  });
  await createDashboardStatusEvent(context, {
    ticketId: resolvedByRealTransition.id,
    fromStatus: 'IN_PROGRESS',
    toStatus: 'RESOLVED',
    eventKind: 'TRANSITION',
    actorId: staffId,
    createdAt: new Date(asOf.getTime() - 30 * 60 * 1000),
  });
  const resolvedByLegacyBaseline = await createDashboardTicket(context, {
    requesterId,
    status: 'RESOLVED',
    priority: 'LOW',
    requesterActivityAt: older,
    staffActivityAt: asOf,
    ticketNumber: 'L4-REQ-RESOLVED-BASELINE',
    summary: 'Recent staff-only activity with a legacy baseline',
  });
  await createDashboardStatusEvent(context, {
    ticketId: resolvedByLegacyBaseline.id,
    fromStatus: null,
    toStatus: 'RESOLVED',
    eventKind: 'LEGACY_BASELINE',
    actorId: null,
    createdAt: new Date(asOf.getTime() - 20 * 60 * 1000),
  });
  await createDashboardInternalNote(context, resolvedByLegacyBaseline.id, staffId, asOf);
  const foreignRecentTicket = await createDashboardTicket(context, {
    requesterId: context.users.otherRequester.id,
    status: 'NEW',
    priority: 'LOW',
    requesterActivityAt: asOf,
    staffActivityAt: asOf,
    ticketNumber: 'L4-REQ-FOREIGN',
    summary: 'Another Requester private ticket',
  });
  return { activeAtStart, activeAtEnd, reopenedAfterRecentResolution, resolvedByRealTransition, foreignRecentTicket };
}

describe('Lab 4 Requester dashboard API', () => {
  afterAll(async () => dashboardTestDatabase.$disconnect());

  it('returns fixed-window metrics and privacy-safe, owned recent rows', async () => useFixedClock(async () => {
    await withDashboardTestTransaction(async (context) => {
      const fixtures = await createRequesterDashboardFixtures(context);
      const requester = await loginDashboardUser(context, context.users.requester);

      const response = await requester.agent.get('/api/requester/dashboard');

      expect(response.status).toBe(200);
      const dashboard = response.body.dashboard;
      expect(dashboard).toMatchObject({
        asOf: asOf.toISOString(),
        windowStart: windowStart.toISOString(),
        metrics: {
          openTickets: 3,
          waitingForRequester: 1,
          recentlyUpdated: 2,
          recentlyResolved: 1,
        },
      });
      expect(dashboard.recentlyUpdatedTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([
        'L4-REQ-ACTIVE-END',
        'L4-REQ-ACTIVE-START',
      ]);
      expect(dashboard.recentlyUpdatedTickets).toHaveLength(2);
      for (const ticket of dashboard.recentlyUpdatedTickets) {
        expect(Object.keys(ticket).sort()).toEqual([
          'currentStatus', 'itPriority', 'lastActivityAt', 'summary', 'ticketId', 'ticketNumber',
        ]);
        expect(ticket).not.toHaveProperty('owner');
        expect(ticket).not.toHaveProperty('internalNotes');
        expect(ticket).not.toHaveProperty('lastStaffActivityAt');
      }
      expect(dashboard.recentlyResolvedTickets).toHaveLength(1);
      expect(dashboard.recentlyResolvedTickets[0]).toMatchObject({
        ticketId: fixtures.resolvedByRealTransition.id,
        ticketNumber: 'L4-REQ-RESOLVED-REAL',
        currentStatus: 'RESOLVED',
        resolvedAt: new Date(asOf.getTime() - 30 * 60 * 1000).toISOString(),
      });
      expect(dashboard.recentlyResolvedTickets[0]).not.toHaveProperty('owner');
      expect(dashboard.recentlyResolvedTickets[0]).not.toHaveProperty('lastStaffActivityAt');
      expect(JSON.stringify(response.body)).not.toContain('CONFIDENTIAL dashboard fixture note.');
      expect(JSON.stringify(response.body)).not.toContain('L4-REQ-FOREIGN');
      expect(dashboard.recentlyResolvedTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber))
        .not.toContain('L4-REQ-REOPENED');
    });
  }));

  it('denies staff/admin dashboard access and requires a normal authenticated session', async () => {
    await withDashboardTestTransaction(async (context) => {
      const staff = await loginDashboardUser(context, context.users.staff);
      const admin = await loginDashboardUser(context, context.users.admin);

      const staffResponse = await staff.agent.get('/api/requester/dashboard');
      const adminResponse = await admin.agent.get('/api/requester/dashboard');
      const anonymousResponse = await request(context.app).get('/api/requester/dashboard');

      expect(staffResponse.status).toBe(403);
      expect(adminResponse.status).toBe(403);
      expect(anonymousResponse.status).toBe(401);
    });
  });

  it('returns explicit zero counts and empty recent lists when the Requester has no Tickets', async () => {
    await withDashboardTestTransaction(async (context) => {
      const requester = await loginDashboardUser(context, context.users.requester);

      const response = await requester.agent.get('/api/requester/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.dashboard.metrics).toEqual({
        openTickets: 0,
        waitingForRequester: 0,
        recentlyUpdated: 0,
        recentlyResolved: 0,
      });
      expect(response.body.dashboard.recentlyUpdatedTickets).toEqual([]);
      expect(response.body.dashboard.recentlyResolvedTickets).toEqual([]);
    });
  });

  it('applies inclusive dashboard drill-down windows and rejects contradictory list filters', async () => useFixedClock(async () => {
    await withDashboardTestTransaction(async (context) => {
      await createRequesterDashboardFixtures(context);
      const requester = await loginDashboardUser(context, context.users.requester);
      const activeParams = new URLSearchParams({
        statusGroup: 'ACTIVE',
        activitySince: windowStart.toISOString(),
        activityUntil: asOf.toISOString(),
      });
      const activeResponse = await requester.agent.get(`/api/tickets?${activeParams.toString()}`);
      const resolvedParams = new URLSearchParams({
        statusGroup: 'RESOLVED',
        resolvedSince: windowStart.toISOString(),
        resolvedUntil: asOf.toISOString(),
      });
      const resolvedResponse = await requester.agent.get(`/api/tickets?${resolvedParams.toString()}`);
      const contradictoryResponse = await requester.agent.get('/api/tickets?statusGroup=ACTIVE&currentStatus=NEW');

      expect(activeResponse.status).toBe(200);
      expect(activeResponse.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber).sort()).toEqual([
        'L4-REQ-ACTIVE-END',
        'L4-REQ-ACTIVE-START',
      ]);
      expect(resolvedResponse.status).toBe(200);
      expect(resolvedResponse.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([
        'L4-REQ-RESOLVED-REAL',
      ]);
      expect(contradictoryResponse.status).toBe(400);
      expect(contradictoryResponse.body.code).toBe('VALIDATION_FAILED');
    });
  }));

  it('opens the Waiting for You metric with its single-status Ticket list filter', async () => {
    await withDashboardTestTransaction(async (context) => {
      await createRequesterDashboardFixtures(context);
      const requester = await loginDashboardUser(context, context.users.requester);

      const response = await requester.agent.get('/api/tickets?currentStatus=WAITING_FOR_REQUESTER');

      expect(response.status).toBe(200);
      expect(response.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([
        'L4-REQ-ACTIVE-END',
      ]);
    });
  });
});
