import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequesterContext, type DevelopmentRequester } from './requester-context';

type ReferenceItem = {
  id: number;
  name: string;
};

type FormValues = {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
};

type TicketRecord = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  currentStatus: string;
  itPriority: string | null;
};

type ApiErrorBody = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type ReferenceState = 'loading' | 'ready' | 'error';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 5;
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const initialForm: FormValues = {
  categoryId: '',
  relatedSystemId: '',
  summary: '',
  requestedPriority: 'MEDIUM',
  description: '',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTicketDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function validateFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!MIME_BY_EXTENSION[extension] || file.type !== MIME_BY_EXTENSION[extension]) {
    return `${file.name} is not supported. Choose JPG, PNG, WEBP, or PDF.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name} is too large. Maximum size is 5 MB.`;
  }
  return null;
}

function isReferenceList(value: unknown): value is ReferenceItem[] {
  return Array.isArray(value) && value.every((item) => (
    typeof item === 'object' && item !== null &&
    typeof (item as ReferenceItem).id === 'number' &&
    typeof (item as ReferenceItem).name === 'string'
  ));
}

function isTicket(value: unknown): value is TicketRecord {
  return (
    typeof value === 'object' && value !== null &&
    typeof (value as TicketRecord).id === 'number' &&
    typeof (value as TicketRecord).ticketNumber === 'string'
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function validateForm(form: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.categoryId) errors.categoryId = 'Category is required.';
  if (!form.relatedSystemId) errors.relatedSystemId = 'Related System is required.';
  const summaryLength = form.summary.trim().length;
  if (summaryLength < 5 || summaryLength > 120) {
    errors.summary = 'Summary must be between 5 and 120 characters after trimming.';
  }
  const descriptionLength = form.description.trim().length;
  if (descriptionLength < 10 || descriptionLength > 4000) {
    errors.description = 'Description must be between 10 and 4000 characters after trimming.';
  }
  return errors;
}

function ReadOnlyRequester({ requester }: { requester: DevelopmentRequester }) {
  return (
    <div className="ticket-field ticket-field-readonly">
      <label htmlFor="development-requester">Development Requester</label>
      <input id="development-requester" value={requester.name} readOnly aria-readonly="true" />
      <small>Testing context, not authentication</small>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="field-error">{message}</p> : null;
}

export function CreateTicketPage() {
  const { selectedRequester } = useRequesterContext();
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<ReferenceItem[]>([]);
  const [referenceState, setReferenceState] = useState<ReferenceState>('loading');
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<TicketRecord | null>(null);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);

  const loadReferenceData = useCallback(async () => {
    setReferenceState('loading');
    setReferenceError(null);
    try {
      const [categoryResponse, relatedSystemResponse] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/related-systems'),
      ]);
      const categoryBody = await readJson(categoryResponse);
      const relatedSystemBody = await readJson(relatedSystemResponse);
      if (!categoryResponse.ok || !relatedSystemResponse.ok || !isReferenceList(categoryBody) || !isReferenceList(relatedSystemBody)) {
        throw new Error('Reference data response was invalid.');
      }
      setCategories(categoryBody);
      setRelatedSystems(relatedSystemBody);
      setReferenceState('ready');
    } catch {
      setReferenceState('error');
      setReferenceError('Unable to load Categories and Related Systems. Try again.');
    }
  }, []);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormAlert(null);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const nextFiles: File[] = [];
    const nextErrors: string[] = [];
    for (const file of selectedFiles) {
      const error = validateFile(file);
      if (error) {
        nextErrors.push(error);
      } else if (nextFiles.length < MAX_ATTACHMENT_COUNT) {
        nextFiles.push(file);
      } else {
        nextErrors.push(`${file.name} was not added. Only five attachments are allowed.`);
      }
    }
    setFiles(nextFiles);
    setFileErrors(nextErrors);
    setFormAlert(null);
  };

  const clearForm = () => {
    const hasEnteredData = Object.values(form).some((value) => value.trim().length > 0) || files.length > 0;
    if (hasEnteredData && !window.confirm('Clear the entered Ticket details and selected attachments?')) return;
    setForm(initialForm);
    setFiles([]);
    setFileErrors([]);
    setFieldErrors({});
    setFormAlert(null);
    setCreatedTicket(null);
    setUploadFailures([]);
    setSubmitState('idle');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitState === 'submitting' || !selectedRequester) return;
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormAlert('Please correct the highlighted fields.');
      return;
    }

    setSubmitState('submitting');
    setFormAlert(null);
    setFieldErrors({});
    setUploadFailures([]);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: selectedRequester.id,
          categoryId: Number(form.categoryId),
          relatedSystemId: Number(form.relatedSystemId),
          summary: form.summary.trim(),
          description: form.description.trim(),
          requestedPriority: form.requestedPriority,
        }),
      });
      const body = await readJson(response) as ApiErrorBody & { ticket?: unknown };
      if (!response.ok || !isTicket(body.ticket)) {
        setFieldErrors(body.fieldErrors ?? {});
        setFormAlert(body.error ?? 'Unable to create the Ticket.');
        setSubmitState('error');
        return;
      }

      const failedUploads: string[] = [];
      for (const file of files) {
        try {
          const uploadBody = new FormData();
          uploadBody.append('requesterId', String(selectedRequester.id));
          uploadBody.append('file', file, file.name);
          const uploadResponse = await fetch(`/api/tickets/${body.ticket.id}/attachments`, {
            method: 'POST',
            body: uploadBody,
          });
          const uploadResult = await readJson(uploadResponse) as ApiErrorBody;
          if (!uploadResponse.ok) {
            failedUploads.push(`${file.name}: ${uploadResult.error ?? 'Upload failed.'}`);
          }
        } catch {
          failedUploads.push(`${file.name}: Unable to upload this attachment.`);
        }
      }
      setCreatedTicket(body.ticket);
      setUploadFailures(failedUploads);
      setSubmitState('success');
    } catch {
      setFormAlert('Unable to create the Ticket. Your entered values are still here.');
      setSubmitState('error');
    }
  };

  if (!selectedRequester) return null;

  return (
    <section className="create-ticket-page" aria-labelledby="create-ticket-title">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 2</p>
          <h1 id="create-ticket-title">Create Ticket</h1>
          <p className="text-secondary">Describe the issue and send it to the IT service desk.</p>
        </div>
        <Link className="btn btn-secondary" to="/tickets">My Tickets</Link>
      </div>

      {referenceState === 'loading' && (
        <p role="status" className="state-message">Loading Categories and Related Systems...</p>
      )}
      {referenceState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{referenceError}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadReferenceData()}>Retry</button>
        </div>
      )}

      {referenceState === 'ready' && (
        <form className="ticket-form" onSubmit={submit} aria-busy={submitState === 'submitting'} noValidate>
          {formAlert && <div role="alert" className="state-message state-message-error">{formAlert}</div>}
          <div className="ticket-form-grid">
            <ReadOnlyRequester requester={selectedRequester} />
            <div className="ticket-field">
              <label className="required-label" htmlFor="category">Category</label>
              <select id="category" value={form.categoryId} onChange={(event) => updateForm('categoryId', event.target.value)} aria-invalid={Boolean(fieldErrors.categoryId)} aria-describedby="category-error">
                <option value="">Select a Category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <FieldError id="category-error" message={fieldErrors.categoryId} />
            </div>
            <div className="ticket-field">
              <label className="required-label" htmlFor="related-system">Related System</label>
              <select id="related-system" value={form.relatedSystemId} onChange={(event) => updateForm('relatedSystemId', event.target.value)} aria-invalid={Boolean(fieldErrors.relatedSystemId)} aria-describedby="related-system-error">
                <option value="">Select a Related System</option>
                {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
              </select>
              <FieldError id="related-system-error" message={fieldErrors.relatedSystemId} />
            </div>
            <div className="ticket-field">
              <label className="required-label" htmlFor="requested-priority">Requested Priority</label>
              <select id="requested-priority" value={form.requestedPriority} onChange={(event) => updateForm('requestedPriority', event.target.value as FormValues['requestedPriority'])}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="ticket-field ticket-field-wide">
              <label className="required-label" htmlFor="summary">Summary</label>
              <input id="summary" value={form.summary} maxLength={120} onChange={(event) => updateForm('summary', event.target.value)} aria-invalid={Boolean(fieldErrors.summary)} aria-describedby="summary-error" />
              <FieldError id="summary-error" message={fieldErrors.summary} />
            </div>
            <div className="ticket-field ticket-field-wide">
              <label className="required-label" htmlFor="description">Description</label>
              <textarea id="description" rows={7} maxLength={4000} value={form.description} onChange={(event) => updateForm('description', event.target.value)} aria-invalid={Boolean(fieldErrors.description)} aria-describedby="description-error" />
              <FieldError id="description-error" message={fieldErrors.description} />
            </div>
            <div className="ticket-field ticket-field-wide">
              <label htmlFor="attachments">Attachments</label>
              <input id="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={onFileChange} aria-describedby="attachments-help" />
              <small id="attachments-help">Optional, JPG, PNG, WEBP, or PDF, up to 5 MB each, five files maximum.</small>
              {fileErrors.length > 0 && <div role="status" aria-live="polite" className="field-error attachment-errors">{fileErrors.map((error) => <p key={error}>{error}</p>)}</div>}
              {files.length > 0 && (
                <ul className="selected-files" aria-label="Selected attachments">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                      <div className="selected-file-details">
                        <strong>{file.name}</strong>
                        <span>{file.type || 'Unknown type'} · {formatBytes(file.size)}</span>
                      </div>
                      <span className="file-state">Ready to upload</span>
                      <button
                        type="button"
                        className="btn btn-link selected-file-remove"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((current) => current.filter((candidate) => candidate !== file))}
                        disabled={submitState === 'submitting'}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {submitState === 'success' && createdTicket && (
            <div role="status" className="state-message state-message-success">
              <h2>Ticket created successfully</h2>
              <p>Ticket Number: <strong>{createdTicket.ticketNumber}</strong></p>
              <p>Ticket Date: <time dateTime={createdTicket.ticketDate}>{formatTicketDate(createdTicket.ticketDate)}</time></p>
              <p>Status: <strong>{createdTicket.currentStatus}</strong></p>
              {uploadFailures.length > 0 && (
                <div className="attachment-errors">
                  <p>Some attachments could not be uploaded.</p>
                  <ul>{uploadFailures.map((failure) => <li key={failure}>{failure}</li>)}</ul>
                </div>
              )}
              <div className="action-row"><Link className="btn btn-primary" to={`/tickets/${createdTicket.id}`}>View Ticket</Link><Link className="btn btn-secondary" to="/tickets">Go to My Tickets</Link></div>
            </div>
          )}
          <div className="action-row">
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitState === 'submitting'}>{submitState === 'submitting' ? 'Creating Ticket...' : 'Create Ticket'}</button>
            <button type="button" className="btn btn-secondary" onClick={clearForm} disabled={submitState === 'submitting'}>Clear Form</button>
          </div>
        </form>
      )}
    </section>
  );
}
