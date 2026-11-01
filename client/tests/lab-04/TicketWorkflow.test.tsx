import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const staffUser = {
  id: 3,
  name: 'Somsak Staff',
  email: 'somsak@example.test',
  role: 'IT_STAFF' as const,
  isActive: true,
  mustChangePassword: false,
};

const requesterUser = {
  id: 1,
  name: 'Ariya Anderson',
  email: 'ariya@example.test',
  role: 'REQUESTER' as const,
  isActive: true,
  mustChangePassword: false,
};

const history = [
  {
    id: 1,
    fromStatus: null,
    toStatus: 'NEW',
    eventKind: 'INITIAL',
    actor: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 2,
    fromStatus: 'NEW',
    toStatus: 'IN_PROGRESS',
    eventKind: 'TRANSITION',
    actor: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
    createdAt: '2026-10-02T08:00:00.000Z',
  },
];

const staffDetail = {
  ticket: {
    id: 12,
    ticketNumber: 'TKT-2026-000012',
    ticketDate: '2026-10-01T08:00:00.000Z',
    summary: 'Campus Wi-Fi disconnects',
    description: 'The wireless connection drops every few minutes.',
    requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
    category: { id: 2, name: 'Network' },
    relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'IN_PROGRESS',
    owner: { id: 3, name: 'Somsak Staff', email: 'somsak@example.test', role: 'IT_STAFF' },
    attachments: [],
    publicComments: [],
    internalNotes: [],
    actionsTaken: [],
    statusHistory: history,
    requesterResolution: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-02T08:00:00.000Z',
    version: 4,
    lastActivityAt: '2026-10-02T08:00:00.000Z',
  },
};

const requesterDetail = {
  ticket: {
    ...staffDetail.ticket,
    owner: undefined,
  },
};

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function stubApi({
  user = staffUser,
  initialDetail = staffDetail,
  updatedDetail = staffDetail,
  statusFailure,
}: {
  user?: typeof staffUser | typeof requesterUser;
  initialDetail?: unknown;
  updatedDetail?: unknown;
  statusFailure?: { status: number; body: unknown };
} = {}) {
  let detailReads = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user, passwordChangeRequired: false }));
    }
    if ((url === '/api/staff/tickets/12' || url === '/api/tickets/12') && method === 'GET') {
      detailReads += 1;
      const next = detailReads > 1 ? updatedDetail : initialDetail;
      return Promise.resolve(jsonResponse(next));
    }
    if (url === '/api/staff/tickets/12/status' && method === 'PATCH') {
      if (statusFailure) return Promise.resolve(jsonResponse(statusFailure.body, false, statusFailure.status));
      return Promise.resolve(jsonResponse(updatedDetail));
    }
    return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderStaff() {
  setPath('/staff/tickets/12');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Staff Ticket Detail' })).toBeInTheDocument();
  expect(await screen.findByText('TKT-2026-000012')).toBeInTheDocument();
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/staff/tickets/12');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 4 Ticket workflow UI', () => {
  it.each([
    ['NEW', ['OPEN', 'CANCELLED']],
    ['OPEN', ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED']],
    ['IN_PROGRESS', ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED']],
    ['WAITING_FOR_REQUESTER', ['IN_PROGRESS', 'RESOLVED', 'CANCELLED']],
    ['RESOLVED', ['CLOSED', 'REOPENED']],
    ['CLOSED', ['REOPENED']],
    ['REOPENED', ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED']],
    ['CANCELLED', ['REOPENED']],
  ] as Array<[string, string[]]>)('offers only the permitted next statuses from %s', async (currentStatus, expectedNextStatuses) => {
    const initialDetail = {
      ticket: { ...staffDetail.ticket, currentStatus },
    };
    stubApi({ initialDetail, updatedDetail: initialDetail });
    await renderStaff();

    const options = Array.from((screen.getByRole('combobox', { name: 'Next Status' }) as HTMLSelectElement).options)
      .map((option) => option.value)
      .filter(Boolean);
    expect(options).toEqual(expectedNextStatuses);
  });

  it('renders ordered, read-only history including the Legacy baseline label', async () => {
    stubApi();
    await renderStaff();

    const statusSelect = screen.getByRole('combobox', { name: 'Next Status' });
    const options = Array.from((statusSelect as HTMLSelectElement).options).map((option) => option.value);
    expect(options).toEqual(['', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED']);
    expect(screen.queryByRole('option', { name: 'Closed' })).not.toBeInTheDocument();

    const timeline = screen.getByRole('list', { name: 'Status history' });
    expect(timeline.textContent?.indexOf('NEW')).toBeLessThan(timeline.textContent?.indexOf('IN_PROGRESS') ?? -1);
    expect(timeline).toHaveTextContent('Somsak Staff');
    expect(screen.queryByRole('button', { name: /edit|delete status history/i })).not.toBeInTheDocument();
  });

  it('labels a migration baseline without inventing an actor', async () => {
    const legacyDetail = {
      ticket: {
        ...staffDetail.ticket,
        statusHistory: [{
          id: 1,
          fromStatus: null,
          toStatus: 'IN_PROGRESS',
          eventKind: 'LEGACY_BASELINE',
          actor: null,
          createdAt: '2026-10-01T08:00:00.000Z',
        }],
      },
    };
    stubApi({ initialDetail: legacyDetail, updatedDetail: legacyDetail });
    await renderStaff();

    const timeline = screen.getByRole('list', { name: 'Status history' });
    expect(timeline).toHaveTextContent('Legacy baseline: IN_PROGRESS');
    expect(timeline).toHaveTextContent('Legacy baseline');
  });

  it('submits the selected next status with the Ticket version', async () => {
    const fetchMock = stubApi();
    await renderStaff();

    fireEvent.change(screen.getByRole('combobox', { name: 'Next Status' }), { target: { value: 'WAITING_FOR_REQUESTER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    await waitFor(() => {
      const update = fetchMock.mock.calls.find(([input, init]) => (
        String(input) === '/api/staff/tickets/12/status' && init?.method === 'PATCH'
      ));
      expect(update).toBeDefined();
      expect(JSON.parse(String(update?.[1]?.body))).toEqual({
        expectedVersion: 4,
        nextStatus: 'WAITING_FOR_REQUESTER',
        confirmed: false,
      });
    });
  });

  it('requires confirmation before resolving a Ticket', async () => {
    const fetchMock = stubApi();
    await renderStaff();

    fireEvent.change(screen.getByRole('combobox', { name: 'Next Status' }), { target: { value: 'RESOLVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    expect(screen.getByRole('dialog', { name: 'Confirm status change' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/staff/tickets/12/status')).toBe(false);
  });

  it('explains a blocked resolution gate and links to Actions Taken', async () => {
    stubApi({
      statusFailure: {
        status: 409,
        body: {
          error: 'Ticket cannot be resolved until its Actions Taken requirements are complete.',
          code: 'RESOLUTION_GATE_BLOCKED',
        },
      },
    });
    await renderStaff();

    fireEvent.change(screen.getByRole('combobox', { name: 'Next Status' }), { target: { value: 'RESOLVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm status change' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least one Action Taken/i);
    expect(screen.getByRole('link', { name: /Actions Taken/i })).toHaveAttribute('href', '#actions-taken');
  });

  it('preserves the selected next status through an explicit stale-form refresh', async () => {
    const latestDetail = {
      ticket: {
        ...staffDetail.ticket,
        currentStatus: 'OPEN' as const,
        version: 5,
      },
    };
    const fetchMock = stubApi({
      updatedDetail: latestDetail,
      statusFailure: {
        status: 409,
        body: {
          error: 'This Ticket changed after you loaded it.',
          code: 'TICKET_VERSION_CONFLICT',
          currentStatus: 'IN_PROGRESS',
          currentVersion: 5,
        },
      },
    });
    await renderStaff();

    fireEvent.change(screen.getByRole('combobox', { name: 'Next Status' }), { target: { value: 'WAITING_FOR_REQUESTER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/changed after you loaded it/i);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current Ticket' }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/staff/tickets/12').length).toBe(2));
    expect(await screen.findByRole('combobox', { name: 'Next Status' })).toHaveValue('WAITING_FOR_REQUESTER');
  });

  it('shows the same read-only status history to the owning Requester', async () => {
    stubApi({ user: requesterUser });
    setPath('/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: 'Ticket Detail' })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Status history' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Status history' })).toHaveTextContent('Somsak Staff');
    expect(screen.queryByRole('combobox', { name: 'Next Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|delete status history/i })).not.toBeInTheDocument();
  });
});
