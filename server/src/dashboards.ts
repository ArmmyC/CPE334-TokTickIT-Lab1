import { Prisma } from '@prisma/client';

export type DashboardDatabase = Prisma.TransactionClient;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const RECENT_ITEM_LIMIT = 5;

export const ACTIVE_TICKET_STATUSES = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'REOPENED',
] as const;

const ALL_ACTIVE_STATUS_KEYS = [...ACTIVE_TICKET_STATUSES];
const ALL_PRIORITY_KEYS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'UNASSIGNED'] as const;

function dashboardWindow(asOf: Date) {
  return {
    asOf,
    windowStart: new Date(asOf.getTime() - 7 * DAY_IN_MILLISECONDS),
  };
}

type RequesterResolutionRow = {
  ticketId: number;
  ticketNumber: string;
  summary: string;
  currentStatus: 'RESOLVED' | 'CLOSED';
  itPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  resolvedAt: Date;
};

async function loadRecentRequesterResolutions(
  database: DashboardDatabase,
  requesterId: number,
  windowStart: Date,
  asOf: Date,
) {
  const [countRows, recentRows] = await Promise.all([
    database.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Ticket" AS ticket
      JOIN LATERAL (
        SELECT history."createdAt"
        FROM "TicketStatusHistory" AS history
        WHERE history."ticketId" = ticket."id"
          AND history."eventKind" = 'TRANSITION'::"TicketStatusHistoryEventKind"
          AND history."toStatus" = 'RESOLVED'::"TicketStatus"
        ORDER BY history."createdAt" DESC, history."id" DESC
        LIMIT 1
      ) AS resolution ON TRUE
      WHERE ticket."requesterId" = ${requesterId}
        AND ticket."currentStatus" IN ('RESOLVED'::"TicketStatus", 'CLOSED'::"TicketStatus")
        AND resolution."createdAt" >= ${windowStart}
        AND resolution."createdAt" <= ${asOf}
    `),
    database.$queryRaw<RequesterResolutionRow[]>(Prisma.sql`
      SELECT
        ticket."id" AS "ticketId",
        ticket."ticketNumber",
        ticket."summary",
        ticket."currentStatus"::text AS "currentStatus",
        ticket."itPriority"::text AS "itPriority",
        resolution."createdAt" AS "resolvedAt"
      FROM "Ticket" AS ticket
      JOIN LATERAL (
        SELECT history."createdAt"
        FROM "TicketStatusHistory" AS history
        WHERE history."ticketId" = ticket."id"
          AND history."eventKind" = 'TRANSITION'::"TicketStatusHistoryEventKind"
          AND history."toStatus" = 'RESOLVED'::"TicketStatus"
        ORDER BY history."createdAt" DESC, history."id" DESC
        LIMIT 1
      ) AS resolution ON TRUE
      WHERE ticket."requesterId" = ${requesterId}
        AND ticket."currentStatus" IN ('RESOLVED'::"TicketStatus", 'CLOSED'::"TicketStatus")
        AND resolution."createdAt" >= ${windowStart}
        AND resolution."createdAt" <= ${asOf}
      ORDER BY resolution."createdAt" DESC, ticket."ticketNumber" DESC
      LIMIT ${RECENT_ITEM_LIMIT}
    `),
  ]);

  return {
    count: countRows[0]?.count ?? 0,
    recentRows,
  };
}

export async function findRequesterResolvedTicketIds(
  database: DashboardDatabase,
  requesterId: number,
  resolvedSince: Date,
  resolvedUntil: Date,
): Promise<number[]> {
  const rows = await database.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT ticket."id"
    FROM "Ticket" AS ticket
    JOIN LATERAL (
      SELECT history."createdAt"
      FROM "TicketStatusHistory" AS history
      WHERE history."ticketId" = ticket."id"
        AND history."eventKind" = 'TRANSITION'::"TicketStatusHistoryEventKind"
        AND history."toStatus" = 'RESOLVED'::"TicketStatus"
      ORDER BY history."createdAt" DESC, history."id" DESC
      LIMIT 1
    ) AS resolution ON TRUE
    WHERE ticket."requesterId" = ${requesterId}
      AND ticket."currentStatus" IN ('RESOLVED'::"TicketStatus", 'CLOSED'::"TicketStatus")
      AND resolution."createdAt" >= ${resolvedSince}
      AND resolution."createdAt" <= ${resolvedUntil}
    ORDER BY resolution."createdAt" DESC, ticket."ticketNumber" DESC
  `);
  return rows.map(({ id }) => id);
}

export async function getRequesterDashboard(
  database: DashboardDatabase,
  requesterId: number,
  asOf = new Date(),
) {
  const { windowStart } = dashboardWindow(asOf);
  const [openTickets, waitingForRequester, recentlyUpdated, recentUpdatedRows, resolutions] = await Promise.all([
    database.ticket.count({
      where: { requesterId, currentStatus: { in: [...ACTIVE_TICKET_STATUSES] } },
    }),
    database.ticket.count({
      where: { requesterId, currentStatus: 'WAITING_FOR_REQUESTER' },
    }),
    database.ticket.count({
      where: {
        requesterId,
        lastRequesterVisibleActivityAt: { gte: windowStart, lte: asOf },
      },
    }),
    database.ticket.findMany({
      where: {
        requesterId,
        lastRequesterVisibleActivityAt: { gte: windowStart, lte: asOf },
      },
      orderBy: [{ lastRequesterVisibleActivityAt: 'desc' }, { ticketNumber: 'desc' }],
      take: RECENT_ITEM_LIMIT,
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        currentStatus: true,
        itPriority: true,
        lastRequesterVisibleActivityAt: true,
      },
    }),
    loadRecentRequesterResolutions(database, requesterId, windowStart, asOf),
  ]);

  return {
    asOf,
    windowStart,
    metrics: {
      openTickets,
      waitingForRequester,
      recentlyUpdated,
      recentlyResolved: resolutions.count,
    },
    recentlyUpdatedTickets: recentUpdatedRows.map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      currentStatus: ticket.currentStatus,
      itPriority: ticket.itPriority,
      lastActivityAt: ticket.lastRequesterVisibleActivityAt,
    })),
    recentlyResolvedTickets: resolutions.recentRows.map((ticket) => ({
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      currentStatus: ticket.currentStatus,
      itPriority: ticket.itPriority,
      resolvedAt: ticket.resolvedAt,
    })),
  };
}

export async function getStaffDashboard(
  database: DashboardDatabase,
  userId: number,
  asOf = new Date(),
) {
  const { windowStart } = dashboardWindow(asOf);
  const activeWhere = { currentStatus: { in: [...ACTIVE_TICKET_STATUSES] } };
  const [unassigned, ownedByMe, actionsTakenByMe, recentlyUpdated, statusRows, priorityRows, recentTicketRows, recentActionRows] = await Promise.all([
    database.ticket.count({ where: { ...activeWhere, ownerId: null } }),
    database.ticket.count({ where: { ...activeWhere, ownerId: userId } }),
    database.actionTaken.count({ where: { performedById: userId } }),
    database.ticket.count({ where: { lastStaffActivityAt: { gte: windowStart, lte: asOf } } }),
    database.ticket.groupBy({
      by: ['currentStatus'],
      where: activeWhere,
      _count: { _all: true },
    }),
    database.ticket.groupBy({
      by: ['itPriority'],
      where: activeWhere,
      _count: { _all: true },
    }),
    database.ticket.findMany({
      where: { lastStaffActivityAt: { gte: windowStart, lte: asOf } },
      orderBy: [{ lastStaffActivityAt: 'desc' }, { ticketNumber: 'desc' }],
      take: RECENT_ITEM_LIMIT,
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        currentStatus: true,
        itPriority: true,
        lastStaffActivityAt: true,
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, role: true } },
      },
    }),
    database.actionTaken.findMany({
      where: { performedById: userId },
      orderBy: [{ actionAt: 'desc' }, { id: 'desc' }],
      take: RECENT_ITEM_LIMIT,
      select: {
        id: true,
        ticketId: true,
        actionAt: true,
        result: true,
        followUpRequired: true,
        ticket: { select: { ticketNumber: true, summary: true } },
      },
    }),
  ]);

  const activeByStatus = Object.fromEntries(ALL_ACTIVE_STATUS_KEYS.map((status) => [status, 0])) as Record<
    (typeof ALL_ACTIVE_STATUS_KEYS)[number],
    number
  >;
  for (const row of statusRows) {
    activeByStatus[row.currentStatus as (typeof ALL_ACTIVE_STATUS_KEYS)[number]] = row._count._all;
  }

  const activeByItPriority = Object.fromEntries(ALL_PRIORITY_KEYS.map((priority) => [priority, 0])) as Record<
    (typeof ALL_PRIORITY_KEYS)[number],
    number
  >;
  for (const row of priorityRows) {
    activeByItPriority[row.itPriority ?? 'UNASSIGNED'] = row._count._all;
  }

  return {
    asOf,
    windowStart,
    metrics: { unassigned, ownedByMe, actionsTakenByMe, recentlyUpdated },
    activeByStatus,
    activeByItPriority,
    recentlyUpdatedTickets: recentTicketRows.map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      requester: ticket.requester,
      owner: ticket.owner,
      currentStatus: ticket.currentStatus,
      itPriority: ticket.itPriority,
      lastActivityAt: ticket.lastStaffActivityAt,
    })),
    recentActionsTakenByMe: recentActionRows.map((action) => ({
      actionId: action.id,
      ticketId: action.ticketId,
      ticketNumber: action.ticket.ticketNumber,
      summary: action.ticket.summary,
      actionAt: action.actionAt,
      result: action.result,
      followUpRequired: action.followUpRequired,
    })),
  };
}
