import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import type { Response } from 'express';
import multer, { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { prisma } from './lib/prisma.js';
import { localAttachmentStorage, type AttachmentStorage } from './lib/attachment-storage.js';
import {
  createSessionMiddleware,
  enforceSameOrigin,
  requireCsrf,
  requireNormalAccess,
  requireRole,
  sendAuthenticationRequired,
} from './auth/middleware.js';
import { createAuthRouter } from './auth/routes.js';
import type { AuthDatabase } from './auth/types.js';
import {
  AdminUserConflictError,
  AdminUserNotFoundError,
  AdminUserValidationError,
  createAdminUser,
  listAdminUsers,
  parseAdminUserId,
  parseCreateAdminUserPayload,
  parseInitialPasswordPayload,
  parseAdminUserQuery,
  parseUpdateAdminUserPayload,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUserDatabase,
} from './admin/users.js';
import {
  buildStaffQueueOrderBy,
  buildStaffQueueWhere,
  parseStaffQueueQuery,
  serializeStaffQueueItem,
  STAFF_QUEUE_SELECT,
  StaffQueueValidationError,
  type StaffQueueDatabase,
} from './tickets/staff-queue.js';
import {
  serializeStaffTicketDetail,
  STAFF_TICKET_ATTACHMENT_SELECT,
  STAFF_TICKET_COMMUNICATION_SELECT,
  STAFF_TICKET_DETAIL_SELECT,
  STAFF_TICKET_STATUS_TRANSITIONS,
  parseStaffCommunicationPayload,
  parseStaffOwnerPayload,
  parseStaffPriorityPayload,
  parseStaffStatusPayload,
  StaffTicketOwnerConflictError,
  StaffTicketResolutionConflictError,
  StaffTicketTransitionConflictError,
  StaffTicketValidationError,
  type StaffTicketDetailRecord,
  type StaffTicketDetailDatabase,
} from './tickets/staff-detail.js';

export type CategoryRecord = {
  id: number;
  name: string;
};

export type CategoryApiDatabase = {
  category: {
    findMany(args: {
      where?: { isActive?: true };
      select: { id: true; name: true };
      orderBy: { id: 'asc' };
    }): Promise<CategoryRecord[]>;
    findUnique?(args: {
      where: { id: number };
      select: { id: true; isActive: true };
    }): Promise<{ id: number; isActive: boolean } | null>;
  };
};

export type RelatedSystemRecord = {
  id: number;
  name: string;
};

export type RelatedSystemApiDatabase = {
  relatedSystem: {
    findMany(args: {
      where: { isActive: true };
      select: { id: true; name: true };
      orderBy: { name: 'asc' };
    }): Promise<RelatedSystemRecord[]>;
    findUnique(args: {
      where: { id: number };
      select: { id: true; isActive: true };
    }): Promise<{ id: number; isActive: boolean } | null>;
  };
};

export type TicketRecord = {
  id: number;
  ticketNumber: string;
  ticketDate: Date;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TicketDetailRecord = TicketRecord & {
  requester: {
    id: number;
    name: string;
    email: string;
  };
  requesterResolvedAt: Date | null;
  requesterResolvedBy: {
    id: number;
    name: string;
    role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  } | null;
  owner: {
    id: number;
    name: string;
    email: string;
    role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  } | null;
  category: CategoryRecord;
  relatedSystem: RelatedSystemRecord;
};

export type PublicCommentRecord = {
  id: number;
  ticketId: number;
  authorId: number;
  content: string;
  createdAt: Date;
  author: {
    id: number;
    name: string;
    role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  };
};

export type AttachmentRecord = {
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

type TicketListSearchFilter = {
  contains: string;
  mode: 'insensitive';
};

type TicketListWhere = {
  requesterId: number;
  OR?: Array<{
    ticketNumber?: TicketListSearchFilter;
    summary?: TicketListSearchFilter;
    description?: TicketListSearchFilter;
  }>;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  currentStatus?: 'NEW';
};

type TicketListOrderBy =
  | { ticketDate: 'asc' | 'desc' }
  | { updatedAt: 'asc' | 'desc' }
  | { ticketNumber: 'asc' | 'desc' }
  | { id: 'desc' };

export type TicketListItem = {
  id: number;
  ticketNumber: string;
  ticketDate: Date;
  summary: string;
  category: CategoryRecord;
  relatedSystem: RelatedSystemRecord;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  updatedAt: Date;
};

type TicketListFindManyArgs = {
  where: TicketListWhere;
  skip: number;
  take: number;
  orderBy: TicketListOrderBy[];
  select: {
    id: true;
    ticketNumber: true;
    ticketDate: true;
    summary: true;
    category: { select: { id: true; name: true } };
    relatedSystem: { select: { id: true; name: true } };
    requestedPriority: true;
    itPriority: true;
    currentStatus: true;
    updatedAt: true;
  };
};

type TicketListCountArgs = { where: TicketListWhere };

type TicketTransactionDatabase = {
  category: {
    findUnique(args: {
      where: { id: number };
      select: { id: true; isActive: true };
    }): Promise<{ id: number; isActive: boolean } | null>;
  };
  relatedSystem: RelatedSystemApiDatabase['relatedSystem'];
  ticket: {
    create(args: { data: Record<string, unknown> }): Promise<TicketRecord>;
    update(args: {
      where: { id: number };
      data: { ticketNumber: string };
    }): Promise<TicketRecord>;
  };
};

export type TicketApiDatabase = {
  $transaction<T>(callback: (database: TicketTransactionDatabase) => Promise<T>): Promise<T>;
  ticket: {
    findUnique(args: {
      where: { id: number };
      select: { id: true; requesterId: true };
    }): Promise<{ id: number; requesterId: number } | null>;
    findMany?(args: TicketListFindManyArgs): Promise<TicketListItem[]>;
    count?(args: TicketListCountArgs): Promise<number>;
  };
  attachment: {
    count(args: { where: { ticketId: number; removedAt: null } }): Promise<number>;
    create(args: { data: Record<string, unknown> }): Promise<AttachmentRecord>;
    findUnique?(args: { where: { id: number } }): Promise<AttachmentRecord | null>;
    findMany?(args: {
      where: { ticketId: number };
      orderBy?: { uploadedAt: 'asc' | 'desc' };
      select?: Record<string, unknown>;
    }): Promise<AttachmentRecord[]>;
    update?(args: {
      where: { id: number };
      data: { removedAt: Date; removalReason: string };
    }): Promise<AttachmentRecord>;
  };
  publicComment?: {
    findMany(args: {
      where: { ticketId: number };
      orderBy: { createdAt: 'asc' };
      select: Record<string, unknown>;
    }): Promise<PublicCommentRecord[]>;
  };
};

export type ApplicationApiDatabase = CategoryApiDatabase &
  Partial<RelatedSystemApiDatabase & TicketApiDatabase & AuthDatabase> &
  Partial<AdminUserDatabase>;

type CreateTicketInput = {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
};

type RequestedPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const REQUESTED_PRIORITIES = new Set<RequestedPriority>(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ACTIVE_ATTACHMENTS = 5;
const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const TICKET_LIST_PAGE_SIZES = new Set([10, 20, 50]);
const TICKET_LIST_SORT_FIELDS = new Set(['ticketDate', 'updatedAt', 'ticketNumber']);
const TICKET_LIST_SORT_ORDERS = new Set(['asc', 'desc']);

class TicketValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Ticket validation failed.');
  }
}

class AttachmentRequestError extends Error {
  constructor(public readonly status: 400 | 404 | 409 | 413 | 415, message: string) {
    super(message);
  }
}

class TicketListValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Ticket list query validation failed.');
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

function parseQueryString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'string' ? value : null;
}

type TicketListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  currentStatus?: 'NEW';
  sortBy: 'ticketDate' | 'updatedAt' | 'ticketNumber';
  sortOrder: 'asc' | 'desc';
};

function parseTicketListQuery(query: unknown): TicketListQuery {
  const source = isRecord(query) ? query : {};
  const fieldErrors: Record<string, string> = {};

  const pageValue = parseQueryString(source.page);
  const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue);
  if (page === null) {
    fieldErrors.page = 'Page must be a positive integer.';
  }

  const pageSizeValue = parseQueryString(source.pageSize);
  const pageSize = pageSizeValue === undefined ? 10 : parsePositiveInteger(pageSizeValue);
  if (pageSize === null || !TICKET_LIST_PAGE_SIZES.has(pageSize)) {
    fieldErrors.pageSize = 'Page size must be 10, 20, or 50.';
  }

  const searchValue = parseQueryString(source.search);
  if (searchValue === null) {
    fieldErrors.search = 'Search must be a single text value.';
  }
  const search = searchValue?.trim();
  if (search && search.length > 120) {
    fieldErrors.search = 'Search must be 120 characters or fewer.';
  }

  const categoryValue = parseQueryString(source.categoryId);
  const categoryId = categoryValue === undefined ? undefined : parsePositiveInteger(categoryValue);
  if (categoryValue !== undefined && categoryId === null) {
    fieldErrors.categoryId = 'Category id must be a positive integer.';
  }

  const relatedSystemValue = parseQueryString(source.relatedSystemId);
  const relatedSystemId = relatedSystemValue === undefined
    ? undefined
    : parsePositiveInteger(relatedSystemValue);
  if (relatedSystemValue !== undefined && relatedSystemId === null) {
    fieldErrors.relatedSystemId = 'Related System id must be a positive integer.';
  }

  const requestedPriorityValue = parseQueryString(source.requestedPriority);
  if (requestedPriorityValue !== undefined &&
      (requestedPriorityValue === null || !REQUESTED_PRIORITIES.has(requestedPriorityValue as RequestedPriority))) {
    fieldErrors.requestedPriority = 'Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.';
  }

  const currentStatusValue = parseQueryString(source.currentStatus);
  if (currentStatusValue !== undefined && currentStatusValue !== 'NEW') {
    fieldErrors.currentStatus = 'Current Status must be NEW.';
  }

  const sortByValue = parseQueryString(source.sortBy);
  const sortBy = sortByValue === undefined ? 'updatedAt' : sortByValue;
  if (sortBy === null || !TICKET_LIST_SORT_FIELDS.has(sortBy)) {
    fieldErrors.sortBy = 'Sort By must be ticketDate, updatedAt, or ticketNumber.';
  }

  const sortOrderValue = parseQueryString(source.sortOrder);
  const sortOrder = sortOrderValue === undefined ? 'desc' : sortOrderValue;
  if (sortOrder === null || !TICKET_LIST_SORT_ORDERS.has(sortOrder)) {
    fieldErrors.sortOrder = 'Sort Order must be asc or desc.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new TicketListValidationError(fieldErrors);
  }

  return {
    page: page as number,
    pageSize: pageSize as number,
    ...(search ? { search } : {}),
    ...(categoryId === undefined ? {} : { categoryId: categoryId as number }),
    ...(relatedSystemId === undefined ? {} : { relatedSystemId: relatedSystemId as number }),
    ...(requestedPriorityValue === undefined ? {} : { requestedPriority: requestedPriorityValue as RequestedPriority }),
    ...(currentStatusValue === undefined ? {} : { currentStatus: currentStatusValue as 'NEW' }),
    sortBy: sortBy as TicketListQuery['sortBy'],
    sortOrder: sortOrder as TicketListQuery['sortOrder'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCreateTicketPayload(payload: unknown): CreateTicketInput {
  if (!isRecord(payload)) {
    throw new TicketValidationError({ form: 'Ticket details are required.' });
  }

  const fieldErrors: Record<string, string> = {};
  const allowedFields = new Set([
    'requesterId',
    'categoryId',
    'relatedSystemId',
    'summary',
    'description',
    'requestedPriority',
  ]);
  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      fieldErrors[key] = key === 'ticketNumber'
        ? 'Ticket Number is generated by the server and cannot be supplied.'
        : 'This field is not accepted.';
    }
  }

  const categoryId = parsePositiveInteger(payload.categoryId);
  if (categoryId === null) {
    fieldErrors.categoryId = 'Category is required.';
  }
  const relatedSystemId = parsePositiveInteger(payload.relatedSystemId);
  if (relatedSystemId === null) {
    fieldErrors.relatedSystemId = 'Related System is required.';
  }

  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  if (summary.length < 5 || summary.length > 120) {
    fieldErrors.summary = 'Summary must be between 5 and 120 characters after trimming.';
  }

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (description.length < 10 || description.length > 4000) {
    fieldErrors.description = 'Description must be between 10 and 4000 characters after trimming.';
  }

  const requestedPriority = payload.requestedPriority;
  if (typeof requestedPriority !== 'string' || !REQUESTED_PRIORITIES.has(requestedPriority as RequestedPriority)) {
    fieldErrors.requestedPriority = 'Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new TicketValidationError(fieldErrors);
  }

  return {
    categoryId: categoryId as number,
    relatedSystemId: relatedSystemId as number,
    summary,
    description,
    requestedPriority: requestedPriority as RequestedPriority,
  };
}

function serializeTicket(ticket: TicketRecord) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate,
    requesterId: ticket.requesterId,
    categoryId: ticket.categoryId,
    relatedSystemId: ticket.relatedSystemId,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function serializeTicketDetail(ticket: TicketDetailRecord) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate,
    requester: ticket.requester,
    owner: ticket.owner,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function serializeAttachment(attachment: AttachmentRecord) {
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

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function validateAttachmentFile(file: Express.Multer.File): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeType = ATTACHMENT_MIME_BY_EXTENSION[extension];
  if (!expectedMimeType || file.mimetype.toLowerCase() !== expectedMimeType) {
    throw new AttachmentRequestError(415, 'This attachment type is not supported.');
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentRequestError(413, 'This attachment is larger than 5 MB.');
  }
  if (path.basename(file.originalname).length > 255) {
    throw new AttachmentRequestError(400, 'The attachment filename is too long.');
  }
}

function attachmentContentDisposition(originalName: string, disposition: 'inline' | 'attachment'): string {
  const safeName = path.basename(originalName.replaceAll('\\', '/')).replace(/["\r\n]/g, '_') || 'attachment';
  return `${disposition}; filename="${safeName}"`;
}

function parseAttachmentId(value: unknown): number {
  const attachmentId = parsePositiveInteger(value);
  if (attachmentId === null) {
    throw new AttachmentRequestError(400, 'A valid attachmentId is required.');
  }
  return attachmentId;
}

async function loadStaffTicketDetail(
  database: StaffTicketDetailDatabase,
  ticketId: number,
): Promise<StaffTicketDetailRecord | null> {
  const ticketClient = database.ticket;
  const attachmentClient = database.attachment;
  const publicCommentClient = database.publicComment;
  const internalNoteClient = database.internalNote;
  if (
    !ticketClient?.findUnique
    || !attachmentClient?.findMany
    || !publicCommentClient?.findMany
    || !internalNoteClient?.findMany
  ) {
    throw new Error('Staff Ticket Detail database access is unavailable.');
  }

  const ticket = await ticketClient.findUnique({
    where: { id: ticketId },
    select: STAFF_TICKET_DETAIL_SELECT,
  });
  if (!ticket) {
    return null;
  }

  const [attachments, publicComments, internalNotes] = await Promise.all([
    attachmentClient.findMany({
      where: { ticketId },
      orderBy: { uploadedAt: 'asc' },
      select: STAFF_TICKET_ATTACHMENT_SELECT,
    }),
    publicCommentClient.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: STAFF_TICKET_COMMUNICATION_SELECT,
    }),
    internalNoteClient.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: STAFF_TICKET_COMMUNICATION_SELECT,
    }),
  ]);

  return {
    ...ticket,
    attachments,
    publicComments,
    internalNotes,
  };
}

function serializePublicComment(comment: PublicCommentRecord) {
  return {
    id: comment.id,
    content: comment.content,
    author: comment.author,
    createdAt: comment.createdAt,
  };
}

function sendStaffTicketNotFound(response: Response): void {
  response.status(404).json({
    error: 'Ticket not found.',
    code: 'TICKET_NOT_FOUND',
  });
}

function sendStaffTicketValidationError(response: Response, error: StaffTicketValidationError): void {
  response.status(400).json({
    error: 'Please correct the Ticket operation fields.',
    code: 'VALIDATION_FAILED',
    fieldErrors: error.fieldErrors,
  });
}

function sendAdminUserValidationError(response: Response, error: AdminUserValidationError): void {
  response.status(400).json({
    error: 'Please correct the Administrator User fields.',
    code: 'VALIDATION_FAILED',
    fieldErrors: error.fieldErrors,
  });
}

function sendAdminUserFailure(response: Response, error: unknown, operation: string): void {
  if (error instanceof AdminUserValidationError) {
    sendAdminUserValidationError(response, error);
    return;
  }
  if (error instanceof AdminUserConflictError || isUniqueConflict(error)) {
    response.status(409).json({
      error: error instanceof AdminUserConflictError
        ? error.message
        : 'A User with that email already exists.',
      code: 'CONFLICT',
    });
    return;
  }
  if (error instanceof AdminUserNotFoundError) {
    response.status(404).json({
      error: error.message,
      code: 'USER_NOT_FOUND',
    });
    return;
  }
  console.error(`TokTickIT administrator User ${operation} API error:`, error);
  response.status(500).json({
    error: `Unable to ${operation}.`,
    code: 'UNEXPECTED_ERROR',
  });
}

function sendStaffTicketOperationFailure(
  response: Response,
  error: unknown,
  message: string,
): void {
  if (error instanceof StaffTicketValidationError) {
    sendStaffTicketValidationError(response, error);
    return;
  }
  if (error instanceof StaffTicketOwnerConflictError) {
    response.status(409).json({
      error: error.message,
      code: 'OWNER_NOT_ELIGIBLE',
    });
    return;
  }
  if (error instanceof StaffTicketResolutionConflictError) {
    response.status(409).json({
      error: error.message,
      code: 'RESOLUTION_ALREADY_RECORDED',
    });
    return;
  }
  if (error instanceof StaffTicketTransitionConflictError) {
    response.status(409).json({
      error: error.message,
      code: 'STATUS_TRANSITION_CONFLICT',
      currentStatus: error.currentStatus,
      allowedStatuses: error.allowedStatuses,
    });
    return;
  }
  console.error(`TokTickIT ${message} API error:`, error);
  response.status(500).json({
    error: `Unable to ${message.toLowerCase()}.`,
    code: 'UNEXPECTED_ERROR',
  });
}

export function createApp(
  database: ApplicationApiDatabase = prisma as unknown as ApplicationApiDatabase,
  options: { attachmentStorage?: AttachmentStorage } = {},
) {
  const app = express();
  const attachmentStorage = options.attachmentStorage ?? localAttachmentStorage;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_ATTACHMENT_BYTES,
      files: 1,
      fields: 1,
    },
  }).single('file');

  app.use(cors());
  app.use(express.json());
  app.use('/api', enforceSameOrigin());
  app.use('/api', createSessionMiddleware(database));
  app.use('/api/auth', createAuthRouter(database));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'TokTickIT API',
    });
  });

  app.use('/api', requireNormalAccess(database));

  app.get('/api/admin/users', requireRole(database, ['ADMINISTRATOR']), async (request, response) => {
    try {
      const query = parseAdminUserQuery(request.query);
      const adminDatabase = database as unknown as AdminUserDatabase;
      if (!adminDatabase.user?.findMany) {
        throw new Error('Administrator User database access is unavailable.');
      }
      response.status(200).json(await listAdminUsers(adminDatabase, query));
    } catch (error) {
      sendAdminUserFailure(response, error, 'list administrator users');
    }
  });

  app.post(
    '/api/admin/users',
    requireRole(database, ['ADMINISTRATOR']),
    requireCsrf(),
    async (request, response) => {
      try {
        const input = parseCreateAdminUserPayload(request.body);
        const adminDatabase = database as unknown as AdminUserDatabase;
        response.status(201).json(await createAdminUser(adminDatabase, input));
      } catch (error) {
        sendAdminUserFailure(response, error, 'create administrator user');
      }
    }
  );

  app.patch(
    '/api/admin/users/:userId',
    requireRole(database, ['ADMINISTRATOR']),
    requireCsrf(),
    async (request, response) => {
      try {
        if (!request.auth) {
          sendAuthenticationRequired(response);
          return;
        }
        const userId = parseAdminUserId(request.params.userId);
        const input = parseUpdateAdminUserPayload(request.body);
        const adminDatabase = database as unknown as AdminUserDatabase;
        response.status(200).json(await updateAdminUser(
          adminDatabase,
          userId,
          input,
          request.auth.user.id,
        ));
      } catch (error) {
        sendAdminUserFailure(response, error, 'update administrator user');
      }
    },
  );

  app.post(
    '/api/admin/users/:userId/initial-password',
    requireRole(database, ['ADMINISTRATOR']),
    requireCsrf(),
    async (request, response) => {
      try {
        const userId = parseAdminUserId(request.params.userId);
        const input = parseInitialPasswordPayload(request.body);
        const adminDatabase = database as unknown as AdminUserDatabase;
        response.status(200).json(await resetAdminUserPassword(adminDatabase, userId, input));
      } catch (error) {
        sendAdminUserFailure(response, error, 'set administrator initial password');
      }
    },
  );

  app.get('/api/staff/tickets', requireRole(database, ['IT_STAFF']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }

      const query = parseStaffQueueQuery(request.query);
      const staffQueueDatabase = database as unknown as StaffQueueDatabase;
      if (!staffQueueDatabase.ticket?.findMany || !staffQueueDatabase.ticket.count) {
        throw new Error('Staff Ticket Queue database access is unavailable.');
      }

      const fieldErrors: Record<string, string> = {};
      if (query.categoryId !== undefined) {
        if (!database.category.findUnique) {
          throw new Error('Category list database access is unavailable.');
        }
        const category = await database.category.findUnique({
          where: { id: query.categoryId },
          select: { id: true, isActive: true },
        });
        if (!category?.isActive) {
          fieldErrors.categoryId = 'Category does not exist or is inactive.';
        }
      }

      if (query.relatedSystemId !== undefined) {
        if (!database.relatedSystem?.findUnique) {
          throw new Error('Related System list database access is unavailable.');
        }
        const relatedSystem = await database.relatedSystem.findUnique({
          where: { id: query.relatedSystemId },
          select: { id: true, isActive: true },
        });
        if (!relatedSystem?.isActive) {
          fieldErrors.relatedSystemId = 'Related System does not exist or is inactive.';
        }
      }

      if (Object.keys(fieldErrors).length > 0) {
        throw new StaffQueueValidationError(fieldErrors);
      }

      const where = buildStaffQueueWhere(query);
      const [totalItems, tickets] = await Promise.all([
        staffQueueDatabase.ticket.count({ where }),
        staffQueueDatabase.ticket.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: buildStaffQueueOrderBy(query),
          select: STAFF_QUEUE_SELECT,
        }),
      ]);
      const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

      response.status(200).json({
        items: tickets.map(serializeStaffQueueItem),
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrevious: query.page > 1 && totalPages > 0,
      });
    } catch (error) {
      if (error instanceof StaffQueueValidationError) {
        response.status(400).json({
          error: 'Please correct the Staff Ticket Queue query.',
          code: 'VALIDATION_FAILED',
          fieldErrors: error.fieldErrors,
        });
        return;
      }
      console.error('TokTickIT Staff Ticket Queue API error:', error);
      response.status(500).json({
        error: 'Unable to load Staff Ticket Queue.',
        code: 'UNEXPECTED_ERROR',
      });
    }
  });

  app.get('/api/staff/tickets/:ticketId', requireRole(database, ['IT_STAFF', 'ADMINISTRATOR']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }

      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        response.status(400).json({
          error: 'A valid ticketId is required.',
          code: 'VALIDATION_FAILED',
        });
        return;
      }

      const ticket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!ticket) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ ticket: serializeStaffTicketDetail(ticket) });
    } catch (error) {
      console.error('TokTickIT Staff Ticket Detail API error:', error);
      response.status(500).json({
        error: 'Unable to load Staff Ticket Detail.',
        code: 'UNEXPECTED_ERROR',
      });
    }
  });

  app.patch('/api/staff/tickets/:ticketId/owner', requireRole(database, ['IT_STAFF']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const input = parseStaffOwnerPayload(request.body);
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.ticket?.update || !staffDetailDatabase.user?.findUnique) {
        throw new Error('Staff Ticket owner database access is unavailable.');
      }
      const ticket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!ticket) {
        sendStaffTicketNotFound(response);
        return;
      }
      if (input.ownerId !== null) {
        const owner = await staffDetailDatabase.user.findUnique({
          where: { id: input.ownerId },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });
        if (!owner || !owner.isActive || !['IT_STAFF', 'ADMINISTRATOR'].includes(owner.role)) {
          throw new StaffTicketOwnerConflictError();
        }
      }
      await staffDetailDatabase.ticket.update({
        where: { id: ticketId },
        data: { ownerId: input.ownerId },
      });
      const updatedTicket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!updatedTicket) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ ticket: serializeStaffTicketDetail(updatedTicket) });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'update Staff Ticket owner');
    }
  });

  app.patch('/api/staff/tickets/:ticketId/priority', requireRole(database, ['IT_STAFF', 'ADMINISTRATOR']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const input = parseStaffPriorityPayload(request.body);
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.ticket?.update) {
        throw new Error('Staff Ticket priority database access is unavailable.');
      }
      const ticket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!ticket) {
        sendStaffTicketNotFound(response);
        return;
      }
      await staffDetailDatabase.ticket.update({
        where: { id: ticketId },
        data: { itPriority: input.itPriority },
      });
      const updatedTicket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!updatedTicket) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ ticket: serializeStaffTicketDetail(updatedTicket) });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'update IT Priority');
    }
  });

  app.patch('/api/staff/tickets/:ticketId/status', requireRole(database, ['IT_STAFF']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const input = parseStaffStatusPayload(request.body);
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.ticket?.update) {
        throw new Error('Staff Ticket status database access is unavailable.');
      }
      const ticket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!ticket) {
        sendStaffTicketNotFound(response);
        return;
      }
      const allowedStatuses = STAFF_TICKET_STATUS_TRANSITIONS[ticket.currentStatus];
      if (!allowedStatuses.includes(input.currentStatus)) {
        throw new StaffTicketTransitionConflictError(ticket.currentStatus, allowedStatuses);
      }
      await staffDetailDatabase.ticket.update({
        where: { id: ticketId },
        data: { currentStatus: input.currentStatus },
      });
      const updatedTicket = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!updatedTicket) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ ticket: serializeStaffTicketDetail(updatedTicket) });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'update Ticket status');
    }
  });

  app.get('/api/staff/tickets/:ticketId/comments', requireRole(database, ['IT_STAFF', 'ADMINISTRATOR']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const detail = await loadStaffTicketDetail(
        database as unknown as StaffTicketDetailDatabase,
        ticketId,
      );
      if (!detail) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ items: detail.publicComments });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'load Staff Ticket comments');
    }
  });

  app.post('/api/staff/tickets/:ticketId/comments', requireRole(database, ['IT_STAFF']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const input = parseStaffCommunicationPayload(request.body);
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.publicComment?.create) {
        throw new Error('Public Comment database access is unavailable.');
      }
      const detail = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!detail) {
        sendStaffTicketNotFound(response);
        return;
      }
      const created = await staffDetailDatabase.publicComment.create({
        data: {
          ticketId,
          authorId: request.auth.user.id,
          content: input.content,
        },
      });
      response.status(201).json({
        comment: {
          id: created.id,
          content: created.content,
          author: {
            id: request.auth.user.id,
            name: request.auth.user.name,
            role: request.auth.user.role,
          },
          createdAt: created.createdAt,
        },
      });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'create Staff Ticket comment');
    }
  });

  app.get('/api/staff/tickets/:ticketId/notes', requireRole(database, ['IT_STAFF', 'ADMINISTRATOR']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const detail = await loadStaffTicketDetail(
        database as unknown as StaffTicketDetailDatabase,
        ticketId,
      );
      if (!detail) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ items: detail.internalNotes });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'load Staff Ticket notes');
    }
  });

  app.post('/api/staff/tickets/:ticketId/notes', requireRole(database, ['IT_STAFF']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const input = parseStaffCommunicationPayload(request.body);
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.internalNote?.create) {
        throw new Error('Internal Note database access is unavailable.');
      }
      const detail = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!detail) {
        sendStaffTicketNotFound(response);
        return;
      }
      const created = await staffDetailDatabase.internalNote.create({
        data: {
          ticketId,
          authorId: request.auth.user.id,
          content: input.content,
        },
      });
      response.status(201).json({
        note: {
          id: created.id,
          content: created.content,
          author: {
            id: request.auth.user.id,
            name: request.auth.user.name,
            role: request.auth.user.role,
          },
          createdAt: created.createdAt,
        },
      });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'create Staff Ticket note');
    }
  });

  app.get('/api/categories', async (_request, response) => {
    try {
      const categories = await database.category.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      response.status(200).json(categories);
    } catch (error) {
      console.error('TokTickIT categories API error:', error);
      response.status(500).json({
        error: 'Unable to load categories.',
      });
    }
  });

  app.get('/api/related-systems', async (_request, response) => {
    try {
      if (!database.relatedSystem) {
        throw new Error('Related System database access is unavailable.');
      }

      const relatedSystems = await database.relatedSystem.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      response.status(200).json(relatedSystems);
    } catch (error) {
      console.error('TokTickIT Related Systems API error:', error);
      response.status(500).json({
        error: 'Unable to load Related Systems.',
      });
    }
  });

  app.get('/api/tickets', requireRole(database, ['REQUESTER']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      if (!database.ticket?.findMany || !database.ticket.count) {
        throw new Error('Ticket list database access is unavailable.');
      }

      const query = parseTicketListQuery(request.query);

      if (query.categoryId !== undefined) {
        if (!database.category.findUnique) {
          throw new Error('Category list database access is unavailable.');
        }
        const category = await database.category.findUnique({
          where: { id: query.categoryId },
          select: { id: true, isActive: true },
        });
        if (!category?.isActive) {
          throw new TicketListValidationError({
            categoryId: 'Category does not exist or is inactive.',
          });
        }
      }

      if (query.relatedSystemId !== undefined) {
        if (!database.relatedSystem?.findUnique) {
          throw new Error('Related System list database access is unavailable.');
        }
        const relatedSystem = await database.relatedSystem.findUnique({
          where: { id: query.relatedSystemId },
          select: { id: true, isActive: true },
        });
        if (!relatedSystem?.isActive) {
          throw new TicketListValidationError({
            relatedSystemId: 'Related System does not exist or is inactive.',
          });
        }
      }

      const where: TicketListWhere = {
        requesterId: request.auth.user.id,
        ...(query.search
          ? {
              OR: [
                { ticketNumber: { contains: query.search, mode: 'insensitive' } },
                { summary: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
        ...(query.relatedSystemId === undefined ? {} : { relatedSystemId: query.relatedSystemId }),
        ...(query.requestedPriority === undefined ? {} : { requestedPriority: query.requestedPriority }),
        ...(query.currentStatus === undefined ? {} : { currentStatus: query.currentStatus }),
      };
      const orderBy: TicketListOrderBy[] = [
        { [query.sortBy]: query.sortOrder } as TicketListOrderBy,
        { id: 'desc' },
      ];
      const [items, totalItems] = await Promise.all([
        database.ticket.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy,
          select: {
            id: true,
            ticketNumber: true,
            ticketDate: true,
            summary: true,
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
            requestedPriority: true,
            itPriority: true,
            currentStatus: true,
            updatedAt: true,
          },
        }),
        database.ticket.count({ where }),
      ]);
      const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

      response.status(200).json({
        items,
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        hasNext: totalPages > 0 && query.page < totalPages,
        hasPrevious: totalPages > 0 && query.page > 1,
      });
    } catch (error) {
      if (error instanceof TicketListValidationError) {
        response.status(400).json({
          error: 'Please correct the Ticket list query.',
          fieldErrors: error.fieldErrors,
        });
        return;
      }
      console.error('TokTickIT ticket list API error:', error);
      response.status(500).json({ error: 'Unable to load Tickets.' });
    }
  });

  app.get('/api/tickets/:ticketId/comments', requireRole(database, ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const detail = await loadStaffTicketDetail(
        database as unknown as StaffTicketDetailDatabase,
        ticketId,
      );
      if (!detail) {
        sendStaffTicketNotFound(response);
        return;
      }
      if (request.auth.user.role === 'REQUESTER' && detail.requester.id !== request.auth.user.id) {
        sendStaffTicketNotFound(response);
        return;
      }
      response.status(200).json({ items: detail.publicComments });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'load Ticket comments');
    }
  });

  app.post('/api/tickets/:ticketId/comments', requireRole(database, ['REQUESTER']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const input = parseStaffCommunicationPayload(request.body);
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.publicComment?.create) {
        throw new Error('Public Comment database access is unavailable.');
      }
      const detail = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!detail || detail.requester.id !== request.auth.user.id) {
        sendStaffTicketNotFound(response);
        return;
      }
      const created = await staffDetailDatabase.publicComment.create({
        data: {
          ticketId,
          authorId: request.auth.user.id,
          content: input.content,
        },
      });
      response.status(201).json({
        comment: {
          id: created.id,
          content: created.content,
          author: {
            id: request.auth.user.id,
            name: request.auth.user.name,
            role: request.auth.user.role,
          },
          createdAt: created.createdAt,
        },
      });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'create Ticket comment');
    }
  });

  app.post('/api/tickets/:ticketId/requester-resolution', requireRole(database, ['REQUESTER']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new StaffTicketValidationError({ ticketId: 'A valid ticketId is required.' });
      }
      const staffDetailDatabase = database as unknown as StaffTicketDetailDatabase;
      if (!staffDetailDatabase.ticket?.update) {
        throw new Error('Requester resolution database access is unavailable.');
      }
      const detail = await loadStaffTicketDetail(staffDetailDatabase, ticketId);
      if (!detail || detail.requester.id !== request.auth.user.id) {
        sendStaffTicketNotFound(response);
        return;
      }
      if (detail.requesterResolvedAt !== null) {
        throw new StaffTicketResolutionConflictError();
      }
      const resolvedAt = new Date();
      await staffDetailDatabase.ticket.update({
        where: { id: ticketId },
        data: {
          requesterResolvedAt: resolvedAt,
          requesterResolvedById: request.auth.user.id,
        },
      });
      response.status(200).json({
        requesterResolution: {
          resolvedAt,
          resolvedBy: {
            id: request.auth.user.id,
            name: request.auth.user.name,
            role: request.auth.user.role,
          },
        },
      });
    } catch (error) {
      sendStaffTicketOperationFailure(response, error, 'record requester resolution');
    }
  });

  app.get('/api/tickets/:ticketId', requireRole(database, ['REQUESTER']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      if (!database.ticket?.findUnique || !database.attachment?.findMany) {
        throw new Error('Ticket detail database access is unavailable.');
      }

      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new AttachmentRequestError(400, 'A valid ticketId is required.');
      }

      const ticketDetailDatabase = database.ticket as unknown as {
        findUnique(args: {
          where: { id: number };
          select: Record<string, unknown>;
        }): Promise<TicketDetailRecord | null>;
      };
      const ticket = await ticketDetailDatabase.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          ticketNumber: true,
          ticketDate: true,
          requesterId: true,
          requester: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          summary: true,
          description: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          requesterResolvedAt: true,
          requesterResolvedBy: {
            select: { id: true, name: true, role: true },
          },
          owner: {
            select: { id: true, name: true, email: true, role: true },
          },
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!ticket || ticket.requesterId !== request.auth.user.id) {
        response.status(404).json({ error: 'Ticket not found.', code: 'TICKET_NOT_FOUND' });
        return;
      }

      const attachments = await database.attachment.findMany({
        where: { ticketId },
        orderBy: { uploadedAt: 'asc' },
        select: {
          id: true,
          ticketId: true,
          originalName: true,
          storageKey: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
          removedAt: true,
          removalReason: true,
        },
      });

      const publicComments = database.publicComment?.findMany
        ? await database.publicComment.findMany({
            where: { ticketId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              ticketId: true,
              authorId: true,
              content: true,
              createdAt: true,
              author: { select: { id: true, name: true, role: true } },
            },
          })
        : [];

      response.status(200).json({
        ticket: {
          ...serializeTicketDetail(ticket),
          attachments: attachments.map(serializeAttachment),
          publicComments: publicComments.map(serializePublicComment),
          requesterResolution: ticket.requesterResolvedAt && ticket.requesterResolvedBy
            ? {
                resolvedAt: ticket.requesterResolvedAt,
                resolvedBy: ticket.requesterResolvedBy,
              }
            : null,
        },
      });
    } catch (error) {
      if (error instanceof AttachmentRequestError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error('TokTickIT ticket detail API error:', error);
      response.status(500).json({ error: 'Unable to load Ticket Detail.' });
    }
  });

  app.post('/api/tickets', requireRole(database, ['REQUESTER']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const authenticatedRequesterId = request.auth.user.id;
      const input = validateCreateTicketPayload(request.body);
      if (!database.$transaction) {
        throw new Error('Ticket database access is unavailable.');
      }

      const ticket = await database.$transaction(async (transaction) => {
        const category = await transaction.category.findUnique({
          where: { id: input.categoryId },
          select: { id: true, isActive: true },
        });
        if (!category?.isActive) {
          throw new TicketValidationError({
            categoryId: 'Category does not exist or is inactive.',
          });
        }

        const relatedSystem = await transaction.relatedSystem.findUnique({
          where: { id: input.relatedSystemId },
          select: { id: true, isActive: true },
        });
        if (!relatedSystem?.isActive) {
          throw new TicketValidationError({
            relatedSystemId: 'Related System does not exist or is inactive.',
          });
        }

        const utcYear = new Date().getUTCFullYear();
        const placeholder = `TKT-${utcYear}-TMP-${randomUUID().replaceAll('-', '').slice(0, 8)}`;
        const createdTicket = await transaction.ticket.create({
          data: {
            ticketNumber: placeholder,
            requesterId: authenticatedRequesterId,
            categoryId: input.categoryId,
            relatedSystemId: input.relatedSystemId,
            summary: input.summary,
            description: input.description,
            requestedPriority: input.requestedPriority,
          },
        });
        const ticketNumber = `TKT-${utcYear}-${String(createdTicket.id).padStart(6, '0')}`;
        return transaction.ticket.update({
          where: { id: createdTicket.id },
          data: { ticketNumber },
        });
      });

      response.status(201).json({ ticket: serializeTicket(ticket) });
    } catch (error) {
      if (error instanceof TicketValidationError) {
        response.status(400).json({
          error: 'Please correct the highlighted fields.',
          fieldErrors: error.fieldErrors,
        });
        return;
      }
      if (isUniqueConflict(error)) {
        response.status(409).json({ error: 'The Ticket could not be assigned a unique number.' });
        return;
      }
      console.error('TokTickIT ticket creation API error:', error);
      response.status(500).json({ error: 'Unable to create the Ticket.' });
    }
  });

  app.post('/api/tickets/:ticketId/attachments', requireRole(database, ['REQUESTER']), requireCsrf(), (request, response, next) => {
    upload(request, response, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
        response.status(413).json({ error: 'This attachment is larger than 5 MB.' });
        return;
      }
      if (error instanceof MulterError) {
        response.status(400).json({ error: 'The attachment upload request is invalid.' });
        return;
      }
      response.status(500).json({ error: 'Unable to receive the attachment.' });
    });
  }, async (request, response) => {
    let storedKey: string | null = null;
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      if (!database.ticket || !database.attachment) {
        throw new Error('Attachment database access is unavailable.');
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      if (ticketId === null) {
        throw new AttachmentRequestError(400, 'A valid ticketId is required.');
      }
      if (!request.file) {
        throw new AttachmentRequestError(400, 'Select one attachment to upload.');
      }

      const ticket = await database.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, requesterId: true },
      });
      if (!ticket || ticket.requesterId !== request.auth.user.id) {
        throw new AttachmentRequestError(404, 'Ticket not found.');
      }

      const activeCount = await database.attachment.count({
        where: { ticketId, removedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        throw new AttachmentRequestError(400, 'A Ticket may have at most five active attachments.');
      }

      validateAttachmentFile(request.file);
      storedKey = randomUUID();
      await attachmentStorage.save(storedKey, request.file.buffer);
      const attachment = await database.attachment.create({
        data: {
          ticketId,
          originalName: path.basename(request.file.originalname),
          storageKey: storedKey,
          mimeType: request.file.mimetype,
          sizeBytes: request.file.size,
        },
      });

      response.status(201).json({ attachment: serializeAttachment(attachment) });
    } catch (error) {
      if (storedKey) {
        try {
          await attachmentStorage.remove(storedKey);
        } catch (compensationError) {
          console.error('TokTickIT attachment compensation error:', compensationError);
        }
      }
      if (error instanceof AttachmentRequestError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error('TokTickIT attachment upload API error:', error);
      response.status(500).json({ error: 'Unable to upload the attachment.' });
    }
  });

  const findOwnedAttachment = async (attachmentId: number, requesterId: number): Promise<AttachmentRecord | null> => {
    if (!database.ticket?.findUnique || !database.attachment?.findUnique) {
      throw new Error('Attachment database access is unavailable.');
    }

    const attachment = await database.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      return null;
    }

    const ticket = await database.ticket.findUnique({
      where: { id: attachment.ticketId },
      select: { id: true, requesterId: true },
    });
    if (!ticket || ticket.requesterId !== requesterId) {
      return null;
    }

    return attachment;
  };

  const findReadableAttachment = async (
    attachmentId: number,
    user: { id: number; role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR' },
  ): Promise<AttachmentRecord | null> => {
    if (!database.ticket?.findUnique || !database.attachment?.findUnique) {
      throw new Error('Attachment database access is unavailable.');
    }

    const attachment = await database.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      return null;
    }

    const ticket = await database.ticket.findUnique({
      where: { id: attachment.ticketId },
      select: { id: true, requesterId: true },
    });
    if (!ticket || (user.role === 'REQUESTER' && ticket.requesterId !== user.id)) {
      return null;
    }

    return attachment;
  };

  app.get('/api/attachments/:attachmentId', requireRole(database, ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const attachmentId = parseAttachmentId(request.params.attachmentId);
      const attachment = await findReadableAttachment(attachmentId, request.auth.user);
      if (!attachment) {
        response.status(404).json({ error: 'Attachment not found.' });
        return;
      }

      response.status(200).json({ attachment: serializeAttachment(attachment) });
    } catch (error) {
      if (error instanceof AttachmentRequestError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error('TokTickIT attachment metadata API error:', error);
      response.status(500).json({ error: 'Unable to load the attachment.' });
    }
  });

  app.get('/api/attachments/:attachmentId/download', requireRole(database, ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      const attachmentId = parseAttachmentId(request.params.attachmentId);
      const dispositionValue = request.query.disposition;
      if (dispositionValue !== undefined && dispositionValue !== 'inline' && dispositionValue !== 'attachment') {
        throw new AttachmentRequestError(400, 'Disposition must be inline or attachment.');
      }
      const disposition = dispositionValue === 'inline' ? 'inline' : 'attachment';
      const attachment = await findReadableAttachment(attachmentId, request.auth.user);
      if (!attachment || attachment.removedAt !== null) {
        response.status(404).json({ error: 'Attachment not found.' });
        return;
      }

      let bytes: Buffer;
      try {
        bytes = await attachmentStorage.read(attachment.storageKey);
      } catch (readError) {
        if (isRecord(readError) && readError.code === 'ENOENT') {
          response.status(404).json({ error: 'Attachment not found.' });
          return;
        }
        throw readError;
      }

      response
        .status(200)
        .set({
          'Content-Type': attachment.mimeType,
          'Content-Disposition': attachmentContentDisposition(attachment.originalName, disposition),
          'Content-Length': String(bytes.length),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        })
        .send(bytes);
    } catch (error) {
      if (error instanceof AttachmentRequestError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error('TokTickIT attachment download API error:', error);
      response.status(500).json({ error: 'Unable to download the attachment.' });
    }
  });

  app.delete('/api/attachments/:attachmentId', requireRole(database, ['REQUESTER']), requireCsrf(), async (request, response) => {
    try {
      if (!request.auth) {
        sendAuthenticationRequired(response);
        return;
      }
      if (!database.attachment?.update) {
        throw new Error('Attachment database access is unavailable.');
      }
      const attachmentId = parseAttachmentId(request.params.attachmentId);
      const removalReason = typeof request.body?.removalReason === 'string'
        ? request.body.removalReason.trim()
        : '';
      if (removalReason.length < 5 || removalReason.length > 500) {
        throw new AttachmentRequestError(400, 'Removal reason must be between 5 and 500 characters.');
      }

      const attachment = await findOwnedAttachment(attachmentId, request.auth.user.id);
      if (!attachment) {
        response.status(404).json({ error: 'Attachment not found.' });
        return;
      }
      if (attachment.removedAt !== null) {
        throw new AttachmentRequestError(409, 'This attachment has already been removed.');
      }

      const updatedAttachment = await database.attachment.update({
        where: { id: attachmentId },
        data: {
          removedAt: new Date(),
          removalReason,
        },
      });
      response.status(200).json({ attachment: serializeAttachment(updatedAttachment) });
    } catch (error) {
      if (error instanceof AttachmentRequestError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error('TokTickIT attachment removal API error:', error);
      response.status(500).json({ error: 'Unable to remove the attachment.' });
    }
  });

  app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (isRecord(error) && error.type === 'entity.parse.failed') {
      response.status(400).json(request.path.startsWith('/api/auth')
        ? { error: 'Invalid JSON request.', code: 'VALIDATION_FAILED' }
        : { error: 'Invalid JSON request.' });
      return;
    }
    response.status(500).json(request.path.startsWith('/api/auth')
      ? { error: 'Unexpected server failure.', code: 'UNEXPECTED_ERROR' }
      : { error: 'Unexpected server failure.' });
  });

  return app;
}

export const app = createApp();
