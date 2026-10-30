import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const requesterUser = {
  id: 31,
  name: 'Requester Dashboard Test',
  email: 'requester.dashboard@example.test',
  role: 'REQUESTER' as const,
  isActive: true,
  mustChangePassword: false,
};

const staffUser = {
  id: 47,
  name: 'Staff Dashboard Test',
  email: 'staff.dashboard@example.test',
  role: 'IT_STAFF' as const,
  isActive: true,
  mustChangePassword: false,
};

const asOf = '2099-10-30T12:00:00.000Z';
const windowStart = '2099-10-23T12:00:00.000Z';
const recentRequesterDashboard = {
  dashboard: {
    asOf,
    windowStart,
    metrics: { openTickets: 4, waitingForRequester: 1, recentlyUpdated: 2, recentlyResolved: 1 },
    recentlyUpdatedTickets: [
      {
        ticketId: 12,
        ticketNumber: 'L4-REQ-000012',
        summary: 'Campus Wi-Fi disconnects',
        currentStatus: 'IN_PROGRESS',
        itPriority: 'HIGH',
        lastActivityAt: '2099-10-30T11:00:00.000Z',
      },
      {
        ticketId: 13,
        ticketNumber: 'L4-REQ-000013',
        summary: 'Printer asks for a new driver',
        currentStatus: 'WAITING_FOR_REQUESTER',
        itPriority: null,
        lastActivityAt: '2099-10-29T11:00:00.000Z',
      },
    ],
    recentlyResolvedTickets: [
      {
        ticketId: 14,
        ticketNumber: 'L4-REQ-000014',
        summary: 'VPN connection restored',
        currentStatus: 'RESOLVED',
        itPriority: 'MEDIUM',
        resolvedAt: '2099-10-28T10:00:00.000Z',
      },
    ],
  },
};

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function installRequesterApi({
  dashboard = recentRequesterDashboard,
  dashboardResponse,
}: {
  dashboard?: unknown;
  dashboardResponse?: Promise<unknown>;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user: requesterUser, passwordChangeRequired: false }));
    }
    if (url === '/api/requester/dashboard') {
      return dashboardResponse
        ? dashboardResponse as Promise<ReturnType<typeof jsonResponse>>
        : Promise.resolve(jsonResponse(dashboard));
    }
    if (url === '/api/categories' || url === '/api/related-systems') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.startsWith('/api/tickets?')) {
      return Promise.resolve(jsonResponse({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/requester/dashboard');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 4 Requester dashboard UI', () => {
  it('shows API metrics, recent rows, local-time timestamps, and exact drill-down links', async () => {
    const fetchMock = installRequesterApi();
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: /^Requester Dashboard$/ })).toBeVisible();
    expect(await screen.findByText('Campus Wi-Fi disconnects')).toBeVisible();
    expect(screen.getByText('VPN connection restored')).toBeVisible();
    expect(screen.getByText('IT Priority: HIGH')).toBeVisible();
    expect(screen.getByText(new Date('2099-10-30T11:00:00.000Z').toLocaleString())).toBeVisible();

    expect(within(screen.getByRole('link', { name: /Open Tickets/ })).getByText('4')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Waiting for You/ })).getByText('1')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Recently Updated/ })).getByText('2')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Recently Resolved/ })).getByText('1')).toBeVisible();
    expect(screen.getByRole('link', { name: /Open Tickets/ })).toHaveAttribute('href', '/tickets?statusGroup=ACTIVE');
    expect(screen.getByRole('link', { name: /Waiting for You/ }))
      .toHaveAttribute('href', '/tickets?currentStatus=WAITING_FOR_REQUESTER');
    expect(screen.getByRole('link', { name: /Recently Updated/ }))
      .toHaveAttribute('href', `/tickets?activitySince=${encodeURIComponent(windowStart)}&activityUntil=${encodeURIComponent(asOf)}`);
    expect(screen.getByRole('link', { name: /Recently Resolved/ }))
      .toHaveAttribute('href', `/tickets?statusGroup=RESOLVED&resolvedSince=${encodeURIComponent(windowStart)}&resolvedUntil=${encodeURIComponent(asOf)}`);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/requester/dashboard');
    expect(screen.getByRole('link', { name: /L4-REQ-000012/ })).toHaveAttribute('href', '/tickets/12');
    expect(screen.getByRole('link', { name: /L4-REQ-000014/ })).toHaveAttribute('href', '/tickets/14');
    expect(fetchMock).toHaveBeenCalledWith('/api/requester/dashboard', expect.anything());
    expect(screen.queryByText('Staff Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Requester Dashboard Test private data')).not.toBeInTheDocument();
  });

  it('carries the selected dashboard time range into the My Tickets API request', async () => {
    const fetchMock = installRequesterApi();
    render(<BrowserRouter><App /></BrowserRouter>);
    await screen.findByRole('heading', { name: /^Requester Dashboard$/ });
    await screen.findByRole('link', { name: /Recently Updated/ });

    fireEvent.click(screen.getByRole('link', { name: /Recently Updated/ }));
    expect(await screen.findByRole('heading', { name: /^My Tickets$/ })).toBeVisible();

    await waitFor(() => {
      const ticketRequests = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.startsWith('/api/tickets?'));
      expect(ticketRequests.some((url) => (
        url.includes(`activitySince=${encodeURIComponent(windowStart)}`)
        && url.includes(`activityUntil=${encodeURIComponent(asOf)}`)
      ))).toBe(true);
    });
  });

  it('announces loading and renders explicit zero metrics and useful empty states', async () => {
    let resolveDashboard!: (value: unknown) => void;
    const dashboardResponse = new Promise((resolve) => { resolveDashboard = resolve; })
      .then((body) => jsonResponse(body));
    installRequesterApi({ dashboardResponse });
    render(<BrowserRouter><App /></BrowserRouter>);

    const loading = await screen.findByText('Loading Requester dashboard...');
    expect(loading.closest('[role="status"]')).toHaveAttribute('aria-busy', 'true');
    resolveDashboard({
      dashboard: {
        asOf,
        windowStart,
        metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
        recentlyUpdatedTickets: [],
        recentlyResolvedTickets: [],
      },
    });

    expect(await screen.findByText(/no recently updated Tickets/i)).toBeVisible();
    expect(screen.getAllByText('0')).toHaveLength(4);
    expect(screen.getByText(/no recently resolved Tickets/i)).toBeVisible();
  });

  it('shows a safe operation error when the dashboard API is forbidden or unavailable', async () => {
    installRequesterApi({
      dashboardResponse: Promise.resolve(jsonResponse({
        error: 'Unable to load the Requester dashboard.',
        code: 'UNEXPECTED_ERROR',
      }, false, 500)),
    });
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load the Requester dashboard.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/stack|sql|token|password|file path/i);
    expect(screen.queryByRole('link', { name: /L4-REQ-000012/ })).not.toBeInTheDocument();
  });

  it('keeps Requester-only routes unavailable to Staff', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(jsonResponse({ user: staffUser, passwordChangeRequired: false }));
      }
      if (url === '/api/categories' || url === '/api/related-systems') {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.startsWith('/api/tickets?')) {
        return Promise.resolve(jsonResponse({
          items: [],
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: /^Requester access is required$/ })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/requester/dashboard', expect.anything());
  });
});
