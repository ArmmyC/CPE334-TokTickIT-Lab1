import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const staffUser = {
  id: 3,
  name: 'Somsak Staff',
  email: 'somsak@example.test',
  role: 'IT_STAFF',
  isActive: true,
  mustChangePassword: false,
};
const requesterUser = {
  id: 1,
  name: 'Ariya Anderson',
  email: 'ariya@example.test',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: false,
};
const categories = [
  { id: 2, name: 'Network' },
  { id: 4, name: 'Hardware' },
];
const relatedSystems = [
  { id: 5, name: 'Campus Wi-Fi' },
  { id: 7, name: 'Corporate Laptop' },
];
const queueTicket = {
  id: 12,
  ticketNumber: 'TKT-2026-000012',
  ticketDate: '2026-09-08T10:00:00.000Z',
  summary: 'Campus Wi-Fi disconnects',
  requester: {
    id: 1,
    name: 'Ariya Anderson',
    email: 'ariya@example.test',
  },
  category: {
    id: 2,
    name: 'Network',
  },
  relatedSystem: {
    id: 5,
    name: 'Campus Wi-Fi',
  },
  requestedPriority: 'HIGH',
  itPriority: 'URGENT',
  currentStatus: 'IN_PROGRESS',
  owner: {
    id: 3,
    name: 'Somsak Staff',
    role: 'IT_STAFF',
  },
  updatedAt: '2026-09-08T11:00:00.000Z',
};

const listResponse = (overrides: Partial<Record<string, unknown>> = {}) => ({
  items: [queueTicket],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
  ...overrides,
});

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function stubStaffQueueApi({
  user = staffUser,
  queueResponse = { ok: true, status: 200, json: async () => listResponse() },
}: {
  user?: typeof staffUser | typeof requesterUser;
  queueResponse?: { ok: boolean; status: number; json: () => Promise<unknown> };
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ user, passwordChangeRequired: false }),
      });
    }
    if (url.endsWith('/api/categories')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => categories });
    }
    if (url.endsWith('/api/related-systems')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => relatedSystems });
    }
    if (url.includes('/api/staff/tickets')) {
      return Promise.resolve(queueResponse);
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderStaffQueue(options?: Parameters<typeof stubStaffQueueApi>[0]) {
  const fetchMock = stubStaffQueueApi(options);
  setPath('/staff/tickets');
  render(<BrowserRouter><App /></BrowserRouter>);
  if (options?.user?.role !== 'REQUESTER') {
    expect(await screen.findByRole('heading', { name: 'Staff Ticket Queue' })).toBeInTheDocument();
  }
  return fetchMock;
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/staff/tickets');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 3 Staff Ticket Queue screen', () => {
  it('shows loading, the required queue fields, staff navigation, and a detail action', async () => {
    let resolveQueue: ((response: { ok: boolean; status: number; json: () => Promise<unknown> }) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ user: staffUser, passwordChangeRequired: false }) });
      if (url.endsWith('/api/categories')) return Promise.resolve({ ok: true, status: 200, json: async () => categories });
      if (url.endsWith('/api/related-systems')) return Promise.resolve({ ok: true, status: 200, json: async () => relatedSystems });
      if (url.includes('/api/staff/tickets')) return new Promise((resolve) => { resolveQueue = resolve; });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    setPath('/staff/tickets');
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: 'Staff Ticket Queue' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading Tickets/i);
    resolveQueue?.({ ok: true, status: 200, json: async () => listResponse() });

    expect(await screen.findByRole('columnheader', { name: 'Ticket Number' })).toBeInTheDocument();
    for (const heading of [
      'Created Date',
      'Summary',
      'Requester',
      'Category',
      'Requested Priority',
      'IT Priority',
      'Current Status',
      'Ticket Owner',
      'Last Updated',
      'View Detail',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Ticket Queue' })).toHaveAttribute('href', '/staff/tickets');
    expect(screen.getByRole('searchbox', { name: 'Search Tickets' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Requested Priority' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'IT Priority' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ticket Owner' })).toBeInTheDocument();
    expect(screen.getAllByText('TKT-2026-000012').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ariya Anderson').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Campus Wi-Fi disconnects').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IN_PROGRESS').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'View Detail' })[0]).toHaveAttribute('href', '/staff/tickets/12');
  });

  it('keeps IT Staff on the authenticated shell when opening a ticket detail link', async () => {
    await renderStaffQueue();
    await screen.findAllByText('TKT-2026-000012');

    fireEvent.click(screen.getAllByRole('link', { name: 'View Detail' })[0]);

    expect(await screen.findByRole('heading', { name: 'Staff Ticket Detail' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('sends all queue filters and sort choices, resetting the page to one', async () => {
    const fetchMock = await renderStaffQueue();
    await screen.findAllByText('TKT-2026-000012');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Tickets' }), { target: { value: 'campus' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), { target: { value: 'OPEN' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Requested Priority' }), { target: { value: 'HIGH' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'IT Priority' }), { target: { value: 'UNASSIGNED' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Ticket Owner' }), { target: { value: 'UNASSIGNED' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Related System' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort By' }), { target: { value: 'currentStatus' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort Order' }), { target: { value: 'asc' } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls.some((url) => (
        url.includes('page=1')
        && url.includes('pageSize=20')
        && url.includes('search=campus')
        && url.includes('status=OPEN')
        && url.includes('requestedPriority=HIGH')
        && url.includes('itPriority=UNASSIGNED')
        && url.includes('ownerId=UNASSIGNED')
        && url.includes('categoryId=2')
        && url.includes('relatedSystemId=5')
        && url.includes('sortBy=currentStatus')
        && url.includes('sortOrder=asc')
      ))).toBe(true);
    });
  });

  it('distinguishes an unfiltered empty queue from a filtered no-results state and supports pagination', async () => {
    await renderStaffQueue({
      queueResponse: {
        ok: true,
        status: 200,
        json: async () => listResponse({ items: [], totalItems: 0, totalPages: 0 }),
      },
    });
    expect(await screen.findByText(/No Tickets are currently in the queue/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Tickets' }), { target: { value: 'printer' } });
    expect(await screen.findByText(/No Tickets match your search or filters/i)).toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    const paginatedFetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ user: staffUser, passwordChangeRequired: false }) });
      if (url.endsWith('/api/categories')) return Promise.resolve({ ok: true, status: 200, json: async () => categories });
      if (url.endsWith('/api/related-systems')) return Promise.resolve({ ok: true, status: 200, json: async () => relatedSystems });
      if (url.includes('/api/staff/tickets')) return Promise.resolve({ ok: true, status: 200, json: async () => listResponse({ page: 2, totalItems: 21, totalPages: 2, hasNext: false, hasPrevious: true }) });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', paginatedFetch);
    setPath('/staff/tickets');
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(await screen.findByRole('heading', { name: 'Staff Ticket Queue' })).toBeInTheDocument();
    expect((await screen.findAllByText(/Page 2 of 2/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it.each([
    [401, 'AUTHENTICATION_REQUIRED', /session has expired/i],
    [403, 'FORBIDDEN', /do not have permission/i],
    [400, 'VALIDATION_FAILED', /filters are invalid/i],
    [500, 'UNEXPECTED_ERROR', /Unable to load Staff Ticket Queue/i],
  ])('shows a safe state for a %s queue response', async (status, code, message) => {
    await renderStaffQueue({
      queueResponse: {
        ok: false,
        status,
        json: async () => ({ error: status === 500 ? 'Unable to load Staff Ticket Queue.' : 'Request failed.', code }),
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    if (status === 401) {
      expect(screen.getByRole('link', { name: 'Sign in again' })).toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    }
  });

  it('keeps the queue unavailable to Requester accounts', async () => {
    const fetchMock = await renderStaffQueue({ user: requesterUser });

    expect(await screen.findByText(/IT Staff access is required/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/staff/tickets'))).toBe(false);
  });
});
