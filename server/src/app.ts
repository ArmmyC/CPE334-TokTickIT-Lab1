import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import multer, { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { prisma } from './lib/prisma.js';
import { localAttachmentStorage, type AttachmentStorage } from './lib/attachment-storage.js';

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

export type DevelopmentRequesterRecord = {
  id: number;
  name: string;
  email: string;
};

export type DevelopmentRequesterApiDatabase = {
  developmentRequester: {
    findMany(args: {
      where: { isActive: true };
      select: { id: true; name: true; email: true };
      orderBy: { name: 'asc' };
    }): Promise<DevelopmentRequesterRecord[]>;
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
  requester: DevelopmentRequesterRecord;
  category: CategoryRecord;
  relatedSystem: RelatedSystemRecord;
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
  developmentRequester: DevelopmentRequesterApiDatabase['developmentRequester'];
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
};

export type ApplicationApiDatabase = CategoryApiDatabase &
  Partial<DevelopmentRequesterApiDatabase & RelatedSystemApiDatabase & TicketApiDatabase>;

type CreateTicketInput = {
  requesterId: number;
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
  requesterId: number;
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

  const requesterValue = parseQueryString(source.requesterId);
  const requesterId = parsePositiveInteger(requesterValue);
  if (requesterId === null) {
    fieldErrors.requesterId = 'A positive active Development Requester id is required.';
  }

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
    requesterId: requesterId as number,
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

  const requesterId = parsePositiveInteger(payload.requesterId);
  if (requesterId === null) {
    fieldErrors.requesterId = 'Development Requester is required.';
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
    requesterId: requesterId as number,
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

function parseAttachmentRequesterId(value: unknown): number {
  const requesterId = parsePositiveInteger(value);
  if (requesterId === null) {
    throw new AttachmentRequestError(400, 'A valid requesterId is required.');
  }
  return requesterId;
}

function parseAttachmentId(value: unknown): number {
  const attachmentId = parsePositiveInteger(value);
  if (attachmentId === null) {
    throw new AttachmentRequestError(400, 'A valid attachmentId is required.');
  }
  return attachmentId;
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

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'TokTickIT API',
    });
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

  app.get('/api/development-requesters', async (_request, response) => {
    try {
      if (!database.developmentRequester) {
        throw new Error('Development Requester database access is unavailable.');
      }

      const requesters = await database.developmentRequester.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      response.status(200).json(requesters);
    } catch (error) {
      console.error('TokTickIT Development Requesters API error:', error);
      response.status(500).json({
        error: 'Unable to load Development Requesters.',
      });
    }
  });

  app.get('/api/tickets', async (request, response) => {
    try {
      if (!database.ticket?.findMany || !database.ticket.count || !database.developmentRequester?.findUnique) {
        throw new Error('Ticket list database access is unavailable.');
      }

      const query = parseTicketListQuery(request.query);
      const requester = await database.developmentRequester.findUnique({
        where: { id: query.requesterId },
        select: { id: true, isActive: true },
      });
      if (!requester?.isActive) {
        throw new TicketListValidationError({
          requesterId: 'Development Requester does not exist or is inactive.',
        });
      }

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
        requesterId: query.requesterId,
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

  app.get('/api/tickets/:ticketId', async (request, response) => {
    try {
      if (!database.ticket?.findUnique || !database.attachment?.findMany) {
        throw new Error('Ticket detail database access is unavailable.');
      }

      const ticketId = parsePositiveInteger(request.params.ticketId);
      const requesterId = parseAttachmentRequesterId(request.query.requesterId);
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
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!ticket || ticket.requesterId !== requesterId) {
        response.status(404).json({ error: 'Ticket not found.' });
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

      response.status(200).json({
        ticket: serializeTicketDetail(ticket),
        attachments: attachments.map(serializeAttachment),
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

  app.post('/api/tickets', async (request, response) => {
    try {
      const input = validateCreateTicketPayload(request.body);
      if (!database.$transaction) {
        throw new Error('Ticket database access is unavailable.');
      }

      const ticket = await database.$transaction(async (transaction) => {
        const requester = await transaction.developmentRequester.findUnique({
          where: { id: input.requesterId },
          select: { id: true, isActive: true },
        });
        if (!requester?.isActive) {
          throw new TicketValidationError({
            requesterId: 'Development Requester does not exist or is inactive.',
          });
        }

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
            requesterId: input.requesterId,
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

  app.post('/api/tickets/:ticketId/attachments', (request, response, next) => {
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
      if (!database.ticket || !database.attachment) {
        throw new Error('Attachment database access is unavailable.');
      }
      const ticketId = parsePositiveInteger(request.params.ticketId);
      const requesterId = parsePositiveInteger(request.body?.requesterId);
      if (ticketId === null || requesterId === null) {
        throw new AttachmentRequestError(400, 'A valid requesterId and ticketId are required.');
      }
      if (!request.file) {
        throw new AttachmentRequestError(400, 'Select one attachment to upload.');
      }

      const ticket = await database.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, requesterId: true },
      });
      if (!ticket || ticket.requesterId !== requesterId) {
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

  app.get('/api/attachments/:attachmentId', async (request, response) => {
    try {
      const attachmentId = parseAttachmentId(request.params.attachmentId);
      const requesterId = parseAttachmentRequesterId(request.query.requesterId);
      const attachment = await findOwnedAttachment(attachmentId, requesterId);
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

  app.get('/api/attachments/:attachmentId/download', async (request, response) => {
    try {
      const attachmentId = parseAttachmentId(request.params.attachmentId);
      const requesterId = parseAttachmentRequesterId(request.query.requesterId);
      const dispositionValue = request.query.disposition;
      if (dispositionValue !== undefined && dispositionValue !== 'inline' && dispositionValue !== 'attachment') {
        throw new AttachmentRequestError(400, 'Disposition must be inline or attachment.');
      }
      const disposition = dispositionValue === 'inline' ? 'inline' : 'attachment';
      const attachment = await findOwnedAttachment(attachmentId, requesterId);
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

  app.delete('/api/attachments/:attachmentId', async (request, response) => {
    try {
      if (!database.attachment?.update) {
        throw new Error('Attachment database access is unavailable.');
      }
      const attachmentId = parseAttachmentId(request.params.attachmentId);
      const requesterId = parseAttachmentRequesterId(request.body?.requesterId);
      const removalReason = typeof request.body?.removalReason === 'string'
        ? request.body.removalReason.trim()
        : '';
      if (removalReason.length < 5 || removalReason.length > 500) {
        throw new AttachmentRequestError(400, 'Removal reason must be between 5 and 500 characters.');
      }

      const attachment = await findOwnedAttachment(attachmentId, requesterId);
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

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (isRecord(error) && error.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'Invalid JSON request.' });
      return;
    }
    response.status(500).json({ error: 'Unexpected server failure.' });
  });

  return app;
}

export const app = createApp();
