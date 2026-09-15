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
export type StaffQueueSortBy =
  | 'ticketDate'
  | 'updatedAt'
  | 'ticketNumber'
  | 'requestedPriority'
  | 'itPriority'
  | 'currentStatus';
export type StaffQueueSortOrder = 'asc' | 'desc';

export type StaffQueueQuery = {
  page: number;
  pageSize: 10 | 20 | 50;
  search?: string;
  status?: StaffTicketStatus;
  requestedPriority?: StaffTicketPriority;
  itPriority?: StaffTicketPriority | 'UNASSIGNED';
  ownerId?: number | 'UNASSIGNED';
  categoryId?: number;
  relatedSystemId?: number;
  sortBy: StaffQueueSortBy;
  sortOrder: StaffQueueSortOrder;
};

type TextSearch = {
  contains: string;
  mode: 'insensitive';
};

export type StaffQueueWhere = {
  OR?: Array<
    | { ticketNumber: TextSearch }
    | { summary: TextSearch }
    | { description: TextSearch }
    | { requester: { name: TextSearch } }
    | { requester: { email: TextSearch } }
  >;
  currentStatus?: StaffTicketStatus;
  requestedPriority?: StaffTicketPriority;
  itPriority?: StaffTicketPriority | null;
  ownerId?: number | null;
  categoryId?: number;
  relatedSystemId?: number;
};

export type StaffQueueOrderBy = Array<
  | { ticketDate: StaffQueueSortOrder }
  | { updatedAt: StaffQueueSortOrder }
  | { ticketNumber: StaffQueueSortOrder }
  | { requestedPriority: StaffQueueSortOrder }
  | { itPriority: StaffQueueSortOrder }
  | { currentStatus: StaffQueueSortOrder }
  | { id: StaffQueueSortOrder }
>;

export type StaffQueueItem = {
  id: number;
  ticketNumber: string;
  ticketDate: Date;
  summary: string;
  requester: {
    id: number;
    name: string;
    email: string;
  };
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: number;
    name: string;
  };
  requestedPriority: StaffTicketPriority;
  itPriority: StaffTicketPriority | null;
  currentStatus: StaffTicketStatus;
  owner: {
    id: number;
    name: string;
    role: AuthUserRole;
  } | null;
  updatedAt: Date;
};

export type StaffQueueFindManyArgs = {
  where: StaffQueueWhere;
  skip: number;
  take: number;
  orderBy: StaffQueueOrderBy;
  select: {
    id: true;
    ticketNumber: true;
    ticketDate: true;
    summary: true;
    requester: { select: { id: true; name: true; email: true } };
    category: { select: { id: true; name: true } };
    relatedSystem: { select: { id: true; name: true } };
    requestedPriority: true;
    itPriority: true;
    currentStatus: true;
    owner: { select: { id: true; name: true; role: true } };
    updatedAt: true;
  };
};

export type StaffQueueDatabase = {
  ticket?: {
    findMany(args: StaffQueueFindManyArgs): Promise<StaffQueueItem[]>;
    count(args: { where: StaffQueueWhere }): Promise<number>;
  };
};

export const STAFF_QUEUE_SELECT: StaffQueueFindManyArgs['select'] = {
  id: true,
  ticketNumber: true,
  ticketDate: true,
  summary: true,
  requester: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  owner: { select: { id: true, name: true, role: true } },
  updatedAt: true,
};

const STAFF_TICKET_STATUSES = new Set<StaffTicketStatus>([
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
]);
const STAFF_TICKET_PRIORITIES = new Set<StaffTicketPriority>([
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);
const STAFF_QUEUE_PAGE_SIZES = new Set([10, 20, 50]);
const STAFF_QUEUE_SORT_FIELDS = new Set<StaffQueueSortBy>([
  'ticketDate',
  'updatedAt',
  'ticketNumber',
  'requestedPriority',
  'itPriority',
  'currentStatus',
]);
const STAFF_QUEUE_SORT_ORDERS = new Set<StaffQueueSortOrder>(['asc', 'desc']);

export class StaffQueueValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Staff Ticket Queue query validation failed.');
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

export function parseStaffQueueQuery(query: unknown): StaffQueueQuery {
  const source = isRecord(query) ? query : {};
  const fieldErrors: Record<string, string> = {};

  const pageValue = parseQueryString(source.page);
  const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue);
  if (page === null) {
    fieldErrors.page = 'Page must be a positive integer.';
  }

  const pageSizeValue = parseQueryString(source.pageSize);
  const pageSize = pageSizeValue === undefined ? 20 : parsePositiveInteger(pageSizeValue);
  if (pageSize === null || !STAFF_QUEUE_PAGE_SIZES.has(pageSize)) {
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

  const statusValue = parseQueryString(source.status);
  if (
    statusValue !== undefined
    && (statusValue === null || !STAFF_TICKET_STATUSES.has(statusValue as StaffTicketStatus))
  ) {
    fieldErrors.status = 'Status is not a valid Ticket Status.';
  }

  const requestedPriorityValue = parseQueryString(source.requestedPriority);
  if (
    requestedPriorityValue !== undefined
    && (
      requestedPriorityValue === null
      || !STAFF_TICKET_PRIORITIES.has(requestedPriorityValue as StaffTicketPriority)
    )
  ) {
    fieldErrors.requestedPriority = 'Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.';
  }

  const itPriorityValue = parseQueryString(source.itPriority);
  if (
    itPriorityValue !== undefined
    && (
      itPriorityValue === null
      || (itPriorityValue !== 'UNASSIGNED'
        && !STAFF_TICKET_PRIORITIES.has(itPriorityValue as StaffTicketPriority))
    )
  ) {
    fieldErrors.itPriority = 'IT Priority must be LOW, MEDIUM, HIGH, URGENT, or UNASSIGNED.';
  }

  const ownerValue = parseQueryString(source.ownerId);
  const ownerId = ownerValue === undefined || ownerValue === 'UNASSIGNED'
    ? ownerValue
    : parsePositiveInteger(ownerValue);
  if (ownerValue !== undefined && ownerId === null) {
    fieldErrors.ownerId = 'Owner id must be a positive integer or UNASSIGNED.';
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

  const sortByValue = parseQueryString(source.sortBy);
  const sortBy = sortByValue === undefined ? 'updatedAt' : sortByValue;
  if (sortBy === null || !STAFF_QUEUE_SORT_FIELDS.has(sortBy as StaffQueueSortBy)) {
    fieldErrors.sortBy = 'Sort By is not a valid Staff Ticket Queue field.';
  }

  const sortOrderValue = parseQueryString(source.sortOrder);
  const sortOrder = sortOrderValue === undefined ? 'desc' : sortOrderValue;
  if (sortOrder === null || !STAFF_QUEUE_SORT_ORDERS.has(sortOrder as StaffQueueSortOrder)) {
    fieldErrors.sortOrder = 'Sort Order must be asc or desc.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new StaffQueueValidationError(fieldErrors);
  }

  return {
    page: page as number,
    pageSize: pageSize as 10 | 20 | 50,
    ...(search ? { search } : {}),
    ...(statusValue === undefined ? {} : { status: statusValue as StaffTicketStatus }),
    ...(requestedPriorityValue === undefined
      ? {}
      : { requestedPriority: requestedPriorityValue as StaffTicketPriority }),
    ...(itPriorityValue === undefined
      ? {}
      : { itPriority: itPriorityValue as StaffTicketPriority | 'UNASSIGNED' }),
    ...(ownerValue === undefined ? {} : { ownerId: ownerId as number | 'UNASSIGNED' }),
    ...(categoryId === undefined ? {} : { categoryId: categoryId as number }),
    ...(relatedSystemId === undefined ? {} : { relatedSystemId: relatedSystemId as number }),
    sortBy: sortBy as StaffQueueSortBy,
    sortOrder: sortOrder as StaffQueueSortOrder,
  };
}

export function buildStaffQueueWhere(query: StaffQueueQuery): StaffQueueWhere {
  return {
    ...(query.search
      ? {
          OR: [
            { ticketNumber: { contains: query.search, mode: 'insensitive' } },
            { summary: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
            { requester: { name: { contains: query.search, mode: 'insensitive' } } },
            { requester: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(query.status === undefined ? {} : { currentStatus: query.status }),
    ...(query.requestedPriority === undefined ? {} : { requestedPriority: query.requestedPriority }),
    ...(query.itPriority === undefined
      ? {}
      : { itPriority: query.itPriority === 'UNASSIGNED' ? null : query.itPriority }),
    ...(query.ownerId === undefined
      ? {}
      : { ownerId: query.ownerId === 'UNASSIGNED' ? null : query.ownerId }),
    ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
    ...(query.relatedSystemId === undefined ? {} : { relatedSystemId: query.relatedSystemId }),
  };
}

export function buildStaffQueueOrderBy(query: StaffQueueQuery): StaffQueueOrderBy {
  return [
    { [query.sortBy]: query.sortOrder } as StaffQueueOrderBy[number],
    { id: query.sortOrder },
  ];
}

export function serializeStaffQueueItem(ticket: StaffQueueItem) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.ticketDate,
    summary: ticket.summary,
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    owner: ticket.owner,
    updatedAt: ticket.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
