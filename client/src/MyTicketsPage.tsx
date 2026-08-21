import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequesterContext } from './requester-context';

type ReferenceOption = {
  id: number;
  name: string;
};

type TicketListItem = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  category: ReferenceOption;
  relatedSystem: ReferenceOption;
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  itPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
  currentStatus: 'NEW';
  updatedAt: string;
};

type TicketListResponse = {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type TicketListFilters = {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: string;
  currentStatus: string;
  sortBy: 'ticketDate' | 'updatedAt' | 'ticketNumber';
  sortOrder: 'asc' | 'desc';
  pageSize: '10' | '20' | '50';
  page: number;
};

type LoadState = 'loading' | 'ready' | 'error';

const DEFAULT_FILTERS: TicketListFilters = {
  search: '',
  categoryId: '',
  relatedSystemId: '',
  requestedPriority: '',
  currentStatus: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  pageSize: '10',
  page: 1,
};

const priorityOptions = [
  ['LOW', 'Low'],
  ['MEDIUM', 'Medium'],
  ['HIGH', 'High'],
  ['URGENT', 'Urgent'],
] as const;

function isReferenceOption(value: unknown): value is ReferenceOption {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ReferenceOption>;
  return Number.isSafeInteger(candidate.id) && (candidate.id ?? 0) > 0 && typeof candidate.name === 'string';
}

function isTicketListItem(value: unknown): value is TicketListItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<TicketListItem>;
  return (
    Number.isSafeInteger(candidate.id) &&
    typeof candidate.ticketNumber === 'string' &&
    typeof candidate.ticketDate === 'string' &&
    typeof candidate.summary === 'string' &&
    isReferenceOption(candidate.category) &&
    isReferenceOption(candidate.relatedSystem) &&
    typeof candidate.requestedPriority === 'string' &&
    (candidate.itPriority === null || typeof candidate.itPriority === 'string') &&
    candidate.currentStatus === 'NEW' &&
    typeof candidate.updatedAt === 'string'
  );
}

function isTicketListResponse(value: unknown): value is TicketListResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<TicketListResponse>;
  return (
    Array.isArray(candidate.items) &&
    candidate.items.every(isTicketListItem) &&
    Number.isSafeInteger(candidate.page) &&
    Number.isSafeInteger(candidate.pageSize) &&
    Number.isSafeInteger(candidate.totalItems) &&
    Number.isSafeInteger(candidate.totalPages) &&
    typeof candidate.hasNext === 'boolean' &&
    typeof candidate.hasPrevious === 'boolean'
  );
}

function formatUpdatedAt(value: string): string {
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

function appendQueryValue(parameters: URLSearchParams, key: string, value: string): void {
  if (value.trim()) {
    parameters.set(key, value.trim());
  }
}

function buildTicketListUrl(requesterId: number, filters: TicketListFilters): string {
  const parameters = new URLSearchParams({
    requesterId: String(requesterId),
    page: String(filters.page),
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });
  appendQueryValue(parameters, 'search', filters.search);
  appendQueryValue(parameters, 'categoryId', filters.categoryId);
  appendQueryValue(parameters, 'relatedSystemId', filters.relatedSystemId);
  appendQueryValue(parameters, 'requestedPriority', filters.requestedPriority);
  appendQueryValue(parameters, 'currentStatus', filters.currentStatus);
  return `/api/tickets?${parameters.toString()}`;
}

export function MyTicketsPage() {
  const { selectedRequester } = useRequesterContext();
  const [categories, setCategories] = useState<ReferenceOption[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<ReferenceOption[]>([]);
  const [referenceState, setReferenceState] = useState<LoadState>('loading');
  const [filters, setFilters] = useState<TicketListFilters>(DEFAULT_FILTERS);
  const [listState, setListState] = useState<LoadState>('loading');
  const [list, setList] = useState<TicketListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReferenceState('loading');
    void Promise.all([
      fetch('/api/categories'),
      fetch('/api/related-systems'),
    ])
      .then(async ([categoryResponse, relatedSystemResponse]) => {
        const [categoryBody, relatedSystemBody] = await Promise.all([
          categoryResponse.json() as Promise<unknown>,
          relatedSystemResponse.json() as Promise<unknown>,
        ]);
        if (
          !categoryResponse.ok ||
          !relatedSystemResponse.ok ||
          !Array.isArray(categoryBody) ||
          !categoryBody.every(isReferenceOption) ||
          !Array.isArray(relatedSystemBody) ||
          !relatedSystemBody.every(isReferenceOption)
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
          setErrorMessage('Unable to load ticket filters. Check the API and try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRequester) {
      return undefined;
    }
    let cancelled = false;
    setListState('loading');
    setErrorMessage(null);
    void fetch(buildTicketListUrl(selectedRequester.id, filters))
      .then(async (response) => {
        const body = (await response.json()) as unknown;
        if (!response.ok || !isTicketListResponse(body)) {
          const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Unable to load Tickets.';
          throw new Error(message);
        }
        return body;
      })
      .then((body) => {
        if (cancelled) {
          return;
        }
        setList(body);
        setListState('ready');
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setListState('error');
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load Tickets.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters, retryKey, selectedRequester]);

  const hasActiveFilters = useMemo(
    () => Boolean(
      filters.search.trim() ||
      filters.categoryId ||
      filters.relatedSystemId ||
      filters.requestedPriority ||
      filters.currentStatus,
    ),
    [filters],
  );

  const updateFilter = <K extends keyof TicketListFilters>(key: K, value: TicketListFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const retry = () => {
    setRetryKey((key) => key + 1);
  };

  return (
    <section className="my-tickets-page" aria-labelledby="my-tickets-title">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 2</p>
          <h1 id="my-tickets-title">My Tickets</h1>
          <p className="text-secondary mb-0">
            Tickets owned by <strong>{selectedRequester?.name}</strong>. This list is scoped to the selected testing Requester.
          </p>
        </div>
        <Link className="btn btn-primary" to="/tickets/new">Create Ticket</Link>
      </div>

      {referenceState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{errorMessage}</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>Retry</button>
        </div>
      )}

      <div className="tickets-filter-panel" aria-label="Ticket filters">
        <div className="tickets-filter-grid">
          <div className="ticket-field ticket-field-search">
            <label htmlFor="ticket-search">Search Tickets</label>
            <input
              id="ticket-search"
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Ticket Number, summary, or description"
            />
          </div>
          <div className="ticket-field">
            <label htmlFor="ticket-category-filter">Category</label>
            <select id="ticket-category-filter" value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)} disabled={referenceState === 'loading'}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="ticket-system-filter">Related System</label>
            <select id="ticket-system-filter" value={filters.relatedSystemId} onChange={(event) => updateFilter('relatedSystemId', event.target.value)} disabled={referenceState === 'loading'}>
              <option value="">All Related Systems</option>
              {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="ticket-priority-filter">Requested Priority</label>
            <select id="ticket-priority-filter" value={filters.requestedPriority} onChange={(event) => updateFilter('requestedPriority', event.target.value)}>
              <option value="">All Priorities</option>
              {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="ticket-status-filter">Current Status</label>
            <select id="ticket-status-filter" value={filters.currentStatus} onChange={(event) => updateFilter('currentStatus', event.target.value)}>
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="ticket-sort-by">Sort By</label>
            <select id="ticket-sort-by" value={filters.sortBy} onChange={(event) => updateFilter('sortBy', event.target.value as TicketListFilters['sortBy'])}>
              <option value="updatedAt">Last Updated</option>
              <option value="ticketDate">Ticket Date</option>
              <option value="ticketNumber">Ticket Number</option>
            </select>
          </div>
          <div className="ticket-field">
            <label htmlFor="ticket-sort-order">Sort Order</label>
            <select id="ticket-sort-order" value={filters.sortOrder} onChange={(event) => updateFilter('sortOrder', event.target.value as TicketListFilters['sortOrder'])}>
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

      {listState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{errorMessage ?? 'Unable to load Tickets.'}</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>Retry</button>
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
              <p>{hasActiveFilters ? 'No Tickets match your search or filters.' : 'No Tickets yet for this Requester.'}</p>
              <Link className="btn btn-primary" to="/tickets/new">Create Ticket</Link>
            </div>
          ) : (
            <>
              <div className="tickets-table-view">
                <div className="table-responsive">
                  <table className="tickets-table">
                    <caption className="visually-hidden">Requester-owned Tickets</caption>
                    <thead>
                      <tr>
                        <th scope="col">Ticket Number</th>
                        <th scope="col">Summary</th>
                        <th scope="col">Category</th>
                        <th scope="col">Related System</th>
                        <th scope="col">Requested Priority</th>
                        <th scope="col">Current Status</th>
                        <th scope="col">Last Updated</th>
                        <th scope="col"><span className="visually-hidden">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((item) => (
                        <tr key={item.id}>
                          <td><Link to={`/tickets/${item.id}`}>{item.ticketNumber}</Link></td>
                          <td>{item.summary}</td>
                          <td>{item.category.name}</td>
                          <td>{item.relatedSystem.name}</td>
                          <td><span className="ticket-priority-badge">{item.requestedPriority}</span></td>
                          <td><span className="ticket-status-badge">{item.currentStatus}</span></td>
                          <td>{formatUpdatedAt(item.updatedAt)}</td>
                          <td><Link className="btn btn-sm btn-secondary" to={`/tickets/${item.id}`}>View Ticket</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="tickets-card-view">
                {list.items.map((item) => (
                  <article className="ticket-card" key={item.id}>
                    <div className="ticket-card-heading">
                      <Link to={`/tickets/${item.id}`} className="ticket-card-number">{item.ticketNumber}</Link>
                      <span className="ticket-status-badge">{item.currentStatus}</span>
                    </div>
                    <dl className="ticket-card-fields">
                      <div><dt>Summary</dt><dd>{item.summary}</dd></div>
                      <div><dt>Category</dt><dd>{item.category.name}</dd></div>
                      <div><dt>Related System</dt><dd>{item.relatedSystem.name}</dd></div>
                      <div><dt>Requested Priority</dt><dd>{item.requestedPriority}</dd></div>
                      <div><dt>Last Updated</dt><dd>{formatUpdatedAt(item.updatedAt)}</dd></div>
                    </dl>
                    <Link className="btn btn-secondary" to={`/tickets/${item.id}`}>View Ticket</Link>
                  </article>
                ))}
              </div>
            </>
          )}

          {list.items.length > 0 && (
            <nav className="tickets-pagination" aria-label="Ticket pagination">
              <button type="button" className="btn btn-secondary" onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} disabled={!list.hasPrevious}>Previous</button>
              <span>Page {list.page} of {list.totalPages || 0}</span>
              <label htmlFor="ticket-page-size">Tickets per page</label>
              <select id="ticket-page-size" value={filters.pageSize} onChange={(event) => updateFilter('pageSize', event.target.value as TicketListFilters['pageSize'])}>
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
