import type { Request, Response } from 'express';
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { AuthDatabaseLike } from '../auth/types.js';
import { requireCsrf, requireRole, sendAuthenticationRequired } from '../auth/middleware.js';
import {
  ActionTakenValidationError,
  ACTION_TAKEN_DETAIL_SELECT,
  createActionTakenFingerprint,
  parseCreateActionTakenPayload,
  parseUpdateActionTakenPayload,
  serializeActionTaken,
  type ActionTakenRecord,
  type UpdateActionTakenInput,
} from './actions-taken.js';

type TicketForAction = {
  id: number;
  requesterId: number;
  currentStatus: string;
  version: number;
};

type ActionTakenRow = ActionTakenRecord & {
  idempotencyKey: string;
  idempotencyPayloadHash: string;
  performedById: number;
  updatedById: number;
};

type ActionTakenTransactionDatabase = {
  $queryRaw?<T = unknown>(query: Prisma.Sql): Promise<T>;
  ticket?: {
    findUnique(args: {
      where: { id: number };
      select: { id: true; requesterId: true; currentStatus: true; version: true };
    }): Promise<TicketForAction | null>;
    update(args: {
      where: { id: number };
      data: {
        version: { increment: 1 };
        lastStaffActivityAt: Date;
        lastRequesterVisibleActivityAt: Date;
      };
    }): Promise<unknown>;
  };
  actionTaken?: {
    findMany?(args: {
      where: { ticketId: number };
      orderBy: Array<{ actionAt: 'asc' } | { id: 'asc' }>;
      select: Record<string, unknown>;
    }): Promise<ActionTakenRecord[]>;
    findUnique(args: {
      where: { performedById_idempotencyKey: { performedById: number; idempotencyKey: string } };
      select: Record<string, unknown>;
    }): Promise<ActionTakenRow | null>;
    findFirst(args: {
      where: { id: number; ticketId: number };
      select: Record<string, unknown>;
    }): Promise<ActionTakenRow | null>;
    create(args: {
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    }): Promise<ActionTakenRow>;
    update(args: {
      where: { id: number };
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    }): Promise<ActionTakenRow>;
  };
};

export type ActionTakenApiDatabase = ActionTakenTransactionDatabase & {
  $transaction?<T>(callback: (database: ActionTakenTransactionDatabase) => Promise<T>): Promise<T>;
  actionTaken?: ActionTakenTransactionDatabase['actionTaken'];
};

const ACTIVE_TICKET_STATUSES = new Set([
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'REOPENED',
]);

const ACTION_TAKEN_WRITE_SELECT = {
  ...ACTION_TAKEN_DETAIL_SELECT,
  idempotencyKey: true,
  idempotencyPayloadHash: true,
  performedById: true,
  updatedById: true,
} as const;

class ActionTakenNotFoundError extends Error {}
class TicketNotFoundError extends Error {}
class ActionTakenLockedError extends Error {}
class IdempotencyKeyReusedError extends Error {}

class ActionTakenVersionConflictError extends Error {
  constructor(public readonly actionTaken: ActionTakenRecord) {
    super('This Action Taken changed in another session.');
  }
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function parseIdempotencyKey(value: string | undefined): string | null {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002';
}

function getDatabase(database: ActionTakenApiDatabase): ActionTakenApiDatabase {
  if (!database.$transaction || !database.$queryRaw || !database.ticket?.findUnique || !database.ticket.update) {
    throw new Error('Action Taken database access is unavailable.');
  }
  return database;
}

async function lockTicket(
  database: ActionTakenTransactionDatabase,
  ticketId: number,
): Promise<TicketForAction> {
  if (!database.$queryRaw || !database.ticket?.findUnique) {
    throw new Error('Action Taken transaction access is unavailable.');
  }
  const rows = await database.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`,
  );
  if (rows.length === 0) throw new TicketNotFoundError();
  const ticket = await database.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true, currentStatus: true, version: true },
  });
  if (!ticket) throw new TicketNotFoundError();
  return ticket;
}

function actionTakenFound(
  database: ActionTakenTransactionDatabase,
): NonNullable<ActionTakenTransactionDatabase['actionTaken']> {
  if (!database.actionTaken?.findUnique || !database.actionTaken.findFirst
      || !database.actionTaken.create || !database.actionTaken.update) {
    throw new Error('Action Taken database access is unavailable.');
  }
  return database.actionTaken as NonNullable<ActionTakenTransactionDatabase['actionTaken']>;
}

async function findByIdempotencyKey(
  database: ActionTakenTransactionDatabase,
  performerId: number,
  idempotencyKey: string,
): Promise<ActionTakenRow | null> {
  const actions = actionTakenFound(database);
  return actions.findUnique({
    where: {
      performedById_idempotencyKey: {
        performedById: performerId,
        idempotencyKey,
      },
    },
    select: ACTION_TAKEN_WRITE_SELECT,
  });
}

function isSameMutableAction(action: ActionTakenRow, input: UpdateActionTakenInput): boolean {
  return action.actionAt.getTime() === input.actionAt.getTime()
    && action.description === input.description
    && action.result === input.result
    && action.followUpRequired === input.followUpRequired
    && action.followUpCompleted === input.followUpCompleted
    && action.followUpNote === input.followUpNote
    && action.attachmentNotes === input.attachmentNotes;
}

function serializeWriteResult(action: ActionTakenRow) {
  return serializeActionTaken(action, true);
}

function sendValidationFailure(response: Response, error: ActionTakenValidationError): void {
  response.status(400).json({
    error: 'Please correct the Action Taken fields.',
    code: 'VALIDATION_FAILED',
    fieldErrors: error.fieldErrors,
  });
}

function sendActionTakenFailure(response: Response, error: unknown): void {
  if (error instanceof ActionTakenValidationError) {
    sendValidationFailure(response, error);
    return;
  }
  if (error instanceof TicketNotFoundError) {
    response.status(404).json({ error: 'Ticket not found.', code: 'TICKET_NOT_FOUND' });
    return;
  }
  if (error instanceof ActionTakenNotFoundError) {
    response.status(404).json({ error: 'Action Taken not found.', code: 'ACTION_TAKEN_NOT_FOUND' });
    return;
  }
  if (error instanceof ActionTakenLockedError) {
    response.status(409).json({
      error: 'Reopen this Ticket before changing Actions Taken.',
      code: 'ACTION_TAKEN_LOCKED',
    });
    return;
  }
  if (error instanceof IdempotencyKeyReusedError) {
    response.status(409).json({
      error: 'This Idempotency-Key was already used for a different request.',
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    return;
  }
  if (error instanceof ActionTakenVersionConflictError) {
    response.status(409).json({
      error: error.message,
      code: 'ACTION_TAKEN_VERSION_CONFLICT',
      actionTaken: serializeWriteResult(error.actionTaken as ActionTakenRow),
    });
    return;
  }
  console.error('TokTickIT Actions Taken API error:', error);
  response.status(500).json({
    error: 'Unable to save the Action Taken record.',
    code: 'INTERNAL_ERROR',
  });
}

export function createActionsTakenRouter(database: ActionTakenApiDatabase) {
  const router = Router();
  const authDatabase = database as unknown as AuthDatabaseLike;

  router.post(
    '/staff/tickets/:ticketId/actions',
    requireRole(authDatabase, ['IT_STAFF', 'ADMINISTRATOR']),
    requireCsrf(),
    async (request, response) => {
      try {
        if (!request.auth) {
          sendAuthenticationRequired(response);
          return;
        }
        const ticketId = parsePositiveInteger(request.params.ticketId);
        if (ticketId === null) {
          throw new ActionTakenValidationError({ ticketId: 'A valid ticketId is required.' });
        }
        const key = parseIdempotencyKey(request.get('Idempotency-Key'));
        if (!key) {
          throw new ActionTakenValidationError({ idempotencyKey: 'A valid UUID Idempotency-Key is required.' });
        }
        const input = parseCreateActionTakenPayload(request.body);
        const actionDatabase = getDatabase(database);
        const requestFingerprint = createActionTakenFingerprint(ticketId, input);
        const actorId = request.auth.user.id;

        let row: ActionTakenRow;
        let replayed = false;
        try {
          const result = await actionDatabase.$transaction!(async (transaction) => {
            const existing = await findByIdempotencyKey(transaction, actorId, key);
            if (existing) {
              if (existing.idempotencyPayloadHash !== requestFingerprint) {
                throw new IdempotencyKeyReusedError();
              }
              return { row: existing, replayed: true };
            }

            const ticket = await lockTicket(transaction, ticketId);
            if (!ACTIVE_TICKET_STATUSES.has(ticket.currentStatus)) {
              throw new ActionTakenLockedError();
            }
            const actions = actionTakenFound(transaction);
            const now = new Date();
            const created = await actions.create({
              data: {
                ticketId,
                actionAt: input.actionAt,
                description: input.description,
                result: input.result,
                performedById: actorId,
                followUpRequired: input.followUpRequired,
                followUpCompleted: false,
                followUpNote: input.followUpNote,
                attachmentNotes: input.attachmentNotes,
                idempotencyKey: key,
                idempotencyPayloadHash: requestFingerprint,
                version: 1,
                updatedById: actorId,
              },
              select: ACTION_TAKEN_WRITE_SELECT,
            });
            await transaction.ticket!.update({
              where: { id: ticketId },
              data: {
                version: { increment: 1 },
                lastStaffActivityAt: now,
                lastRequesterVisibleActivityAt: now,
              },
            });
            return { row: created, replayed: false };
          });
          row = result.row;
          replayed = result.replayed;
        } catch (error) {
          if (!isUniqueConflict(error)) throw error;
          const existing = await findByIdempotencyKey(actionDatabase, actorId, key);
          if (!existing) throw error;
          if (existing.idempotencyPayloadHash !== requestFingerprint) {
            throw new IdempotencyKeyReusedError();
          }
          row = existing;
          replayed = true;
        }

        response.status(replayed ? 200 : 201).json({
          actionTaken: serializeWriteResult(row),
          ...(replayed ? { replayed: true } : {}),
        });
      } catch (error) {
        sendActionTakenFailure(response, error);
      }
    },
  );

  router.patch(
    '/staff/tickets/:ticketId/actions/:actionId',
    requireRole(authDatabase, ['IT_STAFF', 'ADMINISTRATOR']),
    requireCsrf(),
    async (request, response) => {
      try {
        if (!request.auth) {
          sendAuthenticationRequired(response);
          return;
        }
        const ticketId = parsePositiveInteger(request.params.ticketId);
        const actionId = parsePositiveInteger(request.params.actionId);
        const fieldErrors: Record<string, string> = {};
        if (ticketId === null) fieldErrors.ticketId = 'A valid ticketId is required.';
        if (actionId === null) fieldErrors.actionId = 'A valid actionId is required.';
        if (Object.keys(fieldErrors).length > 0) throw new ActionTakenValidationError(fieldErrors);
        const input = parseUpdateActionTakenPayload(request.body);
        const actionDatabase = getDatabase(database);

        const result = await actionDatabase.$transaction!(async (transaction) => {
          const ticket = await lockTicket(transaction, ticketId as number);
          const actions = actionTakenFound(transaction);
          const action = await actions.findFirst({
            where: { id: actionId as number, ticketId: ticketId as number },
            select: ACTION_TAKEN_WRITE_SELECT,
          });
          if (!action) throw new ActionTakenNotFoundError();

          if (isSameMutableAction(action, input)) {
            return { row: action, replayed: true };
          }
          if (!ACTIVE_TICKET_STATUSES.has(ticket.currentStatus)) {
            throw new ActionTakenLockedError();
          }
          if (action.version !== input.expectedVersion) {
            throw new ActionTakenVersionConflictError(action);
          }

          const now = new Date();
          const updated = await actions.update({
            where: { id: actionId as number },
            data: {
              actionAt: input.actionAt,
              description: input.description,
              result: input.result,
              followUpRequired: input.followUpRequired,
              followUpCompleted: input.followUpCompleted,
              followUpNote: input.followUpNote,
              attachmentNotes: input.attachmentNotes,
              version: { increment: 1 },
              updatedAt: now,
              updatedById: request.auth!.user.id,
            },
            select: ACTION_TAKEN_WRITE_SELECT,
          });
          await transaction.ticket!.update({
            where: { id: ticket.id },
            data: {
              version: { increment: 1 },
              lastStaffActivityAt: now,
              lastRequesterVisibleActivityAt: now,
            },
          });
          return { row: updated, replayed: false };
        });

        response.status(200).json({
          actionTaken: serializeWriteResult(result.row),
          ...(result.replayed ? { replayed: true } : {}),
        });
      } catch (error) {
        sendActionTakenFailure(response, error);
      }
    },
  );

  return router;
}
