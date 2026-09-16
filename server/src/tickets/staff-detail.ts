import type { AuthUserRole } from '../auth/types.js';

export type StaffTicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export type StaffTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type StaffTicketAuthor = {
  id: number;
  name: string;
  role: AuthUserRole;
};

export type StaffTicketAttachmentRecord = {
  id: number;
  ticketId: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
};

export type StaffTicketCommunicationRecord = {
  id: number;
  ticketId: number;
  authorId: number;
  content: string;
  createdAt: Date;
  author: StaffTicketAuthor;
};

export type StaffTicketBaseRecord = {
  id: number;
  ticketNumber: string;
  ticketDate: Date;
  summary: string;
  description: string;
  requestedPriority: StaffTicketPriority;
  itPriority: StaffTicketPriority | null;
  currentStatus: StaffTicketStatus;
  requesterResolvedAt: Date | null;
  requesterResolvedBy: StaffTicketAuthor | null;
  createdAt: Date;
  updatedAt: Date;
  requester: {
    id: number;
    name: string;
    email: string;
  };
  owner: ({
    id: number;
    name: string;
    email: string;
    role: AuthUserRole;
  }) | null;
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: number;
    name: string;
  };
};

export type StaffTicketDetailRecord = StaffTicketBaseRecord & {
  attachments: StaffTicketAttachmentRecord[];
  publicComments: StaffTicketCommunicationRecord[];
  internalNotes: StaffTicketCommunicationRecord[];
};

export type StaffTicketDetailDatabase = {
  ticket?: {
    findUnique(args: {
      where: { id: number };
      select: Record<string, unknown>;
    }): Promise<StaffTicketBaseRecord | null>;
    update?(args: {
      where: { id: number };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  user?: {
    findUnique(args: {
      where: { id: number };
      select: Record<string, unknown>;
    }): Promise<{
      id: number;
      name: string;
      email: string;
      role: AuthUserRole;
      isActive: boolean;
    } | null>;
  };
  attachment?: {
    findMany(args: {
      where: { ticketId: number };
      orderBy: { uploadedAt: 'asc' };
      select: Record<string, unknown>;
    }): Promise<StaffTicketAttachmentRecord[]>;
  };
  publicComment?: {
    findMany(args: {
      where: { ticketId: number };
      orderBy: { createdAt: 'asc' };
      select: Record<string, unknown>;
    }): Promise<StaffTicketCommunicationRecord[]>;
  };
  internalNote?: {
    findMany(args: {
      where: { ticketId: number };
      orderBy: { createdAt: 'asc' };
      select: Record<string, unknown>;
    }): Promise<StaffTicketCommunicationRecord[]>;
  };
};

export const STAFF_TICKET_DETAIL_SELECT = {
  id: true,
  ticketNumber: true,
  ticketDate: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  requesterResolvedAt: true,
  requesterResolvedBy: {
    select: { id: true, name: true, role: true },
  },
  createdAt: true,
  updatedAt: true,
  requester: {
    select: { id: true, name: true, email: true },
  },
  owner: {
    select: { id: true, name: true, email: true, role: true },
  },
  category: {
    select: { id: true, name: true },
  },
  relatedSystem: {
    select: { id: true, name: true },
  },
} as const;

const STAFF_ATTACHMENT_SELECT = {
  id: true,
  ticketId: true,
  originalName: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  removedAt: true,
  removalReason: true,
} as const;

const COMMUNICATION_SELECT = {
  id: true,
  ticketId: true,
  authorId: true,
  content: true,
  createdAt: true,
  author: {
    select: { id: true, name: true, role: true },
  },
} as const;

export const STAFF_TICKET_ATTACHMENT_SELECT = STAFF_ATTACHMENT_SELECT;
export const STAFF_TICKET_COMMUNICATION_SELECT = COMMUNICATION_SELECT;

export const STAFF_TICKET_STATUSES: readonly StaffTicketStatus[] = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
];

export const STAFF_TICKET_PRIORITIES: readonly StaffTicketPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export const STAFF_TICKET_STATUS_TRANSITIONS: Readonly<Record<StaffTicketStatus, readonly StaffTicketStatus[]>> = {
  NEW: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  CANCELLED: ['REOPENED'],
};

export class StaffTicketValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Staff Ticket operation validation failed.');
  }
}

export class StaffTicketOwnerConflictError extends Error {
  constructor() {
    super('The selected Ticket owner is not eligible.');
  }
}

export class StaffTicketTransitionConflictError extends Error {
  constructor(
    public readonly currentStatus: StaffTicketStatus,
    public readonly allowedStatuses: readonly StaffTicketStatus[],
  ) {
    super('The requested status transition is not allowed.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyFields(payload: Record<string, unknown>, fields: readonly string[], fieldErrors: Record<string, string>): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      fieldErrors[key] = 'This field is not accepted.';
    }
  }
}

export function parseStaffOwnerPayload(payload: unknown): { ownerId: number | null } {
  const fieldErrors: Record<string, string> = {};
  if (!isRecord(payload)) {
    throw new StaffTicketValidationError({ form: 'Owner details are required.' });
  }
  hasOnlyFields(payload, ['ownerId'], fieldErrors);
  if (!Object.hasOwn(payload, 'ownerId')) {
    fieldErrors.ownerId = 'Owner is required, or use null for Unassigned.';
  } else if (payload.ownerId !== null && (
    typeof payload.ownerId !== 'number'
    || !Number.isSafeInteger(payload.ownerId)
    || payload.ownerId <= 0
  )) {
    fieldErrors.ownerId = 'Owner id must be a positive integer or null.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new StaffTicketValidationError(fieldErrors);
  }
  return { ownerId: payload.ownerId as number | null };
}

export function parseStaffPriorityPayload(payload: unknown): { itPriority: StaffTicketPriority } {
  const fieldErrors: Record<string, string> = {};
  if (!isRecord(payload)) {
    throw new StaffTicketValidationError({ form: 'IT Priority is required.' });
  }
  hasOnlyFields(payload, ['itPriority'], fieldErrors);
  if (typeof payload.itPriority !== 'string' || !STAFF_TICKET_PRIORITIES.includes(payload.itPriority as StaffTicketPriority)) {
    fieldErrors.itPriority = 'IT Priority must be LOW, MEDIUM, HIGH, or URGENT.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new StaffTicketValidationError(fieldErrors);
  }
  return { itPriority: payload.itPriority as StaffTicketPriority };
}

export function parseStaffStatusPayload(payload: unknown): {
  currentStatus: StaffTicketStatus;
  confirmed: boolean;
} {
  const fieldErrors: Record<string, string> = {};
  if (!isRecord(payload)) {
    throw new StaffTicketValidationError({ form: 'Status details are required.' });
  }
  hasOnlyFields(payload, ['currentStatus', 'confirmed'], fieldErrors);
  if (typeof payload.currentStatus !== 'string' || !STAFF_TICKET_STATUSES.includes(payload.currentStatus as StaffTicketStatus)) {
    fieldErrors.currentStatus = 'Current Status is not valid.';
  }
  if (payload.confirmed !== undefined && typeof payload.confirmed !== 'boolean') {
    fieldErrors.confirmed = 'Confirmation must be true or false.';
  }
  const currentStatus = payload.currentStatus as StaffTicketStatus;
  if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(currentStatus) && payload.confirmed !== true) {
    fieldErrors.confirmed = 'Confirmation is required for this status.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new StaffTicketValidationError(fieldErrors);
  }
  return {
    currentStatus,
    confirmed: payload.confirmed === true,
  };
}

function serializeStaffAttachment(attachment: StaffTicketAttachmentRecord) {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    uploadedAt: attachment.uploadedAt,
    removedAt: attachment.removedAt,
    removalReason: attachment.removalReason,
    downloadAvailable: attachment.removedAt === null,
  };
}

function serializeCommunication(communication: StaffTicketCommunicationRecord) {
  return {
    id: communication.id,
    content: communication.content,
    author: communication.author,
    createdAt: communication.createdAt,
  };
}

export function serializeStaffTicketDetail(
  ticket: StaffTicketDetailRecord,
) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate,
    summary: ticket.summary,
    description: ticket.description,
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    owner: ticket.owner,
    attachments: ticket.attachments.map(serializeStaffAttachment),
    publicComments: ticket.publicComments.map(serializeCommunication),
    internalNotes: ticket.internalNotes.map(serializeCommunication),
    requesterResolution: ticket.requesterResolvedAt && ticket.requesterResolvedBy
      ? {
          resolvedAt: ticket.requesterResolvedAt,
          resolvedBy: ticket.requesterResolvedBy,
        }
      : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
