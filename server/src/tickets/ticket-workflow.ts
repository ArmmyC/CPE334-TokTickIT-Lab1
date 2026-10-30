import { Prisma } from '@prisma/client';
import {
  isResolutionGateSatisfied,
  STAFF_TICKET_STATUS_TRANSITIONS,
  StaffTicketResolutionGateConflictError,
  StaffTicketTransitionConflictError,
  StaffTicketVersionConflictError,
  type StaffTicketStatus,
} from './staff-detail.js';

type WorkflowTicket = {
  id: number;
  currentStatus: StaffTicketStatus;
  version: number;
};

type WorkflowTransaction = {
  $queryRaw?<T = unknown>(query: Prisma.Sql): Promise<T>;
  ticket?: {
    findUnique(args: {
      where: { id: number };
      select: { id: true; currentStatus: true; version: true };
    }): Promise<WorkflowTicket | null>;
    update(args: {
      where: { id: number };
      data: {
        currentStatus: StaffTicketStatus;
        version: { increment: 1 };
        lastStaffActivityAt: Date;
        lastRequesterVisibleActivityAt: Date;
      };
    }): Promise<unknown>;
  };
  actionTaken?: {
    findMany(args: {
      where: { ticketId: number };
      select: { followUpRequired: true; followUpCompleted: true };
    }): Promise<Array<{ followUpRequired: boolean; followUpCompleted: boolean }>>;
  };
  ticketStatusHistory?: {
    create(args: {
      data: {
        ticketId: number;
        fromStatus: StaffTicketStatus;
        toStatus: StaffTicketStatus;
        actorId: number;
        eventKind: 'TRANSITION';
        createdAt: Date;
      };
      select: { id: true };
    }): Promise<unknown>;
  };
};

export type StaffTicketWorkflowDatabase = {
  $transaction?<T>(callback: (transaction: WorkflowTransaction) => Promise<T>): Promise<T>;
};

export type StaffTicketStatusInput = {
  expectedVersion: number;
  nextStatus: StaffTicketStatus;
  confirmed: boolean;
};

export async function updateStaffTicketStatus(
  database: StaffTicketWorkflowDatabase,
  ticketId: number,
  actorId: number,
  input: StaffTicketStatusInput,
): Promise<boolean> {
  if (!database.$transaction) {
    throw new Error('Staff Ticket workflow database access is unavailable.');
  }

  return database.$transaction(async (transaction) => {
    if (
      !transaction.$queryRaw
      || !transaction.ticket?.findUnique
      || !transaction.ticket.update
      || !transaction.ticketStatusHistory?.create
    ) {
      throw new Error('Staff Ticket workflow transaction access is unavailable.');
    }

    const lockedRows = await transaction.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`,
    );
    if (lockedRows.length === 0) return false;

    const ticket = await transaction.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, currentStatus: true, version: true },
    });
    if (!ticket) return false;

    if (ticket.version !== input.expectedVersion) {
      throw new StaffTicketVersionConflictError(ticket.currentStatus, ticket.version);
    }

    const fromStatus = ticket.currentStatus;
    const allowedStatuses = STAFF_TICKET_STATUS_TRANSITIONS[fromStatus];
    if (!allowedStatuses.includes(input.nextStatus)) {
      throw new StaffTicketTransitionConflictError(fromStatus, allowedStatuses);
    }

    if (input.nextStatus === 'RESOLVED' || input.nextStatus === 'CLOSED') {
      if (!transaction.actionTaken?.findMany) {
        throw new Error('Staff Ticket resolution gate database access is unavailable.');
      }
      const actions = await transaction.actionTaken.findMany({
        where: { ticketId },
        select: { followUpRequired: true, followUpCompleted: true },
      });
      const requiresAtLeastOneActionTaken = actions.length === 0;
      const incompleteRequiredFollowUps = actions.filter((action) =>
        action.followUpRequired && !action.followUpCompleted).length;
      if (!isResolutionGateSatisfied(actions)) {
        throw new StaffTicketResolutionGateConflictError(
          ticket.currentStatus,
          ticket.version,
          requiresAtLeastOneActionTaken,
          incompleteRequiredFollowUps,
        );
      }
    }

    const now = new Date();
    await transaction.ticket.update({
      where: { id: ticketId },
      data: {
        currentStatus: input.nextStatus,
        version: { increment: 1 },
        lastStaffActivityAt: now,
        lastRequesterVisibleActivityAt: now,
      },
    });
    await transaction.ticketStatusHistory.create({
      data: {
        ticketId,
        fromStatus,
        toStatus: input.nextStatus,
        actorId,
        eventKind: 'TRANSITION',
        createdAt: now,
      },
      select: { id: true },
    });
    return true;
  });
}
