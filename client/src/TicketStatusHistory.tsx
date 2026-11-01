import type { ReactNode } from 'react';

export type TicketStatusHistoryItem = {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  eventKind: 'INITIAL' | 'TRANSITION' | 'LEGACY_BASELINE';
  actor: {
    id: number;
    name: string;
    role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  } | null;
  createdAt: string;
};

type TicketStatusHistoryActorRole = NonNullable<TicketStatusHistoryItem['actor']>['role'];

const roles = new Set(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']);
const eventKinds = new Set(['INITIAL', 'TRANSITION', 'LEGACY_BASELINE']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTicketStatusHistoryItem(value: unknown): value is TicketStatusHistoryItem {
  if (!isRecord(value)
    || !Number.isSafeInteger(value.id)
    || (value.id as number) <= 0
    || (value.fromStatus !== null && typeof value.fromStatus !== 'string')
    || typeof value.toStatus !== 'string'
    || typeof value.eventKind !== 'string'
    || !eventKinds.has(value.eventKind)
    || typeof value.createdAt !== 'string') {
    return false;
  }
  if (value.actor === null) return true;
  return isRecord(value.actor)
    && Number.isSafeInteger(value.actor.id)
    && (value.actor.id as number) > 0
    && typeof value.actor.name === 'string'
    && typeof value.actor.role === 'string'
    && roles.has(value.actor.role);
}

function formatLocalDate(value: string): string {
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

function roleLabel(role: TicketStatusHistoryActorRole): string {
  if (role === 'IT_STAFF') return 'IT Staff';
  if (role === 'ADMINISTRATOR') return 'Administrator';
  return 'Requester';
}

function historyTitle(entry: TicketStatusHistoryItem): string {
  if (entry.eventKind === 'LEGACY_BASELINE') return `Legacy baseline: ${entry.toStatus}`;
  if (entry.eventKind === 'INITIAL') return `Initial status: ${entry.toStatus}`;
  return `${entry.fromStatus ?? 'Unknown'} → ${entry.toStatus}`;
}

export function TicketStatusHistory({
  entries,
  description,
}: {
  entries: TicketStatusHistoryItem[];
  description?: ReactNode;
}) {
  return (
    <section className="ticket-detail-card communication-card ticket-status-history" aria-labelledby="ticket-status-history-title">
      <h2 id="ticket-status-history-title">Status History</h2>
      {description && <p className="communication-help">{description}</p>}
      {entries.length === 0 ? (
        <p className="state-message state-message-warning">No status history has been recorded.</p>
      ) : (
        <ol className="communication-list" aria-label="Status history">
          {entries.map((entry) => (
            <li key={entry.id} className="communication-entry">
              <div className="communication-entry-meta">
                <strong>{historyTitle(entry)}</strong>
                <span>
                  {entry.eventKind === 'LEGACY_BASELINE' || !entry.actor
                    ? 'Legacy baseline'
                    : `${entry.actor.name} · ${roleLabel(entry.actor.role)}`}
                  {' · '}{formatLocalDate(entry.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
