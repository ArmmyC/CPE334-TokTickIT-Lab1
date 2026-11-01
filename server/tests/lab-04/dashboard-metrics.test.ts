import { describe, expect, it, vi } from 'vitest';
import { getRequesterDashboard, getStaffDashboard } from '../../src/dashboards.js';

const asOf = new Date('2099-10-30T12:00:00.000Z');
const windowStart = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);

describe('Lab 4 dashboard metric queries', () => {
  it('returns explicit zeroes and empty lists while limiting recent rows to five', async () => {
    const ticket = {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    };
    const actionTaken = {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const $queryRaw = vi.fn()
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);
    const database = { ticket, actionTaken, $queryRaw } as never;

    const requesterDashboard = await getRequesterDashboard(database, 31, asOf);
    const staffDashboard = await getStaffDashboard(database, 47, asOf);

    expect(requesterDashboard).toMatchObject({
      asOf,
      windowStart,
      metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
      recentlyUpdatedTickets: [],
      recentlyResolvedTickets: [],
    });
    expect(staffDashboard).toMatchObject({
      asOf,
      windowStart,
      metrics: { unassigned: 0, ownedByMe: 0, actionsTakenByMe: 0, recentlyUpdated: 0 },
      activeByStatus: {
        NEW: 0,
        OPEN: 0,
        IN_PROGRESS: 0,
        WAITING_FOR_REQUESTER: 0,
        REOPENED: 0,
      },
      activeByItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0, UNASSIGNED: 0 },
      recentlyUpdatedTickets: [],
      recentActionsTakenByMe: [],
    });
    expect(ticket.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      take: 5,
      orderBy: [{ lastRequesterVisibleActivityAt: 'desc' }, { ticketNumber: 'desc' }],
    }));
    expect(ticket.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      take: 5,
      orderBy: [{ lastStaffActivityAt: 'desc' }, { ticketNumber: 'desc' }],
    }));
    expect(actionTaken.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { performedById: 47 },
      take: 5,
      orderBy: [{ actionAt: 'desc' }, { id: 'desc' }],
    }));
    expect($queryRaw).toHaveBeenCalledTimes(2);
  });
});
