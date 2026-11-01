import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage, apiFetch, readJson } from './api';
import { useAuth } from './auth-context';

type RequesterTicketRow = {
  ticketId: number;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  itPriority: string | null;
  lastActivityAt?: string;
  resolvedAt?: string;
};

type RequesterDashboardData = {
  asOf: string;
  windowStart: string;
  metrics: {
    openTickets: number;
    waitingForRequester: number;
    recentlyUpdated: number;
    recentlyResolved: number;
  };
  recentlyUpdatedTickets: RequesterTicketRow[];
  recentlyResolvedTickets: RequesterTicketRow[];
};

type StaffTicketRow = {
  ticketId: number;
  ticketNumber: string;
  summary: string;
  requester: { id: number; name: string; email: string };
  owner: { id: number; name: string; role: string } | null;
  currentStatus: string;
  itPriority: string | null;
  lastActivityAt: string;
  activityType?: string;
};

type StaffActionRow = {
  actionId: number;
  ticketId: number;
  ticketNumber: string;
  summary: string;
  actionAt: string;
  result: string;
  followUpRequired: boolean;
};

type StaffDashboardData = {
  asOf: string;
  windowStart: string;
  metrics: {
    unassigned: number;
    ownedByMe: number;
    actionsTakenByMe: number;
    recentlyUpdated: number;
  };
  activeByStatus: Record<'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'REOPENED', number>;
  activeByItPriority: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'UNASSIGNED', number>;
  recentlyUpdatedTickets: StaffTicketRow[];
  recentActionsTakenByMe: StaffActionRow[];
};

type LoadState = 'loading' | 'ready' | 'error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRequesterTicketRow(value: unknown): value is RequesterTicketRow {
  if (!isRecord(value)) return false;
  return Number.isSafeInteger(value.ticketId)
    && typeof value.ticketNumber === 'string'
    && typeof value.summary === 'string'
    && typeof value.currentStatus === 'string'
    && (value.itPriority === null || typeof value.itPriority === 'string')
    && (value.lastActivityAt === undefined || typeof value.lastActivityAt === 'string')
    && (value.resolvedAt === undefined || typeof value.resolvedAt === 'string');
}

function parseRequesterDashboard(value: unknown): RequesterDashboardData | null {
  if (!isRecord(value) || !isRecord(value.metrics)
    || !Array.isArray(value.recentlyUpdatedTickets)
    || !Array.isArray(value.recentlyResolvedTickets)) return null;
  const { metrics } = value;
  if (typeof value.asOf !== 'string' || typeof value.windowStart !== 'string'
    || !isCount(metrics.openTickets) || !isCount(metrics.waitingForRequester)
    || !isCount(metrics.recentlyUpdated) || !isCount(metrics.recentlyResolved)
    || !value.recentlyUpdatedTickets.every(isRequesterTicketRow)
    || !value.recentlyResolvedTickets.every(isRequesterTicketRow)) return null;
  return value as unknown as RequesterDashboardData;
}

function isStaffTicketRow(value: unknown): value is StaffTicketRow {
  if (!isRecord(value) || !isRecord(value.requester)) return false;
  const requester = value.requester;
  const owner = value.owner;
  const validOwner = owner === null
    || (isRecord(owner) && Number.isSafeInteger(owner.id) && typeof owner.name === 'string' && typeof owner.role === 'string');
  return Number.isSafeInteger(value.ticketId)
    && typeof value.ticketNumber === 'string'
    && typeof value.summary === 'string'
    && Number.isSafeInteger(requester.id)
    && typeof requester.name === 'string'
    && typeof requester.email === 'string'
    && validOwner
    && typeof value.currentStatus === 'string'
    && (value.itPriority === null || typeof value.itPriority === 'string')
    && typeof value.lastActivityAt === 'string'
    && (value.activityType === undefined || typeof value.activityType === 'string');
}

function isStaffActionRow(value: unknown): value is StaffActionRow {
  return isRecord(value)
    && Number.isSafeInteger(value.actionId)
    && Number.isSafeInteger(value.ticketId)
    && typeof value.ticketNumber === 'string'
    && typeof value.summary === 'string'
    && typeof value.actionAt === 'string'
    && typeof value.result === 'string'
    && typeof value.followUpRequired === 'boolean';
}

function hasCountKeys(value: unknown, keys: string[]): value is Record<string, number> {
  return isRecord(value) && keys.every((key) => isCount(value[key]));
}

function parseStaffDashboard(value: unknown): StaffDashboardData | null {
  if (!isRecord(value) || !isRecord(value.metrics)
    || !Array.isArray(value.recentlyUpdatedTickets)
    || !Array.isArray(value.recentActionsTakenByMe)) return null;
  const { metrics } = value;
  if (typeof value.asOf !== 'string' || typeof value.windowStart !== 'string'
    || !isCount(metrics.unassigned) || !isCount(metrics.ownedByMe)
    || !isCount(metrics.actionsTakenByMe) || !isCount(metrics.recentlyUpdated)
    || !hasCountKeys(value.activeByStatus, ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'])
    || !hasCountKeys(value.activeByItPriority, ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'UNASSIGNED'])
    || !value.recentlyUpdatedTickets.every(isStaffTicketRow)
    || !value.recentActionsTakenByMe.every(isStaffActionRow)) return null;
  return value as unknown as StaffDashboardData;
}

function useDashboardData<T>(
  endpoint: string,
  operation: string,
  parse: (value: unknown) => T | null,
) {
  const [data, setData] = useState<T | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage(null);
    void apiFetch(endpoint)
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) throw new Error(apiErrorMessage(body, `Unable to load the ${operation}.`));
        const parsed = isRecord(body) ? parse(body.dashboard) : null;
        if (!parsed) throw new Error(`Unable to load the ${operation}.`);
        return parsed;
      })
      .then((dashboard) => {
        if (cancelled) return;
        setData(dashboard);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage(`Unable to load the ${operation}.`);
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [endpoint, operation, parse]);

  return { data, loadState, errorMessage };
}

function useFocusTitle() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

function formatLocalTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatTicketStatus(value: string): string {
  const labels: Record<string, string> = {
    NEW: 'New',
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    WAITING_FOR_REQUESTER: 'Waiting for Requester',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
    CANCELLED: 'Cancelled',
  };
  return labels[value] ?? value;
}

function MetricCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link className="dashboard-metric-card" to={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <span className="dashboard-metric-hint">View matching Tickets</span>
    </Link>
  );
}

function RequesterTicketList({
  title,
  rows,
  timestampKey,
  emptyText,
}: {
  title: string;
  rows: RequesterTicketRow[];
  timestampKey: 'lastActivityAt' | 'resolvedAt';
  emptyText: string;
}) {
  return (
    <section className="dashboard-panel" aria-label={title}>
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
        <Link to="/tickets">My Tickets</Link>
      </div>
      {rows.length === 0 ? (
        <p className="dashboard-empty">{emptyText} <Link to="/tickets">View My Tickets</Link>.</p>
      ) : (
        <ul className="dashboard-recent-list">
          {rows.map((ticket) => {
            const timestamp = ticket[timestampKey];
            return (
              <li className="dashboard-recent-card" key={ticket.ticketId}>
                <div className="dashboard-recent-heading">
                  <Link to={`/tickets/${ticket.ticketId}`} aria-label={`Ticket ${ticket.ticketNumber}: ${ticket.summary}`}>
                    {ticket.ticketNumber}
                  </Link>
                  <span className="ticket-status-badge">{formatTicketStatus(ticket.currentStatus)}</span>
                </div>
                <p>{ticket.summary}</p>
                <div className="dashboard-recent-meta">
                  {ticket.itPriority && <span className="ticket-priority-badge">IT Priority: {ticket.itPriority}</span>}
                  {timestamp && <time dateTime={timestamp}>{formatLocalTimestamp(timestamp)}</time>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RequesterDashboard() {
  const titleRef = useFocusTitle();
  const { data, loadState, errorMessage } = useDashboardData(
    '/api/requester/dashboard',
    'Requester dashboard',
    parseRequesterDashboard,
  );

  return (
    <section className="dashboard-page" aria-labelledby="requester-dashboard-title" aria-busy={loadState === 'loading'}>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 4</p>
          <h1 id="requester-dashboard-title" tabIndex={-1} ref={titleRef}>Requester Dashboard</h1>
          <p className="text-secondary mb-0">A summary of your Tickets and the latest Requester-visible activity.</p>
        </div>
      </div>
      {loadState === 'loading' && <p role="status" aria-live="polite" aria-busy="true" className="state-message">Loading Requester dashboard...</p>}
      {loadState === 'error' && <div role="alert" className="state-message state-message-error">{errorMessage}</div>}
      {loadState === 'ready' && data && (
        <>
          <div className="dashboard-metrics" aria-label="Requester Ticket metrics">
            <MetricCard label="Open Tickets" value={data.metrics.openTickets} href="/tickets?statusGroup=ACTIVE" />
            <MetricCard label="Waiting for You" value={data.metrics.waitingForRequester} href="/tickets?currentStatus=WAITING_FOR_REQUESTER" />
            <MetricCard
              label="Recently Updated"
              value={data.metrics.recentlyUpdated}
              href={`/tickets?activitySince=${encodeURIComponent(data.windowStart)}&activityUntil=${encodeURIComponent(data.asOf)}`}
            />
            <MetricCard
              label="Recently Resolved"
              value={data.metrics.recentlyResolved}
              href={`/tickets?statusGroup=RESOLVED&resolvedSince=${encodeURIComponent(data.windowStart)}&resolvedUntil=${encodeURIComponent(data.asOf)}`}
            />
          </div>
          <div className="dashboard-section-grid">
            <RequesterTicketList
              title="Recently Updated Tickets"
              rows={data.recentlyUpdatedTickets}
              timestampKey="lastActivityAt"
              emptyText="No recently updated Tickets."
            />
            <RequesterTicketList
              title="Recently Resolved Tickets"
              rows={data.recentlyResolvedTickets}
              timestampKey="resolvedAt"
              emptyText="No recently resolved Tickets."
            />
          </div>
        </>
      )}
    </section>
  );
}

const ACTIVE_STATUS_LABELS: Array<[keyof StaffDashboardData['activeByStatus'], string]> = [
  ['NEW', 'New'],
  ['OPEN', 'Open'],
  ['IN_PROGRESS', 'In Progress'],
  ['WAITING_FOR_REQUESTER', 'Waiting for Requester'],
  ['REOPENED', 'Reopened'],
];
const PRIORITY_LABELS: Array<[keyof StaffDashboardData['activeByItPriority'], string]> = [
  ['LOW', 'Low'],
  ['MEDIUM', 'Medium'],
  ['HIGH', 'High'],
  ['URGENT', 'Urgent'],
  ['UNASSIGNED', 'Unassigned'],
];

function activeCountAccessibleName(label: string, count: number): string {
  return `${label}: ${count} active Ticket${count === 1 ? '' : 's'}`;
}

export function StaffDashboard() {
  const titleRef = useFocusTitle();
  const { user } = useAuth();
  const { data, loadState, errorMessage } = useDashboardData(
    '/api/staff/dashboard',
    'Staff dashboard',
    parseStaffDashboard,
  );
  const ticketDetailBase = user?.role === 'ADMINISTRATOR' ? '/admin/tickets' : '/staff/tickets';

  return (
    <section className="dashboard-page" aria-labelledby="staff-dashboard-title" aria-busy={loadState === 'loading'}>
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 4</p>
          <h1 id="staff-dashboard-title" tabIndex={-1} ref={titleRef}>Staff Dashboard</h1>
          {data && <p className="dashboard-as-of">As of <time dateTime={data.asOf}>{formatLocalTimestamp(data.asOf)}</time></p>}
        </div>
      </div>
      {loadState === 'loading' && <p role="status" aria-live="polite" aria-busy="true" className="state-message">Loading Staff dashboard...</p>}
      {loadState === 'error' && <div role="alert" className="state-message state-message-error">{errorMessage}</div>}
      {loadState === 'ready' && data && (
        <>
          <div className="dashboard-metrics" aria-label="Staff Ticket metrics">
            <MetricCard label="Unassigned Active Tickets" value={data.metrics.unassigned} href="/staff/tickets?statusGroup=ACTIVE&ownerId=UNASSIGNED" />
            <MetricCard label="Active Tickets Owned by Me" value={data.metrics.ownedByMe} href="/staff/tickets?statusGroup=ACTIVE&ownerId=ME" />
            <MetricCard label="Actions Taken by Me" value={data.metrics.actionsTakenByMe} href="/staff/tickets?actionPerformedBy=ME" />
            <MetricCard
              label="Recently Updated Tickets"
              value={data.metrics.recentlyUpdated}
              href={`/staff/tickets?activitySince=${encodeURIComponent(data.windowStart)}&activityUntil=${encodeURIComponent(data.asOf)}`}
            />
          </div>
          <div className="dashboard-section-grid dashboard-count-panels">
            <section className="dashboard-panel" aria-labelledby="active-status-counts-title">
              <h2 id="active-status-counts-title">Active Tickets by Status</h2>
              <dl className="dashboard-count-list">
                {ACTIVE_STATUS_LABELS.map(([key, label]) => {
                  const count = data.activeByStatus[key];
                  return (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd><Link to={`/staff/tickets?status=${key}`} aria-label={activeCountAccessibleName(label, count)}>{count}</Link></dd>
                    </div>
                  );
                })}
              </dl>
            </section>
            <section className="dashboard-panel" aria-labelledby="active-priority-counts-title">
              <h2 id="active-priority-counts-title">Active Tickets by IT Priority</h2>
              <dl className="dashboard-count-list">
                {PRIORITY_LABELS.map(([key, label]) => {
                  const count = data.activeByItPriority[key];
                  return (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd><Link to={`/staff/tickets?statusGroup=ACTIVE&itPriority=${key}`} aria-label={activeCountAccessibleName(label, count)}>{count}</Link></dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          </div>
          <div className="dashboard-section-grid">
            <section className="dashboard-panel" aria-labelledby="staff-recent-tickets-title">
              <div className="dashboard-panel-heading">
                <h2 id="staff-recent-tickets-title">Recently Updated Tickets</h2>
                <Link to="/staff/tickets">Ticket Queue</Link>
              </div>
              {data.recentlyUpdatedTickets.length === 0 ? (
                <p className="dashboard-empty">No recently updated Tickets. <Link to="/staff/tickets">View Ticket Queue</Link>.</p>
              ) : (
                <ul className="dashboard-recent-list">
                  {data.recentlyUpdatedTickets.map((ticket) => (
                    <li className="dashboard-recent-card" key={ticket.ticketId}>
                      <div className="dashboard-recent-heading">
                        <Link to={`${ticketDetailBase}/${ticket.ticketId}`} aria-label={`Ticket ${ticket.ticketNumber}: ${ticket.summary}`}>
                          {ticket.ticketNumber}
                        </Link>
                        <span className="ticket-status-badge">{formatTicketStatus(ticket.currentStatus)}</span>
                      </div>
                      <p>{ticket.summary}</p>
                      <dl className="dashboard-ticket-meta">
                        <div><dt>Requester</dt><dd>{ticket.requester.name}</dd></div>
                        <div><dt>Ticket Owner</dt><dd>{ticket.owner?.name ?? 'Unassigned'}</dd></div>
                        <div><dt>IT Priority</dt><dd>{ticket.itPriority ?? 'Unassigned'}</dd></div>
                        <div><dt>Last Activity</dt><dd><time dateTime={ticket.lastActivityAt}>{formatLocalTimestamp(ticket.lastActivityAt)}</time></dd></div>
                        {ticket.activityType && <div><dt>Activity Type</dt><dd>{ticket.activityType}</dd></div>}
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="dashboard-panel" aria-labelledby="staff-recent-actions-title">
              <div className="dashboard-panel-heading">
                <h2 id="staff-recent-actions-title">Recent Actions Taken by Me</h2>
                <Link to="/staff/tickets?actionPerformedBy=ME">View matching Tickets</Link>
              </div>
              {data.recentActionsTakenByMe.length === 0 ? (
                <p className="dashboard-empty">No Actions Taken have been recorded by you yet. <Link to="/staff/tickets">View Ticket Queue</Link>.</p>
              ) : (
                <ul className="dashboard-recent-list">
                  {data.recentActionsTakenByMe.map((action) => (
                    <li className="dashboard-recent-card" key={action.actionId}>
                      <div className="dashboard-recent-heading">
                        <Link to={`${ticketDetailBase}/${action.ticketId}`} aria-label={`Action on Ticket ${action.ticketNumber}: ${action.summary}`}>
                          {action.ticketNumber}
                        </Link>
                        <time dateTime={action.actionAt}>{formatLocalTimestamp(action.actionAt)}</time>
                      </div>
                      <p>{action.summary}</p>
                      <p className="dashboard-action-result">{action.result}</p>
                      <span className={action.followUpRequired ? 'dashboard-follow-up dashboard-follow-up-required' : 'dashboard-follow-up'}>
                        {action.followUpRequired ? 'Follow-up required' : 'No follow-up required'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
