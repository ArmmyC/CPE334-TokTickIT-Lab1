
import { createHash } from 'node:crypto';

export type ActionTakenInput = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpCompleted: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export type CreateActionTakenInput = ActionTakenInput & {
  followUpCompleted: false;
};

export type UpdateActionTakenInput = ActionTakenInput & {
  expectedVersion: number;
};

export type ActionTakenActor = {
  id: number;
  name: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
};

export type ActionTakenRecord = {
  id: number;
  ticketId: number;
  actionAt: Date;
  description: string;
  result: string;
  performedBy: ActionTakenActor;
  followUpRequired: boolean;
  followUpCompleted: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: ActionTakenActor;
};

export const ACTION_TAKEN_DETAIL_SELECT = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  performedBy: { select: { id: true, name: true, role: true } },
  followUpRequired: true,
  followUpCompleted: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: { id: true, name: true, role: true } },
} as const;

export const REQUESTER_ACTION_TAKEN_DETAIL_SELECT = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  performedBy: { select: { id: true, name: true, role: true } },
  followUpRequired: true,
  followUpCompleted: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function serializeActionTaken(action: ActionTakenRecord, includeEditor: boolean) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    actionAt: action.actionAt,
    description: action.description,
    result: action.result,
    performedBy: action.performedBy,
    followUpRequired: action.followUpRequired,
    followUpCompleted: action.followUpCompleted,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    version: action.version,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    ...(includeEditor ? { updatedBy: action.updatedBy } : {}),
  };
}

export class ActionTakenValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Action Taken validation failed.');
  }
}

export function createActionTakenFingerprint(ticketId: number, input: CreateActionTakenInput): string {
  const canonicalPayload = JSON.stringify({
    ticketId,
    actionAt: input.actionAt.toISOString(),
    description: input.description,
    result: input.result,
    followUpRequired: input.followUpRequired,
    followUpNote: input.followUpNote,
    attachmentNotes: input.attachmentNotes,
  });
  return createHash('sha256').update(canonicalPayload).digest('hex');
}

const CREATE_FIELDS = new Set([
  'actionAt',
  'description',
  'result',
  'followUpRequired',
  'followUpNote',
  'attachmentNotes',
]);

const UPDATE_FIELDS = new Set([
  'expectedVersion',
  ...CREATE_FIELDS,
  'followUpCompleted',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyFields(
  payload: Record<string, unknown>,
  allowedFields: Set<string>,
  fieldErrors: Record<string, string>,
): void {
  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      fieldErrors[key] = 'This field is not accepted.';
    }
  }
}

function parseActionAt(value: unknown, now: Date, fieldErrors: Record<string, string>): Date | null {
  if (typeof value !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    fieldErrors.actionAt = 'Action Date/Time must be an offset-aware ISO 8601 timestamp.';
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    fieldErrors.actionAt = 'Action Date/Time must be a valid timestamp.';
    return null;
  }
  if (parsed.getTime() > now.getTime()) {
    fieldErrors.actionAt = 'Action Date/Time cannot be in the future.';
    return null;
  }
  return parsed;
}

function parseRequiredText(
  value: unknown,
  field: 'description' | 'result',
  fieldErrors: Record<string, string>,
): string {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (parsed.length < 1 || parsed.length > 4000) {
    fieldErrors[field] = `${field === 'description' ? 'Action Description' : 'Result'} must be between 1 and 4000 characters after trimming.`;
  }
  return parsed;
}

function parseOptionalText(
  value: unknown,
  field: 'followUpNote' | 'attachmentNotes',
  maxLength: number,
  fieldErrors: Record<string, string>,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    fieldErrors[field] = 'This field must be text or null.';
    return null;
  }
  const parsed = value.trim();
  if (parsed.length > maxLength) {
    fieldErrors[field] = `This field must be ${maxLength} characters or fewer after trimming.`;
  }
  return parsed.length > 0 ? parsed : null;
}

function validateActionFields(
  payload: Record<string, unknown>,
  now: Date,
  fieldErrors: Record<string, string>,
  isUpdate: boolean,
): ActionTakenInput {
  const actionAt = parseActionAt(payload.actionAt, now, fieldErrors);
  const description = parseRequiredText(payload.description, 'description', fieldErrors);
  const result = parseRequiredText(payload.result, 'result', fieldErrors);
  const followUpRequired = payload.followUpRequired;
  if (typeof followUpRequired !== 'boolean') {
    fieldErrors.followUpRequired = 'Follow-Up Required must be true or false.';
  }
  const followUpNote = parseOptionalText(payload.followUpNote, 'followUpNote', 2000, fieldErrors);
  const attachmentNotes = parseOptionalText(payload.attachmentNotes, 'attachmentNotes', 2000, fieldErrors);

  if (followUpRequired === true && !followUpNote) {
    fieldErrors.followUpNote = 'Follow-up Note is required when Follow-Up Required is yes.';
  }

  let followUpCompleted = false;
  if (isUpdate) {
    if (typeof payload.followUpCompleted !== 'boolean') {
      fieldErrors.followUpCompleted = 'Follow-Up Completed must be true or false.';
    } else {
      followUpCompleted = payload.followUpCompleted;
    }
    if (followUpRequired === false && followUpCompleted) {
      fieldErrors.followUpCompleted = 'Follow-Up Completed must be no when Follow-Up Required is no.';
    }
  }

  if (Object.keys(fieldErrors).length > 0 || actionAt === null) {
    throw new ActionTakenValidationError(fieldErrors);
  }

  return {
    actionAt,
    description,
    result,
    followUpRequired: followUpRequired as boolean,
    followUpCompleted,
    followUpNote: followUpRequired === true ? followUpNote : null,
    attachmentNotes,
  };
}

export function parseCreateActionTakenPayload(
  value: unknown,
  now: Date = new Date(),
): CreateActionTakenInput {
  if (!isRecord(value)) {
    throw new ActionTakenValidationError({ form: 'Action Taken details are required.' });
  }
  const fieldErrors: Record<string, string> = {};
  hasOnlyFields(value, CREATE_FIELDS, fieldErrors);
  const input = validateActionFields(value, now, fieldErrors, false);
  return { ...input, followUpCompleted: false };
}

export function parseUpdateActionTakenPayload(
  value: unknown,
  now: Date = new Date(),
): UpdateActionTakenInput {
  if (!isRecord(value)) {
    throw new ActionTakenValidationError({ form: 'Action Taken details are required.' });
  }
  const fieldErrors: Record<string, string> = {};
  hasOnlyFields(value, UPDATE_FIELDS, fieldErrors);
  const expectedVersion = value.expectedVersion;
  if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    fieldErrors.expectedVersion = 'Expected version must be a positive whole number.';
  }
  const input = validateActionFields(value, now, fieldErrors, true);
  return { ...input, expectedVersion: expectedVersion as number };
}
