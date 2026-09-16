import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage, apiFetch, isApiErrorBody, readJson } from './api';
import { useAuth } from './auth-context';

type ReferenceOption = {
  id: number;
  name: string;
};

type OwnerOption = ReferenceOption & {
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
};

type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type SortField =
  | 'ticketDate'
  | 'updatedAt'
  | 'ticketNumber'
  | 'requestedPriority'
  | 'itPriority'
  | 'currentStatus';

type StaffTicketQueueItem = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  requester: {
    id: number;
    name: string;
    email: string;
  };
  category: ReferenceOption;
  relatedSystem: ReferenceOption;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority | null;
  currentStatus: TicketStatus;
  owner: OwnerOption | null;
  updatedAt: string;
};

type StaffTicketQueueResponse = {
  items: StaffTicketQueueItem[];
  page: number;
  pageSize: 10 | 20 | 50;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type StaffTicketQueueFilters = {
  search: string;
  status: string;
  requestedPriority: string;
  itPriority: string;
  ownerId: string;
  categoryId: string;
  relatedSystemId: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  pageSize: '10' | '20' | '50';
  page: number;
};

type LoadState = 'loading' | 'ready' | 'error';
type QueueErrorKind = 'expired' | 'forbidden' | 'invalid' | 'error';
type QueueError = {
  kind: QueueErrorKind;
  message: string;
};

const DEFAULT_FILTERS: StaffTicketQueueFilters = {
  search: '',
  status: '',
  requestedPriority: '',
  itPriority: '',
  ownerId: '',
  categoryId: '',
  relatedSystemId: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  pageSize: '20',
  page: 1,
};

const priorityOptions: Array<[TicketPriority, string]> = [
  ['LOW', 'Low'],
  ['MEDIUM', 'Medium'],
  ['HIGH', 'High'],
  ['URGENT', 'Urgent'],
];
const statusOptions: Array<[TicketStatus, string]> = [
  ['NEW', 'New'],
  ['OPEN', 'Open'],
  ['IN_PROGRESS', 'In Progress'],
  ['WAITING_FOR_REQUESTER', 'Waiting for Requester'],
  ['RESOLVED', 'Resolved'],
  ['CLOSED', 'Closed'],
  ['REOPENED', 'Reopened'],
  ['CANCELLED', 'Cancelled'],
];
const ownerRoles = new Set(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']);
const ticketStatuses = new Set(statusOptions.map(([value]) => value));
const ticketPriorities = new Set(priorityOptions.map(([value]) => value));

function isReferenceOption(value: unknown): value is ReferenceOption {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<ReferenceOption>;
  return Number.isSafeInteger(candidate.id)
    && (candidate.id ?? 0) > 0
    && typeof candidate.name === 'string';
}

function isOwnerOption(value: unknown): value is OwnerOption {
  if (!isReferenceOption(value)) {
    return false;
  }
  const candidate = value as Partial<OwnerOption>;
  return typeof candidate.role === 'string' && ownerRoles.has(candidate.role);
}

function isQueueItem(value: unknown): value is StaffTicketQueueItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<StaffTicketQueueItem>;
  return Number.isSafeInteger(candidate.id)
    && (candidate.id ?? 0) > 0
    && typeof candidate.ticketNumber === 'string'
    && typeof candidate.ticketDate === 'string'
    && typeof candidate.summary === 'string'
    && typeof candidate.requester === 'object'
    && candidate.requester !== null
    && Number.isSafeInteger(candidate.requester.id)
    && (candidate.requester.id ?? 0) > 0
    && typeof candidate.requester.name === 'string'
    && typeof candidate.requester.email === 'string'
    && isReferenceOption(candidate.category)
    && isReferenceOption(candidate.relatedSystem)
    && typeof candidate.requestedPriority === 'string'
    && ticketPriorities.has(candidate.requestedPriority)
    && (candidate.itPriority === null
      || (typeof candidate.itPriority === 'string' && ticketPriorities.has(candidate.itPriority as TicketPriority)))
    && typeof candidate.currentStatus === 'string'
    && ticketStatuses.has(candidate.currentStatus)
    && (candidate.owner === null || isOwnerOption(candidate.owner))
    && typeof candidate.updatedAt === 'string';
}

function isQueueResponse(value: unknown): value is StaffTicketQueueResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<StaffTicketQueueResponse>;
  return Array.isArray(candidate.items)
    && candidate.items.every(isQueueItem)
    && Number.isSafeInteger(candidate.page)
    && (candidate.page ?? 0) > 0
    && [10, 20, 50].includes(candidate.pageSize ?? 0)
    && Number.isSafeInteger(candidate.totalItems)
    && (candidate.totalItems ?? -1) >= 0
    && Number.isSafeInteger(candidate.totalPages)
    && (candidate.totalPages ?? -1) >= 0
    && typeof candidate.hasNext === 'boolean'
    && typeof candidate.hasPrevious === 'boolean';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRole(role: OwnerOption['role']): string {
  return role === 'IT_STAFF'
    ? 'IT Staff'
    : role === 'ADMINISTRATOR'
      ? 'Administrator'
      : 'Requester';
}

function appendQueryValue(parameters: URLSearchParams, key: string, value: string): void {
  if (value.trim()) {
    parameters.set(key, value.trim());
  }
}

function buildStaffQueueUrl(filters: StaffTicketQueueFilters): string {
  const parameters = new URLSearchParams({
    page: String(filters.page),
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });
  appendQueryValue(parameters, 'search', filters.search);
  appendQueryValue(parameters, 'status', filters.status);
  appendQueryValue(parameters, 'requestedPriority', filters.requestedPriority);
  appendQueryValue(parameters, 'itPriority', filters.itPriority);
  appendQueryValue(parameters, 'ownerId', filters.ownerId);
  appendQueryValue(parameters, 'categoryId', filters.categoryId);
  appendQueryValue(parameters, 'relatedSystemId', filters.relatedSystemId);
  return `/api/staff/tickets?${parameters.toString()}`;
}

class QueueRequestError extends Error {
  constructor(
    public readonly kind: QueueErrorKind,
    message: string,
  ) {
    super(message);
  }
}

async function requestQueue(url: string): Promise<StaffTicketQueueResponse> {
  const response = await apiFetch(url);
  const rawBody = await readJson(response);
  const body = isApiErrorBody(rawBody) ? rawBody : null;

  if (!response.ok) {
    if (response.status === 401 || body?.code === 'AUTHENTICATION_REQUIRED') {
      throw new QueueRequestError('expired', 'Your session has expired. Please sign in again.');
    }
    if (response.status === 403 || body?.code === 'FORBIDDEN') {
      throw new QueueRequestError('forbidden', 'You do not have permission to access the Staff Ticket Queue.');
    }
    if (response.status === 400 || body?.code === 'VALIDATION_FAILED') {
      throw new QueueRequestError('invalid', 'The queue filters are invalid. Clear filters or try again.');
    }
    throw new QueueRequestError('error', apiErrorMessage(body, 'Unable to load Staff Ticket Queue.'));
  }

  if (!isQueueResponse(rawBody)) {
    throw new QueueRequestError('error', 'Unable to load Staff Ticket Queue.');
  }
  return rawBody;
}

export function StaffTicketQueuePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ReferenceOption[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<ReferenceOption[]>([]);
  const [referenceState, setReferenceState] = useState<LoadState>('loading');
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [filters, setFilters] = useState<StaffTicketQueueFilters>(DEFAULT_FILTERS);
  const [listState, setListState] = useState<LoadState>('loading');
  const [list, setList] = useState<StaffTicketQueueResponse | null>(null);
  const [queueError, setQueueError] = useState<QueueError | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReferenceState('loading');
    setReferenceError(null);
    void Promise.all([
      apiFetch('/api/categories'),
      apiFetch('/api/related-systems'),
    ])
      .then(async ([categoryResponse, relatedSystemResponse]) => {
        const [categoryBody, relatedSystemBody] = await Promise.all([
          readJson(categoryResponse),
          readJson(relatedSystemResponse),
        ]);
        if (
          !categoryResponse.ok
          || !relatedSystemResponse.ok
          || !Array.isArray(categoryBody)
          || !categoryBody.every(isReferenceOption)
          || !Array.isArray(relatedSystemBody)
          || !relatedSystemBody.every(isReferenceOption)
        ) {
          throw new Error('Unable to load ticket filters.');
        }
        return { categories: categoryBody, relatedSystems: relatedSystemBody };
      })
      .then(({ categories: loadedCategories, relatedSystems: loadedRelatedSystems }) => {
        if (cancelled) {
          return;
        }
        setCategories(loadedCategories);
        setRelatedSystems(loadedRelatedSystems);
        setReferenceState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setReferenceState('error');
          setReferenceError('Unable to load ticket filters. Check the API and try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    let cancelled = false;
    setListState('loading');
    setQueueError(null);
    void requestQueue(buildStaffQueueUrl(filters))
      .then((body) => {
        if (cancelled) {
          return;
        }
        setList(body);
        setListState('ready');
        setOwnerOptions((current) => {
          const owners = new Map(current.map((owner) => [owner.id, owner]));
          for (const item of body.items) {
            if (item.owner) {
              owners.set(item.owner.id, item.owner);
            }
          }
          return [...owners.values()].sort((left, right) => left.name.localeCompare(right.name));
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const queueRequestError = error instanceof QueueRequestError
          ? error
          : new QueueRequestError('error', 'Unable to load Staff Ticket Queue.');
        setListState('error');
        setQueueError({ kind: queueRequestError.kind, message: queueRequestError.message });
      });

    return () => {
      cancelled = true;
    };
  }, [filters, retryKey, user]);

  const hasActiveFilters = useMemo(
    () => Boolean(
      filters.search.trim()
      || filters.status
      || filters.requestedPriority
      || filters.itPriority
      || filters.ownerId
      || filters.categoryId
      || filters.relatedSystemId,
    ),
    [filters],
  );

  const updateFilter = <K extends keyof StaffTicketQueueFilters>(
    key: K,
    value: StaffTicketQueueFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const retry = () => {
    setRetryKey((key) => key + 1);
  };

  return (
    <section className="my-tickets-page staff-ticket-queue-page" aria-labelledby="staff-ticket-queue-title">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 3</p>
          <h1 id="staff-ticket-queue-title">Staff Ticket Queue</h1>
          <p className="text-secondary mb-0">
            Review and prioritize service requests across the IT service desk.
          </p>
        </div>
      </div>

      {referenceState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{referenceError}</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>Retry</button>
        </div>
      )}

      <div className="tickets-filter-panel" aria-label="Staff Ticket Queue filters">
        <div className="tickets-filter-grid">
          <div className="ticket-field ticket-field-search">
            <label htmlFor="staff-ticket-search">Search Tickets</label>
            <input
              id="staff-ticket-search"
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Ticket Number, summary, description, requester"
            />
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-status-filter">Status</label>
            <select id="staff-ticket-status-filter" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All Statuses</option>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-requested-priority-filter">Requested Priority</label>
            <select id="staff-ticket-requested-priority-filter" value={filters.requestedPriority} onChange={(event) => updateFilter('requestedPriority', event.target.value)}>
              <option value="">All Priorities</option>
              {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-it-priority-filter">IT Priority</label>
            <select id="staff-ticket-it-priority-filter" value={filters.itPriority} onChange={(event) => updateFilter('itPriority', event.target.value)}>
              <option value="">All IT Priorities</option>
              {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-owner-filter">Ticket Owner</label>
            <select id="staff-ticket-owner-filter" value={filters.ownerId} onChange={(event) => updateFilter('ownerId', event.target.value)}>
              <option value="">All Owners</option>
              <option value="UNASSIGNED">Unassigned</option>
              {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-category-filter">Category</label>
            <select id="staff-ticket-category-filter" value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)} disabled={referenceState === 'loading'}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-system-filter">Related System</label>
            <select id="staff-ticket-system-filter" value={filters.relatedSystemId} onChange={(event) => updateFilter('relatedSystemId', event.target.value)} disabled={referenceState === 'loading'}>
              <option value="">All Related Systems</option>
              {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-sort-by">Sort By</label>
            <select id="staff-ticket-sort-by" value={filters.sortBy} onChange={(event) => updateFilter('sortBy', event.target.value as SortField)}>
              <option value="updatedAt">Last Updated</option>
              <option value="ticketDate">Created Date</option>
              <option value="ticketNumber">Ticket Number</option>
              <option value="requestedPriority">Requested Priority</option>
              <option value="itPriority">IT Priority</option>
              <option value="currentStatus">Current Status</option>
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="staff-ticket-sort-order">Sort Order</label>
            <select id="staff-ticket-sort-order" value={filters.sortOrder} onChange={(event) => updateFilter('sortOrder', event.target.value as 'asc' | 'desc')}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
        <div className="action-row tickets-filter-actions">
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>

      {listState === 'loading' && (
        <p role="status" aria-live="polite" className="state-message" aria-busy="true">Loading Tickets...</p>
      )}

      {listState === 'error' && queueError && (
        <div role="alert" className="state-message state-message-error">
          <p>{queueError.message}</p>
          {queueError.kind === 'expired' ? (
            <Link className="btn btn-secondary" to="/login">Sign in again</Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={retry}>Retry</button>
          )}
        </div>
      )}

      {listState === 'ready' && list && (
        <>
          <p className="tickets-result-summary" role="status" aria-live="polite">
            {list.totalItems === 0
              ? '0 Tickets found.'
              : `${list.totalItems} ${list.totalItems === 1 ? 'Ticket' : 'Tickets'} found.`}
            {' '}Page {list.page} of {list.totalPages || 0}.
          </p>

          {list.items.length === 0 ? (
            <div className="state-message state-message-warning" role="status">
              <p>{hasActiveFilters ? 'No Tickets match your search or filters.' : 'No Tickets are currently in the queue.'}</p>
            </div>
          ) : (
            <>
              <div className="tickets-table-view">
                <div className="table-responsive">
                  <table className="tickets-table staff-queue-table">
                    <caption className="visually-hidden">All Tickets available to IT Staff</caption>
                    <thead>
                      <tr>
                        <th scope="col">Ticket Number</th>
                        <th scope="col">Created Date</th>
                        <th scope="col">Summary</th>
                        <th scope="col">Requester</th>
                        <th scope="col">Category</th>
                        <th scope="col">Requested Priority</th>
                        <th scope="col">IT Priority</th>
                        <th scope="col">Current Status</th>
                        <th scope="col">Ticket Owner</th>
                        <th scope="col">Last Updated</th>
                        <th scope="col">View Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((item) => (
                        <tr key={item.id}>
                          <td><Link to={`/staff/tickets/${item.id}`}>{item.ticketNumber}</Link></td>
                          <td>{formatDate(item.ticketDate)}</td>
                          <td>{item.summary}</td>
                          <td className="staff-queue-requester"><strong>{item.requester.name}</strong><small>{item.requester.email}</small></td>
                          <td>{item.category.name}</td>
                          <td><span className="ticket-priority-badge">{item.requestedPriority}</span></td>
                          <td><span className="ticket-priority-badge">{item.itPriority ?? 'Unassigned'}</span></td>
                          <td><span className="ticket-status-badge">{item.currentStatus}</span></td>
                          <td>
                            {item.owner ? (
                              <span className="staff-queue-owner">
                                <strong>{item.owner.name}</strong>
                                <small>{formatRole(item.owner.role)}</small>
                              </span>
                            ) : 'Unassigned'}
                          </td>
                          <td>{formatDate(item.updatedAt)}</td>
                          <td><Link className="btn btn-sm btn-secondary" to={`/staff/tickets/${item.id}`}>View Detail</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="tickets-card-view">
                {list.items.map((item) => (
                  <article className="ticket-card staff-queue-card" key={item.id}>
                    <div className="ticket-card-heading">
                      <Link to={`/staff/tickets/${item.id}`} className="ticket-card-number">{item.ticketNumber}</Link>
                      <span className="ticket-status-badge">{item.currentStatus}</span>
                    </div>
                    <dl className="ticket-card-fields">
                      <div><dt>Created Date</dt><dd>{formatDate(item.ticketDate)}</dd></div>
                      <div><dt>Summary</dt><dd>{item.summary}</dd></div>
                      <div><dt>Requester</dt><dd>{item.requester.name}<small className="staff-queue-card-subtext">{item.requester.email}</small></dd></div>
                      <div><dt>Category</dt><dd>{item.category.name}</dd></div>
                      <div><dt>Related System</dt><dd>{item.relatedSystem.name}</dd></div>
                      <div><dt>Requested Priority</dt><dd>{item.requestedPriority}</dd></div>
                      <div><dt>IT Priority</dt><dd>{item.itPriority ?? 'Unassigned'}</dd></div>
                      <div><dt>Current Status</dt><dd>{item.currentStatus}</dd></div>
                      <div>
                        <dt>Ticket Owner</dt>
                        <dd>
                          {item.owner ? (
                            <span className="staff-queue-owner">
                              <strong>{item.owner.name}</strong>
                              <small>{formatRole(item.owner.role)}</small>
                            </span>
                          ) : 'Unassigned'}
                        </dd>
                      </div>
                      <div><dt>Last Updated</dt><dd>{formatDate(item.updatedAt)}</dd></div>
                    </dl>
                    <Link className="btn btn-secondary" to={`/staff/tickets/${item.id}`}>View Detail</Link>
                  </article>
                ))}
              </div>
            </>
          )}

          {list.totalPages > 0 && (
            <nav className="tickets-pagination" aria-label="Staff Ticket Queue pagination">
              <button type="button" className="btn btn-secondary" onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} disabled={!list.hasPrevious}>Previous</button>
              <span>Page {list.page} of {list.totalPages || 0}</span>
              <label htmlFor="staff-ticket-page-size">Tickets per page</label>
              <select id="staff-ticket-page-size" value={filters.pageSize} onChange={(event) => updateFilter('pageSize', event.target.value as StaffTicketQueueFilters['pageSize'])}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} disabled={!list.hasNext}>Next</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
