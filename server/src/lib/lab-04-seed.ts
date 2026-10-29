import type { PrismaClient } from '@prisma/client';
import {
  createActionTakenFingerprint,
  type CreateActionTakenInput,
} from '../tickets/actions-taken.js';

type ActionTakenSeed = {
  ticketNumber: string;
  performerEmail: string;
  idempotencyKey: string;
  hoursAgo: number;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpCompleted: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

const ACTION_TAKEN_SEEDS: readonly ActionTakenSeed[] = [
  {
    ticketNumber: 'TKT-2026-000002',
    performerEmail: 'somchai@example.test',
    idempotencyKey: '00000004-0000-4000-8000-000000000201',
    hoursAgo: 30,
    description: 'Refreshed the VPN account policy cache.',
    result: 'The requester can authenticate with the rotated password.',
    followUpRequired: false,
    followUpCompleted: false,
    followUpNote: null,
    attachmentNotes: 'No additional attachment was needed.',
  },
  {
    ticketNumber: 'TKT-2026-000002',
    performerEmail: 'chaiwat@example.test',
    idempotencyKey: '00000004-0000-4000-8000-000000000202',
    hoursAgo: 20,
    description: 'Confirmed VPN access from the campus network.',
    result: 'The connection remains stable after the policy refresh.',
    followUpRequired: false,
    followUpCompleted: false,
    followUpNote: null,
    attachmentNotes: null,
  },
  {
    ticketNumber: 'TKT-2026-000003',
    performerEmail: 'somchai@example.test',
    idempotencyKey: '00000004-0000-4000-8000-000000000203',
    hoursAgo: 18,
    description: 'Collected the failing course page bundle and browser trace.',
    result: 'The page still renders blank while the stale widget bundle is present.',
    followUpRequired: true,
    followUpCompleted: false,
    followUpNote: 'Replace the widget bundle, then ask the requester to verify the page.',
    attachmentNotes: 'Browser trace is recorded in the existing Attachment list.',
  },
  {
    ticketNumber: 'TKT-2026-000004',
    performerEmail: 'chaiwat@example.test',
    idempotencyKey: '00000004-0000-4000-8000-000000000204',
    hoursAgo: 16,
    description: 'Cleared the stuck print queue and restarted the shared printer.',
    result: 'The queued test page printed successfully.',
    followUpRequired: true,
    followUpCompleted: true,
    followUpNote: 'Confirm the next requester print job completes normally.',
    attachmentNotes: null,
  },
  {
    ticketNumber: 'TKT-2026-000007',
    performerEmail: 'nalinee@example.test',
    idempotencyKey: '00000004-0000-4000-8000-000000000207',
    hoursAgo: 12,
    description: 'Reinstalled the camera driver and checked device detection.',
    result: 'The camera is detected, pending a video-call verification.',
    followUpRequired: true,
    followUpCompleted: false,
    followUpNote: 'Verify the camera in a video call with the requester.',
    attachmentNotes: null,
  },
];

function createInput(seed: ActionTakenSeed): CreateActionTakenInput {
  return {
    actionAt: new Date(Date.UTC(2026, 9, 29) - seed.hoursAgo * 60 * 60 * 1000),
    description: seed.description,
    result: seed.result,
    followUpRequired: seed.followUpRequired,
    followUpCompleted: false,
    followUpNote: seed.followUpNote,
    attachmentNotes: seed.attachmentNotes,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002';
}

async function ensureSeedAction(database: PrismaClient, seed: ActionTakenSeed): Promise<void> {
  const [ticket, performer] = await Promise.all([
    database.ticket.findUnique({
      where: { ticketNumber: seed.ticketNumber },
      select: { id: true },
    }),
    database.user.findUnique({
      where: { email: seed.performerEmail },
      select: { id: true },
    }),
  ]);
  if (!ticket || !performer) {
    throw new Error(`Lab 4 seed requires Ticket ${seed.ticketNumber} and user ${seed.performerEmail}.`);
  }

  const now = new Date();
  const input = createInput(seed);
  const payloadHash = createActionTakenFingerprint(ticket.id, input);
  const where = {
    performedById_idempotencyKey: {
      performedById: performer.id,
      idempotencyKey: seed.idempotencyKey,
    },
  } as const;

  try {
    await database.$transaction(async (transaction) => {
      const existing = await transaction.actionTaken.findUnique({
        where,
        select: { id: true, idempotencyPayloadHash: true },
      });
      if (existing) {
        if (existing.idempotencyPayloadHash !== payloadHash) {
          throw new Error(`Lab 4 seed key is already bound to different data for ${seed.ticketNumber}.`);
        }
        return;
      }

      await transaction.actionTaken.create({
        data: {
          ticketId: ticket.id,
          actionAt: input.actionAt,
          description: input.description,
          result: input.result,
          performedById: performer.id,
          followUpRequired: input.followUpRequired,
          followUpCompleted: seed.followUpCompleted,
          followUpNote: input.followUpNote,
          attachmentNotes: input.attachmentNotes,
          idempotencyKey: seed.idempotencyKey,
          idempotencyPayloadHash: payloadHash,
          version: 1,
          updatedById: performer.id,
        },
      });
      await transaction.ticket.update({
        where: { id: ticket.id },
        data: {
          version: { increment: 1 },
          lastStaffActivityAt: now,
          lastRequesterVisibleActivityAt: now,
        },
      });
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const concurrentRecord = await database.actionTaken.findUnique({
      where,
      select: { idempotencyPayloadHash: true },
    });
    if (concurrentRecord?.idempotencyPayloadHash !== payloadHash) throw error;
  }
}

export async function seedLab4Data(database: PrismaClient): Promise<void> {
  for (const seed of ACTION_TAKEN_SEEDS) {
    await ensureSeedAction(database, seed);
  }
}
