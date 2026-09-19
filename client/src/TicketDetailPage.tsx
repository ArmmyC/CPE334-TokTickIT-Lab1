import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from './auth-context';
import { apiErrorMessage, apiFetch, isApiErrorBody, readJson } from './api';

type TicketReference = {
  id: number;
  name: string;
};

type TicketRequester = TicketReference & {
  email: string;
};

type TicketAuthor = {
  id: number;
  name: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
};

type TicketOwner = TicketAuthor & {
  email: string;
};

export type PublicComment = {
  id: number;
  content: string;
  author: TicketAuthor;
  createdAt: string;
};

export type RequesterResolution = {
  resolvedAt: string;
  resolvedBy: TicketAuthor;
};

type TicketDetail = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: TicketRequester;
  category: TicketReference;
  relatedSystem: TicketReference;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  owner: TicketOwner | null;
  attachments: Attachment[];
  publicComments: PublicComment[];
  requesterResolution: RequesterResolution | null;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: number;
  ticketId?: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  downloadAvailable: boolean;
};

type TicketDetailResponse = {
  ticket: TicketDetail;
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ACTIVE_ATTACHMENTS = 5;
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReference(value: unknown): value is TicketReference {
  return isRecord(value) && Number.isSafeInteger(value.id) && typeof value.name === 'string';
}

function isRequester(value: unknown): value is TicketRequester {
  return isRecord(value) && Number.isSafeInteger(value.id) && typeof value.name === 'string' && typeof value.email === 'string';
}

function isAuthor(value: unknown): value is TicketAuthor {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && typeof value.name === 'string'
    && (value.role === 'REQUESTER' || value.role === 'IT_STAFF' || value.role === 'ADMINISTRATOR');
}

function isOwner(value: unknown): value is TicketOwner {
  const candidate = value as Partial<TicketOwner>;
  return isAuthor(value) && typeof candidate.email === 'string';
}

function isAttachment(value: unknown): value is Attachment {
  return isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    typeof value.originalName === 'string' &&
    typeof value.mimeType === 'string' &&
    Number.isSafeInteger(value.sizeBytes) &&
    typeof value.uploadedAt === 'string' &&
    (value.removedAt === null || typeof value.removedAt === 'string') &&
    (value.removalReason === null || typeof value.removalReason === 'string') &&
    typeof value.downloadAvailable === 'boolean';
}

function isPublicComment(value: unknown): value is PublicComment {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && typeof value.content === 'string'
    && isAuthor(value.author)
    && typeof value.createdAt === 'string';
}

function isRequesterResolution(value: unknown): value is RequesterResolution {
  return isRecord(value)
    && typeof value.resolvedAt === 'string'
    && isAuthor(value.resolvedBy);
}

function isTicketDetailResponse(value: unknown): value is TicketDetailResponse {
  if (!isRecord(value) || !isRecord(value.ticket)) {
    return false;
  }
  const ticket = value.ticket;
  return Number.isSafeInteger(ticket.id) &&
    typeof ticket.ticketNumber === 'string' &&
    typeof ticket.ticketDate === 'string' &&
    isRequester(ticket.requester) &&
    isReference(ticket.category) &&
    isReference(ticket.relatedSystem) &&
    typeof ticket.summary === 'string' &&
    typeof ticket.description === 'string' &&
    typeof ticket.requestedPriority === 'string' &&
    (ticket.itPriority === null || typeof ticket.itPriority === 'string') &&
    typeof ticket.currentStatus === 'string' &&
    (ticket.owner === null || isOwner(ticket.owner)) &&
    Array.isArray(ticket.attachments) &&
    ticket.attachments.every(isAttachment) &&
    Array.isArray(ticket.publicComments) &&
    ticket.publicComments.every(isPublicComment) &&
    (ticket.requesterResolution === null || isRequesterResolution(ticket.requesterResolution)) &&
    typeof ticket.createdAt === 'string' &&
    typeof ticket.updatedAt === 'string';
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateAttachment(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!MIME_BY_EXTENSION[extension] || file.type !== MIME_BY_EXTENSION[extension]) {
    return `${file.name} is not supported. Choose JPG, PNG, WEBP, or PDF.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name} is too large. Maximum size is 5 MB.`;
  }
  return null;
}

function isPreviewable(attachment: Attachment): boolean {
  return attachment.mimeType === 'application/pdf' || attachment.mimeType.startsWith('image/');
}

function attachmentUrl(attachmentId: number, disposition: 'inline' | 'attachment'): string {
  return `/api/attachments/${attachmentId}/download?disposition=${disposition}`;
}

function attachmentErrorMessage(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.error === 'string' ? body.error : fallback;
}

type AttachmentSectionProps = {
  ticketId: number;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  canManage?: boolean;
};

export function AttachmentSection({
  ticketId,
  attachments,
  onAttachmentsChange,
  canManage = true,
}: AttachmentSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const attachmentsHeadingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const removingBusyRef = useRef(removingBusy);
  removingBusyRef.current = removingBusy;

  const activeCount = attachments.filter((attachment) => attachment.removedAt === null).length;

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadMessage(null);
    setUploadError(null);
    if (!file) {
      setSelectedFile(null);
      setFileError(null);
      return;
    }
    const error = validateAttachment(file);
    setSelectedFile(error ? null : file);
    setFileError(error);
  };

  const uploadFile = async () => {
    if (!selectedFile || uploading) {
      if (!selectedFile) {
        setUploadError('Select one supported attachment before uploading.');
      }
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
      const response = await apiFetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const body = await readJson(response);
      const uploadedAttachment = isRecord(body) && isAttachment(body.attachment) ? body.attachment : null;
      if (!response.ok || !uploadedAttachment) {
        throw new Error(attachmentErrorMessage(body, 'Unable to upload the attachment.'));
      }
      onAttachmentsChange([...attachments, uploadedAttachment]);
      setSelectedFile(null);
      setFileError(null);
      setUploadMessage('Attachment uploaded.');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to upload the attachment.');
    } finally {
      setUploading(false);
    }
  };

  const openRemoval = (attachment: Attachment, trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    setRemoving(attachment);
    setRemovalReason('');
    setRemovalError(null);
  };

  const closeRemoval = useCallback(() => {
    if (removingBusyRef.current) return;
    setRemoving(null);
    setRemovalReason('');
    setRemovalError(null);
  }, []);

  useEffect(() => {
    if (!removing) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const getFocusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );

    getFocusableElements()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRemoval();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === firstElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const trigger = returnFocusRef.current;
      window.setTimeout(() => {
        if (trigger?.isConnected) {
          trigger.focus();
        } else {
          attachmentsHeadingRef.current?.focus();
        }
      }, 0);
    };
  }, [closeRemoval, removing]);

  const removeAttachment = async () => {
    if (!removing || removingBusy) return;
    const trimmedReason = removalReason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 500) {
      setRemovalError('Removal reason must be between 5 and 500 characters.');
      return;
    }
    setRemovingBusy(true);
    setRemovalError(null);
    try {
      const response = await apiFetch(`/api/attachments/${removing.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removalReason: trimmedReason }),
      });
      const body = await readJson(response);
      const removedAttachment = isRecord(body) && isAttachment(body.attachment) ? body.attachment : null;
      if (!response.ok || !removedAttachment) {
        throw new Error(attachmentErrorMessage(body, 'Unable to remove the attachment.'));
      }
      onAttachmentsChange(attachments.map((attachment) => (
        attachment.id === removedAttachment.id ? removedAttachment : attachment
      )));
      setRemoving(null);
      setRemovalReason('');
    } catch (error) {
      setRemovalError(error instanceof Error ? error.message : 'Unable to remove the attachment.');
    } finally {
      setRemovingBusy(false);
    }
  };

  return (
    <section className="ticket-detail-card attachment-section" aria-labelledby="attachments-title">
      <div className="attachment-section-heading">
        <div>
          <h2 id="attachments-title" ref={attachmentsHeadingRef} tabIndex={-1}>Attachments</h2>
          <p className="text-secondary mb-0">Active files can be previewed or downloaded. Removed files keep their metadata.</p>
        </div>
        <span className="attachment-count" aria-label={`${activeCount} active attachments`}>{activeCount} / {MAX_ACTIVE_ATTACHMENTS} active</span>
      </div>

      {attachments.length === 0 ? (
        <p className="state-message state-message-warning">No attachments have been added to this Ticket.</p>
      ) : (
        <ul className="attachment-list">
          {attachments.map((attachment) => {
            const removed = attachment.removedAt !== null;
            return (
              <li key={attachment.id} className={removed ? 'attachment-row attachment-row-removed' : 'attachment-row'}>
                <div className="attachment-details">
                  <strong>{attachment.originalName}</strong>
                  <span>{attachment.mimeType} · {formatBytes(attachment.sizeBytes)} · Uploaded {formatDate(attachment.uploadedAt)}</span>
                  {removed && (
                    <>
                      <span className="attachment-removed-details">Removed {formatDate(attachment.removedAt as string)}</span>
                      {attachment.removalReason && <span className="attachment-removed-details">{attachment.removalReason}</span>}
                    </>
                  )}
                </div>
                {removed ? (
                  <span className="attachment-removed-badge">Removed</span>
                ) : (
                  <div className="attachment-actions">
                    {isPreviewable(attachment) && (
                      <a className="btn btn-secondary btn-sm" href={attachmentUrl(attachment.id, 'inline')} target="_blank" rel="noreferrer">
                        Preview {attachment.originalName}
                      </a>
                    )}
                    <a className="btn btn-secondary btn-sm" href={attachmentUrl(attachment.id, 'attachment')}>
                      Download {attachment.originalName}
                    </a>
                    {canManage && (
                      <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove Attachment ${attachment.originalName}`} onClick={(event) => openRemoval(attachment, event.currentTarget)}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <div className="attachment-upload-panel">
          <label htmlFor="add-attachment" className="required-label">Add attachment</label>
          <input
            ref={inputRef}
            id="add-attachment"
            aria-label="Add attachment"
            aria-describedby={fileError ? 'attachment-file-error' : 'attachment-file-help'}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            disabled={activeCount >= MAX_ACTIVE_ATTACHMENTS || uploading}
            onChange={selectFile}
          />
          <small id="attachment-file-help">JPG, PNG, WEBP, or PDF, maximum 5 MB per file.</small>
          {fileError && <p id="attachment-file-error" role="alert" className="field-error">{fileError}</p>}
          {selectedFile && <p className="selected-attachment">Selected: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})</p>}
          <button type="button" className="btn btn-primary" disabled={!selectedFile || uploading || activeCount >= MAX_ACTIVE_ATTACHMENTS} onClick={() => void uploadFile()}>
            {uploading ? 'Uploading Attachment...' : 'Upload Attachment'}
          </button>
          {uploadMessage && <p role="status" className="state-message state-message-success">{uploadMessage}</p>}
          {uploadError && <p role="alert" className="state-message state-message-error">{uploadError}</p>}
        </div>
      )}

      {removing && (
        <div className="attachment-dialog-backdrop">
          <div
            ref={dialogRef}
            className="attachment-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-attachment-title"
            aria-describedby="remove-attachment-description"
          >
            <h2 id="remove-attachment-title">Remove {removing.originalName}</h2>
            <p id="remove-attachment-description">This keeps the attachment metadata but blocks future content access.</p>
            <label htmlFor="removal-reason" className="required-label">Removal reason</label>
            <textarea
              id="removal-reason"
              aria-label="Removal reason"
              aria-describedby={removalError ? 'remove-attachment-description removal-reason-error' : 'remove-attachment-description'}
              required
              value={removalReason}
              onChange={(event) => {
                setRemovalReason(event.target.value);
                setRemovalError(null);
              }}
              minLength={5}
              maxLength={500}
              rows={4}
            />
            {removalError && <p id="removal-reason-error" role="alert" className="field-error">{removalError}</p>}
            <div className="action-row">
              <button type="button" className="btn btn-secondary" onClick={closeRemoval} disabled={removingBusy}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void removeAttachment()} disabled={removingBusy}>
                {removingBusy ? 'Removing Attachment...' : 'Remove Attachment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type PublicCommentsSectionProps = {
  ticketId: number;
  comments: PublicComment[];
  requesterResolution: RequesterResolution | null;
  onCommentsChange: (comments: PublicComment[]) => void;
  onResolutionChange: (resolution: RequesterResolution) => void;
};

function formatAuthorRole(role: TicketAuthor['role']): string {
  return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester';
}

function PublicCommentsSection({
  ticketId,
  comments,
  requesterResolution,
  onCommentsChange,
  onResolutionChange,
}: PublicCommentsSectionProps) {
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [resolutionConfirmation, setResolutionConfirmation] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [resolutionSuccess, setResolutionSuccess] = useState<string | null>(null);
  const [recordingResolution, setRecordingResolution] = useState(false);

  const postComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentText.trim();
    if (content.length < 1 || content.length > 4000) {
      setCommentError('Public Comment must be between 1 and 4000 characters after trimming.');
      setCommentSuccess(null);
      return;
    }

    setPostingComment(true);
    setCommentError(null);
    setCommentSuccess(null);
    try {
      const response = await apiFetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const body = await readJson(response);
      const comment = isRecord(body) && isPublicComment(body.comment) ? body.comment : null;
      if (!response.ok || !comment) {
        throw new Error(apiErrorMessage(isApiErrorBody(body) ? body : null, 'Unable to post the Public Comment.'));
      }
      onCommentsChange([...comments, comment]);
      setCommentText('');
      setCommentSuccess('Public Comment posted.');
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Unable to post the Public Comment.');
    } finally {
      setPostingComment(false);
    }
  };

  const recordResolution = async () => {
    if (recordingResolution || requesterResolution) return;
    setRecordingResolution(true);
    setResolutionError(null);
    setResolutionSuccess(null);
    try {
      const response = await apiFetch(`/api/tickets/${ticketId}/requester-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await readJson(response);
      const resolution = isRecord(body) && isRequesterResolution(body.requesterResolution)
        ? body.requesterResolution
        : null;
      if (!response.ok || !resolution) {
        throw new Error(apiErrorMessage(isApiErrorBody(body) ? body : null, 'Unable to record the resolution indication.'));
      }
      onResolutionChange(resolution);
      setResolutionConfirmation(false);
      setResolutionSuccess('Problem Appears Resolved indication recorded.');
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : 'Unable to record the resolution indication.');
    } finally {
      setRecordingResolution(false);
    }
  };

  return (
    <section className="ticket-detail-card communication-card public-comments-card" aria-labelledby="public-comments-title">
      <h2 id="public-comments-title">Public Comments</h2>
      <p className="communication-help">Visible to the Requester, IT Staff, and Administrator.</p>
      {comments.length === 0 ? (
        <p className="state-message state-message-warning">No Public Comments have been recorded.</p>
      ) : (
        <ol className="communication-list">
          {comments.map((comment) => (
            <li key={comment.id} className="communication-entry">
              <div className="communication-entry-meta">
                <strong>{comment.author.name}</strong>
                <span>{formatAuthorRole(comment.author.role)} · {formatDate(comment.createdAt)}</span>
              </div>
              <p>{comment.content}</p>
            </li>
          ))}
        </ol>
      )}

      <form className="communication-composer" onSubmit={postComment}>
        <label htmlFor="requester-public-comment">Public Comment</label>
        <textarea
          id="requester-public-comment"
          value={commentText}
          maxLength={4000}
          rows={4}
          onChange={(event) => {
            setCommentText(event.target.value);
            setCommentError(null);
          }}
          aria-describedby="requester-public-comment-help"
        />
        <small id="requester-public-comment-help">This message will be visible to IT Staff and Administrators.</small>
        {commentError && <p role="alert" className="field-error">{commentError}</p>}
        <div className="action-row">
          <button type="submit" className="btn btn-primary" disabled={postingComment}>
            {postingComment ? 'Posting Public Comment...' : 'Post Public Comment'}
          </button>
        </div>
        {commentSuccess && <p role="status" className="state-message state-message-success">{commentSuccess}</p>}
      </form>

      <div className="requester-resolution-action">
        <h3>Problem Appears Resolved</h3>
        {requesterResolution ? (
          <p role="status">
            Problem Appears Resolved indication recorded on {formatDate(requesterResolution.resolvedAt)}. This does not change the formal Ticket status.
          </p>
        ) : (
          <>
            <p className="communication-help">This records your indication separately from the formal Ticket status.</p>
            <button type="button" className="btn btn-secondary" onClick={() => { setResolutionConfirmation(true); setResolutionError(null); }} disabled={recordingResolution}>
              Problem Appears Resolved
            </button>
          </>
        )}
        {resolutionSuccess && <p role="status" className="state-message state-message-success">{resolutionSuccess}</p>}
        {resolutionError && <p role="alert" className="state-message state-message-error">{resolutionError}</p>}
      </div>

      {resolutionConfirmation && (
        <div className="ticket-confirmation-backdrop">
          <div className="ticket-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="requester-resolution-confirmation-title">
            <h2 id="requester-resolution-confirmation-title">Confirm resolution indication</h2>
            <p>This records that the problem appears resolved. It does not change the formal Ticket status.</p>
            <div className="action-row">
              <button type="button" className="btn btn-secondary" onClick={() => setResolutionConfirmation(false)} disabled={recordingResolution}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => void recordResolution()} disabled={recordingResolution}>
                {recordingResolution ? 'Recording Indication...' : 'Confirm Problem Appears Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function TicketDetailPage() {
  const { ticketId: ticketIdParam } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user) return undefined;
    const ticketId = Number(ticketIdParam);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      setLoadState('error');
      setErrorMessage('Ticket not found.');
      return undefined;
    }
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage(null);
    void apiFetch(`/api/tickets/${ticketId}`)
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok || !isTicketDetailResponse(body)) {
          throw new Error(attachmentErrorMessage(body, 'Unable to load Ticket Detail.'));
        }
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setDetail(body);
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load Ticket Detail.');
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey, ticketIdParam, user]);

  return (
    <section className="ticket-detail-page" aria-labelledby="ticket-detail-title">
      <div className="page-heading-row ticket-detail-heading">
        <div>
          <p className="eyebrow">TokTickIT / Lab 3</p>
          <h1 id="ticket-detail-title">Ticket Detail</h1>
          <p className="text-secondary mb-0">Read-only Ticket information, attachments, and Public Comments.</p>
        </div>
        <Link className="btn btn-secondary" to="/tickets">Back to My Tickets</Link>
      </div>

      {loadState === 'loading' && <p role="status" className="state-message">Loading Ticket Detail...</p>}
      {loadState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{errorMessage}</p>
          <button type="button" className="btn btn-secondary" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
        </div>
      )}
      {loadState === 'ready' && detail && user && (
        <>
          <div className="ticket-detail-header-card">
            <div>
              <span className="detail-label">Ticket Number</span>
              <strong className="ticket-detail-number">{detail.ticket.ticketNumber}</strong>
            </div>
            <div className="ticket-detail-header-fields">
              <div><span className="detail-label">Ticket Date</span><span>{formatDate(detail.ticket.ticketDate)}</span></div>
              <div><span className="detail-label">Current Status</span><span className="ticket-status-badge">{detail.ticket.currentStatus}</span></div>
              <div><span className="detail-label">Requested Priority</span><span className="ticket-priority-badge">{detail.ticket.requestedPriority}</span></div>
              <div><span className="detail-label">IT Priority</span><span>{detail.ticket.itPriority ?? 'Not assigned'}</span></div>
            </div>
          </div>

          <section className="ticket-detail-card" aria-labelledby="ticket-information-title">
            <h2 id="ticket-information-title">Ticket Information</h2>
            <dl className="ticket-detail-grid">
              <div className="ticket-detail-field"><dt>Requester</dt><dd>{detail.ticket.requester.name} ({detail.ticket.requester.email})</dd></div>
              <div className="ticket-detail-field"><dt>Category</dt><dd>{detail.ticket.category.name}</dd></div>
              <div className="ticket-detail-field"><dt>Related System</dt><dd>{detail.ticket.relatedSystem.name}</dd></div>
              <div className="ticket-detail-field ticket-detail-field-wide"><dt>Summary</dt><dd>{detail.ticket.summary}</dd></div>
              <div className="ticket-detail-field ticket-detail-field-wide"><dt>Description</dt><dd className="ticket-detail-description">{detail.ticket.description}</dd></div>
            </dl>
          </section>

          <AttachmentSection
            ticketId={detail.ticket.id}
            attachments={detail.ticket.attachments}
            onAttachmentsChange={(attachments) => setDetail((current) => current ? {
              ...current,
              ticket: { ...current.ticket, attachments },
            } : current)}
          />

          <PublicCommentsSection
            ticketId={detail.ticket.id}
            comments={detail.ticket.publicComments}
            requesterResolution={detail.ticket.requesterResolution}
            onCommentsChange={(publicComments) => setDetail((current) => current ? {
              ...current,
              ticket: { ...current.ticket, publicComments },
            } : current)}
            onResolutionChange={(requesterResolution) => setDetail((current) => current ? {
              ...current,
              ticket: { ...current.ticket, requesterResolution },
            } : current)}
          />
        </>
      )}
    </section>
  );
}
