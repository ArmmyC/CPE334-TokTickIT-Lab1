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

export type StaffTicketDetailDatabase = {
  ticket?: {
    findUnique(args: {
      where: { id: number };
      select: Record<string, unknown>;
    }): Promise<StaffTicketBaseRecord | null>;
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
  ticket: StaffTicketBaseRecord & {
    attachments: StaffTicketAttachmentRecord[];
    publicComments: StaffTicketCommunicationRecord[];
    internalNotes: StaffTicketCommunicationRecord[];
  },
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
