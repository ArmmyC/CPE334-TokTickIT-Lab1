import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { apiErrorMessage, apiFetch, isApiErrorBody, readJson } from './api';

export type ActionTakenActor = {
  id: number;
  name: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
};

export type ActionTaken = {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string;
  performedBy: ActionTakenActor;
  followUpRequired: boolean;
  followUpCompleted: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: ActionTakenActor;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isActionTakenActor(value: unknown): value is ActionTakenActor {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && (value.id as number) > 0
    && typeof value.name === 'string'
    && (value.role === 'REQUESTER' || value.role === 'IT_STAFF' || value.role === 'ADMINISTRATOR');
}

export function isActionTaken(value: unknown): value is ActionTaken {
  return isRecord(value)
    && Number.isSafeInteger(value.id)
    && (value.id as number) > 0
    && Number.isSafeInteger(value.ticketId)
    && (value.ticketId as number) > 0
    && typeof value.actionAt === 'string'
    && typeof value.description === 'string'
    && typeof value.result === 'string'
    && isActionTakenActor(value.performedBy)
    && typeof value.followUpRequired === 'boolean'
    && typeof value.followUpCompleted === 'boolean'
    && (value.followUpNote === null || typeof value.followUpNote === 'string')
    && (value.attachmentNotes === null || typeof value.attachmentNotes === 'string')
    && Number.isSafeInteger(value.version)
    && (value.version as number) >= 1
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && (value.updatedBy === undefined || isActionTakenActor(value.updatedBy));
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type ActionTakenForm = {
  actionAt: string;
  description: string;
  result: string;
  followUpRequired: 'yes' | 'no';
  followUpCompleted: boolean;
  followUpNote: string;
  attachmentNotes: string;
};

function toLocalDateTimeValue(value: Date): string {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function createEmptyForm(): ActionTakenForm {
  return {
    actionAt: toLocalDateTimeValue(new Date()),
    description: '',
    result: '',
    followUpRequired: 'no',
    followUpCompleted: false,
    followUpNote: '',
    attachmentNotes: '',
  };
}

const activeTicketStatuses = new Set([
  'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED',
]);
const terminalTicketStatuses = new Set(['RESOLVED', 'CLOSED', 'CANCELLED']);
const actionFieldControlIds: Record<string, string> = {
  actionAt: 'action-taken-action-at',
  description: 'action-taken-description',
  result: 'action-taken-result',
  followUpRequired: 'action-taken-follow-up-required',
  followUpCompleted: 'action-taken-follow-up-completed',
  followUpNote: 'action-taken-follow-up-note',
  attachmentNotes: 'action-taken-attachment-notes',
};

type ActionsTakenSectionProps = {
  actionsTaken: ActionTaken[];
  ticketId?: number;
  ticketStatus?: string;
  canEdit?: boolean;
  currentUser?: ActionTakenActor | null;
  onChanged?: () => void;
};

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="actions-taken-field"><dt>{label}</dt><dd>{children}</dd></div>;
}

function RequiredFieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <div className="actions-taken-required-label">
      <label htmlFor={htmlFor}>{children}</label>
      <span className="required-field-indicator" aria-hidden="true">*</span>
    </div>
  );
}

export function ActionsTakenSection({
  actionsTaken,
  ticketId,
  ticketStatus = '',
  canEdit = false,
  currentUser,
  onChanged,
}: ActionsTakenSectionProps) {
  const orderedActions = [...actionsTaken].sort((left, right) => (
    new Date(left.actionAt).getTime() - new Date(right.actionAt).getTime() || left.id - right.id
  ));
  const canWrite = canEdit && activeTicketStatuses.has(ticketStatus) && Number.isSafeInteger(ticketId) && (ticketId ?? 0) > 0;
  const [isCreating, setIsCreating] = useState(false);
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [form, setForm] = useState<ActionTakenForm>(createEmptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [canReload, setCanReload] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const clearFieldError = (field: string) => {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const startCreate = () => {
    if (!canWrite || isSaving) return;
    setForm(createEmptyForm());
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);
    setCanReload(false);
    setEditingActionId(null);
    setIsCreating(true);
  };

  const startEdit = (action: ActionTaken) => {
    if (!canWrite || isSaving) return;
    setForm({
      actionAt: toLocalDateTimeValue(new Date(action.actionAt)),
      description: action.description,
      result: action.result,
      followUpRequired: action.followUpRequired ? 'yes' : 'no',
      followUpCompleted: action.followUpCompleted,
      followUpNote: action.followUpNote ?? '',
      attachmentNotes: action.attachmentNotes ?? '',
    });
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);
    setCanReload(false);
    setIsCreating(false);
    setEditingActionId(action.id);
  };

  const cancelCreate = () => {
    if (isSaving) return;
    setIsCreating(false);
    setEditingActionId(null);
    setFieldErrors({});
    setFormError(null);
  };

  const saveAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || savingRef.current || ticketId === undefined) return;
    const actionToEdit = editingActionId === null
      ? undefined
      : actionsTaken.find((action) => action.id === editingActionId);
    if (editingActionId !== null && !actionToEdit) {
      setFormError('This Action Taken is no longer available. Reload the current Ticket before continuing.');
      setCanReload(true);
      return;
    }

    const errors: Record<string, string> = {};
    if (!form.actionAt) errors.actionAt = 'Action Date/Time is required.';
    if (!form.description.trim()) errors.description = 'Action Description is required.';
    if (!form.result.trim()) errors.result = 'Result is required.';
    if (form.followUpRequired === 'yes' && !form.followUpNote.trim()) {
      errors.followUpNote = 'Follow-Up Note is required when Follow-Up Required is yes.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Review the Action Taken fields and correct the errors.');
      setFormSuccess(null);
      return;
    }

    const actionAt = new Date(form.actionAt);
    if (Number.isNaN(actionAt.getTime())) {
      setFieldErrors({ actionAt: 'Enter a valid Action Date/Time.' });
      setFormError('Review the Action Taken fields and correct the errors.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);
    setCanReload(false);
    try {
      const isUpdate = actionToEdit !== undefined;
      const requestBody = {
        ...(actionToEdit ? { expectedVersion: actionToEdit.version } : {}),
        actionAt: actionAt.toISOString(),
        description: form.description.trim(),
        result: form.result.trim(),
        followUpRequired: form.followUpRequired === 'yes',
        ...(actionToEdit ? { followUpCompleted: form.followUpRequired === 'yes' && form.followUpCompleted } : {}),
        followUpNote: form.followUpRequired === 'yes' ? form.followUpNote.trim() : null,
        attachmentNotes: form.attachmentNotes.trim() || null,
      };
      const response = await apiFetch(
        isUpdate
          ? `/api/staff/tickets/${ticketId}/actions/${actionToEdit.id}`
          : `/api/staff/tickets/${ticketId}/actions`,
        {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(!isUpdate ? { 'Idempotency-Key': globalThis.crypto.randomUUID() } : {}),
          },
          body: JSON.stringify(requestBody),
        },
      );
      const body = await readJson(response);
      if (!response.ok) {
        const errorBody = isApiErrorBody(body) ? body : null;
        const receivedFieldErrors = errorBody && typeof errorBody.fieldErrors === 'object' && errorBody.fieldErrors !== null
          ? errorBody.fieldErrors as Record<string, string>
          : {};
        setFieldErrors(receivedFieldErrors);
        setFormError(apiErrorMessage(errorBody, 'Unable to save the Action Taken. Your entries are preserved.'));
        setCanReload(response.status === 409);
        return;
      }
      if (!isApiErrorBody(body) || !isActionTaken((body as Record<string, unknown>).actionTaken)) {
        setFormError('The Action Taken response was incomplete. Your entries are preserved.');
        return;
      }
      setIsCreating(false);
      setEditingActionId(null);
      setFormSuccess('Action Taken saved. Ticket details are refreshing.');
      onChanged?.();
    } catch {
      setFormError('Unable to save the Action Taken. Your entries are preserved.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const isFormOpen = isCreating || editingActionId !== null;
  const actionBeingEdited = editingActionId === null
    ? undefined
    : actionsTaken.find((action) => action.id === editingActionId);

  return (
    <section id="actions-taken" className="ticket-detail-card actions-taken-section" aria-labelledby="actions-taken-title">
      <div className="actions-taken-heading">
        <h2 id="actions-taken-title">Actions Taken</h2>
        {canWrite && !isFormOpen && (
          <button type="button" className="btn btn-primary" onClick={startCreate} disabled={isSaving}>
            Add Action Taken
          </button>
        )}
      </div>
      {terminalTicketStatuses.has(ticketStatus) && canEdit && (
        <p className="state-message">Actions Taken are read-only while this Ticket is {ticketStatus}. Reopen the Ticket before adding or editing an action.</p>
      )}
      {formSuccess && <p role="status" className="state-message state-message-success">{formSuccess}</p>}
      {orderedActions.length === 0 ? (
        <p className="state-message">No Actions Taken have been recorded yet.</p>
      ) : (
        <ol className="actions-taken-list">
          {orderedActions.map((action) => (
            <li key={action.id}>
              <article className="actions-taken-card" aria-label={`Action Taken ${action.id}`}>
                <div className="actions-taken-card-heading">
                  <h3>{formatDate(action.actionAt)}</h3>
                  {canWrite && !isFormOpen && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startEdit(action)}
                      aria-label={`Edit Action Taken ${action.id}`}
                    >Edit</button>
                  )}
                </div>
                <dl className="actions-taken-details">
                  <DetailField label="Action Description">{action.description}</DetailField>
                  <DetailField label="Result">{action.result}</DetailField>
                  <DetailField label="Performed by">{action.performedBy.name}</DetailField>
                  <DetailField label="Follow-Up Required">{action.followUpRequired ? 'Yes' : 'No'}</DetailField>
                  <DetailField label="Follow-Up Completed">{action.followUpCompleted ? 'Yes' : 'No'}</DetailField>
                  {action.followUpNote && <DetailField label="Follow-Up Note">{action.followUpNote}</DetailField>}
                  {action.attachmentNotes && <DetailField label="Attachment Notes">{action.attachmentNotes}</DetailField>}
                  {action.updatedAt !== action.createdAt && action.updatedBy && (
                    <DetailField label="Last edited by">{action.updatedBy.name} on {formatDate(action.updatedAt)}</DetailField>
                  )}
                </dl>
              </article>
            </li>
          ))}
        </ol>
      )}
      {isFormOpen && (
        <form id="actions-taken-form" className="actions-taken-form" onSubmit={(event) => { void saveAction(event); }} aria-busy={isSaving} noValidate>
          <h3>{isCreating ? 'Add Action Taken' : 'Edit Action Taken'}</h3>
          {formError && (
            <div role="alert" className="state-message state-message-error">
              <p>{formError}</p>
              {Object.keys(fieldErrors).length > 0 && (
                <ul className="actions-taken-error-summary">
                  {Object.entries(fieldErrors).map(([field, message]) => (
                    <li key={field}>
                      <a href={`#${actionFieldControlIds[field] ?? 'actions-taken-form'}`}>{message}</a>
                    </li>
                  ))}
                </ul>
              )}
              {canReload && <button type="button" className="btn btn-secondary" onClick={() => onChanged?.()}>Reload Ticket Detail</button>}
            </div>
          )}
          <fieldset className="actions-taken-form-fields" disabled={isSaving || !canWrite} aria-label="Action Taken details">
          <div className="actions-taken-form-grid">
            <div className="ticket-field">
              <RequiredFieldLabel htmlFor="action-taken-action-at">Action Date/Time</RequiredFieldLabel>
              <input
                id="action-taken-action-at"
                type="datetime-local"
                required
                value={form.actionAt}
                onChange={(event) => {
                  setForm((current) => ({ ...current, actionAt: event.target.value }));
                  clearFieldError('actionAt');
                }}
                aria-invalid={Boolean(fieldErrors.actionAt)}
                aria-describedby={fieldErrors.actionAt ? 'action-taken-action-at-error' : undefined}
              />
              {fieldErrors.actionAt && <small id="action-taken-action-at-error" className="field-error">{fieldErrors.actionAt}</small>}
            </div>
            <div className="ticket-field">
              <RequiredFieldLabel htmlFor="action-taken-description">Action Description</RequiredFieldLabel>
              <textarea
                id="action-taken-description"
                required
                maxLength={4000}
                rows={3}
                value={form.description}
                onChange={(event) => {
                  setForm((current) => ({ ...current, description: event.target.value }));
                  clearFieldError('description');
                }}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? 'action-taken-description-error' : undefined}
              />
              {fieldErrors.description && <small id="action-taken-description-error" className="field-error">{fieldErrors.description}</small>}
            </div>
            <div className="ticket-field">
              <RequiredFieldLabel htmlFor="action-taken-result">Result</RequiredFieldLabel>
              <textarea
                id="action-taken-result"
                required
                maxLength={4000}
                rows={3}
                value={form.result}
                onChange={(event) => {
                  setForm((current) => ({ ...current, result: event.target.value }));
                  clearFieldError('result');
                }}
                aria-invalid={Boolean(fieldErrors.result)}
                aria-describedby={fieldErrors.result ? 'action-taken-result-error' : undefined}
              />
              {fieldErrors.result && <small id="action-taken-result-error" className="field-error">{fieldErrors.result}</small>}
            </div>
            <div className="ticket-field">
              <RequiredFieldLabel htmlFor="action-taken-follow-up-required">Follow-Up Required</RequiredFieldLabel>
              <select
                id="action-taken-follow-up-required"
                value={form.followUpRequired}
                aria-invalid={Boolean(fieldErrors.followUpRequired)}
                aria-describedby={fieldErrors.followUpRequired ? 'action-taken-follow-up-required-error' : undefined}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    followUpRequired: event.target.value as ActionTakenForm['followUpRequired'],
                    followUpNote: event.target.value === 'no' ? '' : current.followUpNote,
                    followUpCompleted: event.target.value === 'no' ? false : current.followUpCompleted,
                  }));
                  clearFieldError('followUpRequired');
                  if (event.target.value === 'no') {
                    clearFieldError('followUpNote');
                    clearFieldError('followUpCompleted');
                  }
                }}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              {fieldErrors.followUpRequired && <small id="action-taken-follow-up-required-error" className="field-error">{fieldErrors.followUpRequired}</small>}
            </div>
            {!isCreating && form.followUpRequired === 'yes' && (
              <div className="ticket-field actions-taken-completion-field">
                <label className="actions-taken-checkbox-label" htmlFor="action-taken-follow-up-completed">
                  <input
                    id="action-taken-follow-up-completed"
                    type="checkbox"
                    checked={form.followUpCompleted}
                    aria-invalid={Boolean(fieldErrors.followUpCompleted)}
                    aria-describedby={fieldErrors.followUpCompleted ? 'action-taken-follow-up-completed-error' : undefined}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, followUpCompleted: event.target.checked }));
                      clearFieldError('followUpCompleted');
                    }}
                  />
                  <span>Follow-Up Completed</span>
                </label>
                <small>Mark the required follow-up complete. The original required flag and note remain recorded.</small>
                {fieldErrors.followUpCompleted && <small id="action-taken-follow-up-completed-error" className="field-error">{fieldErrors.followUpCompleted}</small>}
              </div>
            )}
            {form.followUpRequired === 'yes' && (
              <div className="ticket-field">
                <RequiredFieldLabel htmlFor="action-taken-follow-up-note">Follow-Up Note</RequiredFieldLabel>
                <textarea
                  id="action-taken-follow-up-note"
                  required
                  maxLength={2000}
                  rows={3}
                  value={form.followUpNote}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, followUpNote: event.target.value }));
                    clearFieldError('followUpNote');
                  }}
                  aria-invalid={Boolean(fieldErrors.followUpNote)}
                  aria-describedby={fieldErrors.followUpNote ? 'action-taken-follow-up-note-error' : undefined}
                />
                {fieldErrors.followUpNote && <small id="action-taken-follow-up-note-error" className="field-error">{fieldErrors.followUpNote}</small>}
              </div>
            )}
            <div className="ticket-field">
              <label htmlFor="action-taken-attachment-notes">Attachment Notes</label>
              <textarea
                id="action-taken-attachment-notes"
                maxLength={2000}
                rows={3}
                value={form.attachmentNotes}
                aria-invalid={Boolean(fieldErrors.attachmentNotes)}
                aria-describedby={fieldErrors.attachmentNotes ? 'action-taken-attachment-notes-error' : undefined}
                onChange={(event) => {
                  setForm((current) => ({ ...current, attachmentNotes: event.target.value }));
                  clearFieldError('attachmentNotes');
                }}
              />
              {fieldErrors.attachmentNotes && <small id="action-taken-attachment-notes-error" className="field-error">{fieldErrors.attachmentNotes}</small>}
            </div>
            <div className="ticket-field ticket-field-readonly">
              <span className="actions-taken-label">Performed by</span>
              <p>{actionBeingEdited?.performedBy.name ?? currentUser?.name ?? 'Recorded from your signed-in account'}</p>
              <small>{isCreating ? 'The server records the signed-in actor automatically.' : 'The original performer cannot be changed.'}</small>
            </div>
          </div>
          </fieldset>
          <div className="action-row">
            <button type="submit" className="btn btn-primary" disabled={isSaving || !canWrite}>
              {isSaving ? (isCreating ? 'Saving Action Taken...' : 'Saving Changes...') : (isCreating ? 'Save Action Taken' : 'Save Changes')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelCreate} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
