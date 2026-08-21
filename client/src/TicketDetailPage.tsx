import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRequesterContext } from './requester-context';

type TicketReference = {
  id: number;
  name: string;
};

type TicketRequester = TicketReference & {
  email: string;
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
  createdAt: string;
  updatedAt: string;
};

type Attachment = {
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
  attachments: Attachment[];
};

type ApiError = {
  error?: string;
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

function isTicketDetailResponse(value: unknown): value is TicketDetailResponse {
  if (!isRecord(value) || !isRecord(value.ticket) || !Array.isArray(value.attachments)) {
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
    typeof ticket.createdAt === 'string' &&
    typeof ticket.updatedAt === 'string' &&
    value.attachments.every(isAttachment);
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

function attachmentUrl(attachmentId: number, requesterId: number, disposition: 'inline' | 'attachment'): string {
  return `/api/attachments/${attachmentId}/download?requesterId=${requesterId}&disposition=${disposition}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function attachmentErrorMessage(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.error === 'string' ? body.error : fallback;
}

type AttachmentSectionProps = {
  ticketId: number;
  requesterId: number;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
};

function AttachmentSection({
  ticketId,
  requesterId,
  attachments,
  onAttachmentsChange,
}: AttachmentSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

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
      formData.append('requesterId', String(requesterId));
      formData.append('file', selectedFile, selectedFile.name);
      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
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

  const openRemoval = (attachment: Attachment) => {
    setRemoving(attachment);
    setRemovalReason('');
    setRemovalError(null);
  };

  const closeRemoval = () => {
    if (removingBusy) return;
    setRemoving(null);
    setRemovalReason('');
    setRemovalError(null);
  };

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
      const response = await fetch(`/api/attachments/${removing.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId, removalReason: trimmedReason }),
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
          <h2 id="attachments-title">Attachments</h2>
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
                      <a className="btn btn-secondary btn-sm" href={attachmentUrl(attachment.id, requesterId, 'inline')} target="_blank" rel="noreferrer">
                        Preview {attachment.originalName}
                      </a>
                    )}
                    <a className="btn btn-secondary btn-sm" href={attachmentUrl(attachment.id, requesterId, 'attachment')}>
                      Download {attachment.originalName}
                    </a>
                    <button type="button" className="btn btn-outline-danger btn-sm" aria-label={`Remove Attachment ${attachment.originalName}`} onClick={() => openRemoval(attachment)}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

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

      {removing && (
        <div className="attachment-dialog-backdrop">
          <div className="attachment-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-attachment-title">
            <h2 id="remove-attachment-title">Remove {removing.originalName}</h2>
            <p>This keeps the attachment metadata but blocks future content access.</p>
            <label htmlFor="removal-reason" className="required-label">Removal reason</label>
            <textarea
              id="removal-reason"
              aria-label="Removal reason"
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
            {removalError && <p role="alert" className="field-error">{removalError}</p>}
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

export function TicketDetailPage() {
  const { ticketId: ticketIdParam } = useParams<{ ticketId: string }>();
  const { selectedRequester } = useRequesterContext();
  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!selectedRequester) return undefined;
    const ticketId = Number(ticketIdParam);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      setLoadState('error');
      setErrorMessage('Ticket not found.');
      return undefined;
    }
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage(null);
    void fetch(`/api/tickets/${ticketId}?requesterId=${selectedRequester.id}`)
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
  }, [retryKey, selectedRequester, ticketIdParam]);

  return (
    <section className="ticket-detail-page" aria-labelledby="ticket-detail-title">
      <div className="page-heading-row ticket-detail-heading">
        <div>
          <p className="eyebrow">TokTickIT / Lab 2</p>
          <h1 id="ticket-detail-title">Ticket Detail</h1>
          <p className="text-secondary mb-0">Read-only Ticket information and attachment lifecycle.</p>
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
      {loadState === 'ready' && detail && selectedRequester && (
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
            requesterId={selectedRequester.id}
            attachments={detail.attachments}
            onAttachmentsChange={(attachments) => setDetail((current) => current ? { ...current, attachments } : current)}
          />
        </>
      )}
    </section>
  );
}
