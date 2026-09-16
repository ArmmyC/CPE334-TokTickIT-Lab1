import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiErrorMessage, apiFetch, isApiErrorBody, readJson } from './api';
import { useAuth } from './auth-context';
import { AttachmentSection, type Attachment } from './TicketDetailPage';

type TicketReference = {
  id: number;
  name: string;
};

type TicketAuthor = {
  id: number;
  name: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
};

type TicketRequester = TicketReference & {
  email: string;
};

type TicketOwner = TicketAuthor & {
  email: string;
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

type TicketCommunication = {
  id: number;
  content: string;
  author: TicketAuthor;
  createdAt: string;
};

type RequesterResolution = {
  resolvedAt: string;
  resolvedBy: TicketAuthor;
};

type StaffTicket = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  description: string;
  requester: TicketRequester;
  category: TicketReference;
  relatedSystem: TicketReference;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority | null;
  currentStatus: TicketStatus;
  owner: TicketOwner | null;
  attachments: Attachment[];
  publicComments: TicketCommunication[];
  internalNotes: TicketCommunication[];
  requesterResolution: RequesterResolution | null;
  createdAt: string;
  updatedAt: string;
};

type StaffTicketDetailResponse = {
  ticket: StaffTicket;
};

type DetailRequestErrorBody = {
  error?: string;
  code?: string;
  allowedStatuses?: unknown;
};

class DetailRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: DetailRequestErrorBody | null = null,
  ) {
    super(message);
  }
}

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

const confirmationStatuses = new Set<TicketStatus>(['RESOLVED', 'CLOSED', 'CANCELLED']);
const roles = new Set(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReference(value: unknown): value is TicketReference {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && (value.id as number) > 0
    && typeof value.name === 'string';
}

function isAuthor(value: unknown): value is TicketAuthor {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && (value.id as number) > 0
    && typeof value.name === 'string'
    && typeof value.role === 'string'
    && roles.has(value.role);
}

function isOwner(value: unknown): value is TicketOwner {
  const candidate = value as Partial<TicketOwner>;
  return isAuthor(value) && typeof candidate.email === 'string';
}

function isRequester(value: unknown): value is TicketRequester {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && (value.id as number) > 0
    && typeof value.name === 'string'
    && typeof value.email === 'string';
}

function isAttachment(value: unknown): value is Attachment {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && typeof value.originalName === 'string'
    && typeof value.mimeType === 'string'
    && Number.isSafeInteger(value.sizeBytes)
    && typeof value.uploadedAt === 'string'
    && (value.removedAt === null || typeof value.removedAt === 'string')
    && (value.removalReason === null || typeof value.removalReason === 'string')
    && typeof value.downloadAvailable === 'boolean';
}

function isCommunication(value: unknown): value is TicketCommunication {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && (value.id as number) > 0
    && typeof value.content === 'string'
    && isAuthor(value.author)
    && typeof value.createdAt === 'string';
}

function isRequesterResolution(value: unknown): value is RequesterResolution {
  return isRecord(value) && typeof value.resolvedAt === 'string' && isAuthor(value.resolvedBy);
}

function isStaffTicketDetailResponse(value: unknown): value is StaffTicketDetailResponse {
  if (!isRecord(value) || !isRecord(value.ticket)) {
    return false;
  }
  const ticket = value.ticket;
  return Number.isSafeInteger(ticket.id)
    && (ticket.id as number) > 0
    && typeof ticket.ticketNumber === 'string'
    && typeof ticket.ticketDate === 'string'
    && typeof ticket.summary === 'string'
    && typeof ticket.description === 'string'
    && isRequester(ticket.requester)
    && isReference(ticket.category)
    && isReference(ticket.relatedSystem)
    && typeof ticket.requestedPriority === 'string'
    && priorityOptions.some(([priority]) => priority === ticket.requestedPriority)
    && (ticket.itPriority === null || priorityOptions.some(([priority]) => priority === ticket.itPriority))
    && typeof ticket.currentStatus === 'string'
    && statusOptions.some(([status]) => status === ticket.currentStatus)
    && (ticket.owner === null || isOwner(ticket.owner))
    && Array.isArray(ticket.attachments)
    && ticket.attachments.every(isAttachment)
    && Array.isArray(ticket.publicComments)
    && ticket.publicComments.every(isCommunication)
    && Array.isArray(ticket.internalNotes)
    && ticket.internalNotes.every(isCommunication)
    && (ticket.requesterResolution === null || isRequesterResolution(ticket.requesterResolution))
    && typeof ticket.createdAt === 'string'
    && typeof ticket.updatedAt === 'string';
}

function asErrorBody(value: unknown): DetailRequestErrorBody | null {
  return isApiErrorBody(value) ? value : null;
}

async function requestStaffDetail(ticketId: number): Promise<StaffTicketDetailResponse> {
  const response = await apiFetch(`/api/staff/tickets/${ticketId}`);
  const rawBody = await readJson(response);
  const body = asErrorBody(rawBody);
  if (!response.ok) {
    throw new DetailRequestError(
      apiErrorMessage(body, 'Unable to load Staff Ticket Detail.'),
      response.status,
      body,
    );
  }
  if (!isStaffTicketDetailResponse(rawBody)) {
    throw new DetailRequestError('Unable to load Staff Ticket Detail.', response.status, body);
  }
  return rawBody;
}

async function requestJson(path: string, init: RequestInit, fallback: string): Promise<unknown> {
  const response = await apiFetch(path, init);
  const rawBody = await readJson(response);
  const body = asErrorBody(rawBody);
  if (!response.ok) {
    throw new DetailRequestError(apiErrorMessage(body, fallback), response.status, body);
  }
  return rawBody;
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

function formatRole(role: TicketAuthor['role']): string {
  return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester';
}

function formatOperationError(error: unknown): string {
  if (!(error instanceof DetailRequestError)) {
    return 'The operation could not be completed. Try again.';
  }
  if (Array.isArray(error.body?.allowedStatuses) && error.body.allowedStatuses.length > 0) {
    const allowed = error.body.allowedStatuses.filter((value): value is string => typeof value === 'string');
    if (allowed.length > 0) {
      return `${error.message} Allowed next statuses: ${allowed.join(', ')}.`;
    }
  }
  return error.message;
}

function CommunicationList({
  entries,
  privateNotes = false,
}: {
  entries: TicketCommunication[];
  privateNotes?: boolean;
}) {
  if (entries.length === 0) {
    return <p className="state-message state-message-warning">No {privateNotes ? 'Internal Notes' : 'Public Comments'} have been recorded.</p>;
  }

  return (
    <ol className={privateNotes ? 'communication-list communication-list-private' : 'communication-list'}>
      {entries.map((entry) => (
        <li key={entry.id} className="communication-entry">
          <div className="communication-entry-meta">
            <strong>{entry.author.name}</strong>
            <span>{formatRole(entry.author.role)} · {formatDate(entry.createdAt)}</span>
          </div>
          <p>{entry.content}</p>
        </li>
      ))}
    </ol>
  );
}

export function StaffTicketDetailPage() {
  const { ticketId: ticketIdParam } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const isAdministrator = user?.role === 'ADMINISTRATOR';
  const [detail, setDetail] = useState<StaffTicketDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [ownerIdInput, setOwnerIdInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<TicketPriority | ''>('');
  const [statusInput, setStatusInput] = useState<TicketStatus>('NEW');
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);

  const applyDetail = (nextDetail: StaffTicketDetailResponse) => {
    setDetail(nextDetail);
    setOwnerIdInput(nextDetail.ticket.owner ? String(nextDetail.ticket.owner.id) : '');
    setPriorityInput(nextDetail.ticket.itPriority ?? '');
    setStatusInput(nextDetail.ticket.currentStatus);
  };

  useEffect(() => {
    const ticketId = Number(ticketIdParam);
    if (!user || !Number.isSafeInteger(ticketId) || ticketId <= 0) {
      setLoadState('error');
      setErrorMessage('Ticket not found.');
      return undefined;
    }
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage(null);
    setOperationError(null);
    setOperationSuccess(null);
    void requestStaffDetail(ticketId)
      .then((body) => {
        if (cancelled) return;
        applyDetail(body);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState('error');
        if (error instanceof DetailRequestError && error.status === 401) {
          setErrorMessage('Your session has expired. Please sign in again.');
        } else if (error instanceof DetailRequestError && error.status === 403) {
          setErrorMessage('You do not have permission to access this Ticket Detail.');
        } else {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load Staff Ticket Detail.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey, ticketIdParam, user]);

  const runMutation = async (action: string, callback: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(action);
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await callback();
    } catch (error: unknown) {
      setOperationError(formatOperationError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const saveOwner = (ownerId: number | null) => {
    const ticketId = Number(ticketIdParam);
    void runMutation('owner', async () => {
      const body = await requestJson(`/api/staff/tickets/${ticketId}/owner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId }),
      }, 'Unable to update Ticket ownership.');
      if (!isStaffTicketDetailResponse(body)) {
        throw new DetailRequestError('Unable to update Ticket ownership.', 200);
      }
      applyDetail(body);
      setOperationSuccess(ownerId === null ? 'Ticket ownership cleared.' : 'Ticket owner updated.');
    });
  };

  const claimTicket = () => {
    if (!user || user.role !== 'IT_STAFF') return;
    saveOwner(user.id);
  };

  const assignOwner = () => {
    const ownerId = Number(ownerIdInput);
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      setOperationError('Owner User ID must be a positive integer.');
      setOperationSuccess(null);
      return;
    }
    saveOwner(ownerId);
  };

  const savePriority = () => {
    const ticketId = Number(ticketIdParam);
    if (!priorityInput) {
      setOperationError('Choose an IT Priority before saving.');
      setOperationSuccess(null);
      return;
    }
    void runMutation('priority', async () => {
      const body = await requestJson(`/api/staff/tickets/${ticketId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itPriority: priorityInput }),
      }, 'Unable to update IT Priority.');
      if (!isStaffTicketDetailResponse(body)) {
        throw new DetailRequestError('Unable to update IT Priority.', 200);
      }
      applyDetail(body);
      setOperationSuccess('IT Priority updated.');
    });
  };

  const saveStatus = (currentStatus: TicketStatus, confirmed: boolean) => {
    const ticketId = Number(ticketIdParam);
    void runMutation('status', async () => {
      const body = await requestJson(`/api/staff/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus, confirmed }),
      }, 'Unable to update Ticket status.');
      if (!isStaffTicketDetailResponse(body)) {
        throw new DetailRequestError('Unable to update Ticket status.', 200);
      }
      applyDetail(body);
      setOperationSuccess('Ticket status updated.');
    });
  };

  const requestStatusUpdate = () => {
    if (confirmationStatuses.has(statusInput)) {
      setPendingStatus(statusInput);
      setOperationError(null);
      setOperationSuccess(null);
      return;
    }
    saveStatus(statusInput, false);
  };

  const postComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentText.trim();
    if (content.length < 1 || content.length > 4000) {
      setCommentError('Public Comment must be between 1 and 4000 characters after trimming.');
      setCommentSuccess(null);
      return;
    }
    const ticketId = Number(ticketIdParam);
    void runMutation('comment', async () => {
      setCommentError(null);
      setCommentSuccess(null);
      const body = await requestJson(`/api/staff/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }, 'Unable to post the Public Comment.');
      const comment = isRecord(body) && isCommunication(body.comment) ? body.comment : null;
      if (!comment) {
        throw new DetailRequestError('Unable to post the Public Comment.', 201);
      }
      setDetail((current) => current ? {
        ticket: { ...current.ticket, publicComments: [...current.ticket.publicComments, comment] },
      } : current);
      setCommentText('');
      setCommentSuccess('Public Comment posted.');
    });
  };

  const saveNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = noteText.trim();
    if (content.length < 1 || content.length > 4000) {
      setNoteError('Internal Note must be between 1 and 4000 characters after trimming.');
      setNoteSuccess(null);
      return;
    }
    const ticketId = Number(ticketIdParam);
    void runMutation('note', async () => {
      setNoteError(null);
      setNoteSuccess(null);
      const body = await requestJson(`/api/staff/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }, 'Unable to save the Internal Note.');
      const note = isRecord(body) && isCommunication(body.note) ? body.note : null;
      if (!note) {
        throw new DetailRequestError('Unable to save the Internal Note.', 201);
      }
      setDetail((current) => current ? {
        ticket: { ...current.ticket, internalNotes: [...current.ticket.internalNotes, note] },
      } : current);
      setNoteText('');
      setNoteSuccess('Internal Note saved.');
    });
  };

  const title = isAdministrator ? 'Administrator Ticket View' : 'Staff Ticket Detail';
  const titleId = isAdministrator ? 'administrator-ticket-view-title' : 'staff-ticket-detail-title';
  const backHref = isAdministrator ? '/home' : '/staff/tickets';
  const backLabel = isAdministrator ? 'Back to Workspace' : 'Back to Ticket Queue';

  return (
    <section className="ticket-detail-page staff-ticket-detail-page" aria-labelledby={titleId}>
      <div className="page-heading-row ticket-detail-heading">
        <div>
          <p className="eyebrow">TokTickIT / Lab 3</p>
          <h1 id={titleId}>{title}</h1>
          <p className="text-secondary mb-0">
            {isAdministrator
              ? 'Read-only protected Ticket information with permitted IT Priority editing.'
              : 'Review and operate the Ticket through its authorized workflow.'}
          </p>
        </div>
        <Link className="btn btn-secondary" to={backHref}>{backLabel}</Link>
      </div>

      {loadState === 'loading' && <p role="status" aria-busy="true" className="state-message">Loading Staff Ticket Detail...</p>}
      {loadState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{errorMessage}</p>
          {errorMessage?.includes('session has expired') ? (
            <Link className="btn btn-secondary" to="/login">Sign in again</Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
          )}
        </div>
      )}

      {loadState === 'ready' && detail && user && (
        <>
          <div className="ticket-detail-header-card staff-ticket-header-card">
            <div>
              <span className="detail-label">Ticket Number</span>
              <strong className="ticket-detail-number">{detail.ticket.ticketNumber}</strong>
            </div>
            <div className="ticket-detail-header-fields">
              <div><span className="detail-label">Current Status</span><span className="ticket-status-badge">{detail.ticket.currentStatus}</span></div>
              <div><span className="detail-label">Requested Priority</span><span className="ticket-priority-badge">{detail.ticket.requestedPriority}</span></div>
              <div><span className="detail-label">IT Priority</span><span className="ticket-priority-badge">{detail.ticket.itPriority ?? 'Unassigned'}</span></div>
              <div><span className="detail-label">Ticket Owner</span><span>{detail.ticket.owner?.name ?? 'Unassigned'}</span></div>
              <div><span className="detail-label">Last Updated</span><span>{formatDate(detail.ticket.updatedAt)}</span></div>
            </div>
          </div>

          <section className="ticket-detail-card" aria-labelledby="staff-ticket-information-title">
            <h2 id="staff-ticket-information-title">Ticket Information</h2>
            <dl className="ticket-detail-grid">
              <div className="ticket-detail-field"><dt>Requester</dt><dd>{detail.ticket.requester.name} ({detail.ticket.requester.email})</dd></div>
              <div className="ticket-detail-field"><dt>Category</dt><dd>{detail.ticket.category.name}</dd></div>
              <div className="ticket-detail-field"><dt>Related System</dt><dd>{detail.ticket.relatedSystem.name}</dd></div>
              <div className="ticket-detail-field"><dt>Ticket Date</dt><dd>{formatDate(detail.ticket.ticketDate)}</dd></div>
              <div className="ticket-detail-field"><dt>Created</dt><dd>{formatDate(detail.ticket.createdAt)}</dd></div>
              <div className="ticket-detail-field ticket-detail-field-wide"><dt>Summary</dt><dd>{detail.ticket.summary}</dd></div>
              <div className="ticket-detail-field ticket-detail-field-wide"><dt>Description</dt><dd className="ticket-detail-description">{detail.ticket.description}</dd></div>
            </dl>
          </section>

          <section className="ticket-detail-card staff-operational-card" aria-labelledby="operational-controls-title">
            <h2 id="operational-controls-title">Operational Controls</h2>
            <p className="text-secondary">Editable fields are operational values. Submitted Ticket information remains read-only.</p>
            {!isAdministrator && (
              <div className="staff-operation-grid">
                <div className="ticket-field staff-editable-field">
                  <label htmlFor="staff-owner-id">Owner User ID</label>
                  <input
                    id="staff-owner-id"
                    type="number"
                    min="1"
                    step="1"
                    value={ownerIdInput}
                    onChange={(event) => setOwnerIdInput(event.target.value)}
                    aria-describedby="staff-owner-help"
                  />
                  <small id="staff-owner-help">Use an active IT Staff or Administrator User ID, or clear ownership.</small>
                  <div className="action-row">
                    <button type="button" className="btn btn-primary" onClick={claimTicket} disabled={busyAction !== null}>
                      {busyAction === 'owner' ? 'Saving Owner...' : 'Claim Ticket'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={assignOwner} disabled={busyAction !== null}>Assign Owner</button>
                    <button type="button" className="btn btn-secondary" onClick={() => saveOwner(null)} disabled={busyAction !== null}>Unassign Ticket</button>
                  </div>
                </div>
                <div className="ticket-field staff-editable-field">
                  <label htmlFor="staff-it-priority">IT Priority</label>
                  <select id="staff-it-priority" value={priorityInput} onChange={(event) => setPriorityInput(event.target.value as TicketPriority | '')}>
                    <option value="">Not assigned</option>
                    {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <small>Requested Priority remains unchanged.</small>
                  <div className="action-row">
                    <button type="button" className="btn btn-primary" onClick={savePriority} disabled={busyAction !== null}>
                      {busyAction === 'priority' ? 'Saving IT Priority...' : 'Save IT Priority'}
                    </button>
                  </div>
                </div>
                <div className="ticket-field staff-editable-field">
                  <label htmlFor="staff-current-status">Current Status</label>
                  <select id="staff-current-status" value={statusInput} onChange={(event) => setStatusInput(event.target.value as TicketStatus)}>
                    {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <small>Invalid transitions are checked by the API. Resolved, Closed, and Cancelled require confirmation.</small>
                  <div className="action-row">
                    <button type="button" className="btn btn-primary" onClick={requestStatusUpdate} disabled={busyAction !== null}>
                      {busyAction === 'status' ? 'Saving Status...' : 'Update Status'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isAdministrator && (
              <div className="staff-operation-grid">
                <div className="ticket-field staff-editable-field">
                  <label htmlFor="staff-it-priority">IT Priority</label>
                  <select id="staff-it-priority" value={priorityInput} onChange={(event) => setPriorityInput(event.target.value as TicketPriority | '')}>
                    <option value="">Not assigned</option>
                    {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <small>Administrators may change IT Priority only on this protected view.</small>
                  <div className="action-row">
                    <button type="button" className="btn btn-primary" onClick={savePriority} disabled={busyAction !== null}>
                      {busyAction === 'priority' ? 'Saving IT Priority...' : 'Save IT Priority'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {operationError && <p role="alert" className="state-message state-message-error">{operationError}</p>}
            {operationSuccess && <p role="status" className="state-message state-message-success">{operationSuccess}</p>}
          </section>

          {pendingStatus && (
            <div className="ticket-confirmation-backdrop">
              <div className="ticket-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="status-confirmation-title">
                <h2 id="status-confirmation-title">Confirm status change</h2>
                <p>This action will set the Ticket to <strong>{pendingStatus}</strong>. Confirm that this formal workflow change is intended.</p>
                <div className="action-row">
                  <button type="button" className="btn btn-secondary" onClick={() => setPendingStatus(null)} disabled={busyAction !== null}>Cancel status change</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const nextStatus = pendingStatus;
                      setPendingStatus(null);
                      saveStatus(nextStatus, true);
                    }}
                    disabled={busyAction !== null}
                  >
                    Confirm status change
                  </button>
                </div>
              </div>
            </div>
          )}

          <AttachmentSection
            ticketId={detail.ticket.id}
            attachments={detail.ticket.attachments}
            onAttachmentsChange={() => undefined}
            canManage={false}
          />

          <section className="ticket-detail-card communication-card public-comments-card" aria-labelledby="staff-public-comments-title">
            <h2 id="staff-public-comments-title">Public Comments</h2>
            <p className="communication-help">Visible to the Requester, IT Staff, and Administrator.</p>
            <CommunicationList entries={detail.ticket.publicComments} />
            {isAdministrator ? (
              <p className="state-message">Administrators can read Public Comments but cannot post from this view.</p>
            ) : (
              <form className="communication-composer" onSubmit={postComment}>
                <label htmlFor="staff-public-comment">Public Comment</label>
                <textarea id="staff-public-comment" value={commentText} maxLength={4000} rows={4} onChange={(event) => { setCommentText(event.target.value); setCommentError(null); }} aria-describedby="staff-public-comment-help" />
                <small id="staff-public-comment-help">This message will be visible to the Requester.</small>
                {commentError && <p role="alert" className="field-error">{commentError}</p>}
                <div className="action-row">
                  <button type="submit" className="btn btn-primary" disabled={busyAction !== null}>
                    {busyAction === 'comment' ? 'Posting Public Comment...' : 'Post Public Comment'}
                  </button>
                </div>
                {commentSuccess && <p role="status" className="state-message state-message-success">{commentSuccess}</p>}
              </form>
            )}
          </section>

          <section className="ticket-detail-card communication-card internal-notes-card" aria-labelledby="staff-internal-notes-title">
            <h2 id="staff-internal-notes-title">Internal Notes <span className="private-label">Internal only</span></h2>
            <p className="communication-help">Visible only to IT Staff and Administrators. This text is never returned to Requester APIs.</p>
            <CommunicationList entries={detail.ticket.internalNotes} privateNotes />
            {isAdministrator ? (
              <p className="state-message">Administrators can read Internal Notes but cannot create them.</p>
            ) : (
              <form className="communication-composer" onSubmit={saveNote}>
                <label htmlFor="staff-internal-note">Internal Note</label>
                <textarea id="staff-internal-note" value={noteText} maxLength={4000} rows={4} onChange={(event) => { setNoteText(event.target.value); setNoteError(null); }} aria-describedby="staff-internal-note-help" />
                <small id="staff-internal-note-help">Internal only, never visible to Requesters.</small>
                {noteError && <p role="alert" className="field-error">{noteError}</p>}
                <div className="action-row">
                  <button type="submit" className="btn btn-primary" disabled={busyAction !== null}>
                    {busyAction === 'note' ? 'Saving Internal Note...' : 'Save Internal Note'}
                  </button>
                </div>
                {noteSuccess && <p role="status" className="state-message state-message-success">{noteSuccess}</p>}
              </form>
            )}
          </section>

          <section className="ticket-detail-card requester-resolution-card" aria-labelledby="requester-resolution-title">
            <h2 id="requester-resolution-title">Requester Resolution Indication</h2>
            {detail.ticket.requesterResolution ? (
              <p role="status">Problem appears resolved indication recorded by {detail.ticket.requesterResolution.resolvedBy.name} on {formatDate(detail.ticket.requesterResolution.resolvedAt)}. This does not change the formal Ticket status.</p>
            ) : (
              <p>No Problem Appears Resolved indication has been recorded.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
