import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const staffUser = {
  id: 47,
  name: 'Staff Dashboard Test',
  email: 'staff.dashboard@example.test',
  role: 'IT_STAFF' as const,
  isActive: true,
  mustChangePassword: false,
};

const adminUser = {
  ...staffUser,
  id: 52,
  name: 'Admin Dashboard Test',
  email: 'admin.dashboard@example.test',
  role: 'ADMINISTRATOR' as const,
};

const asOf = '2099-10-30T12:00:00.000Z';
const windowStart = '2099-10-23T12:00:00.000Z';
const staffDashboard = {
  dashboard: {
    asOf,
    windowStart,
    metrics: { unassigned: 2, ownedByMe: 3, actionsTakenByMe: 9, recentlyUpdated: 5 },
    activeByStatus: { NEW: 1, OPEN: 2, IN_PROGRESS: 3, WAITING_FOR_REQUESTER: 1, REOPENED: 0 },
    activeByItPriority: { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 0, UNASSIGNED: 1 },
    recentlyUpdatedTickets: [
      {
        ticketId: 21,
        ticketNumber: 'L4-STAFF-000021',
        summary: 'Wireless access is intermittent',
        requester: { id: 31, name: 'Requester Dashboard Test', email: 'requester@example.test' },
        owner: { id: 47, name: 'Staff Dashboard Test', role: 'IT_STAFF' },
        currentStatus: 'IN_PROGRESS',
        itPriority: 'HIGH',
        lastActivityAt: '2099-10-30T11:00:00.000Z',
      },
    ],
    recentActionsTakenByMe: [
      {
        actionId: 81,
        ticketId: 21,
        ticketNumber: 'L4-STAFF-000021',
        summary: 'Wireless access is intermittent',
        actionAt: '2099-10-30T10:30:00.000Z',
        result: 'The connection stayed stable during testing.',
        followUpRequired: true,
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

function installStaffApi({
  user = staffUser,
  dashboard = staffDashboard,
  ok = true,
  status = 200,
}: {
  user?: typeof staffUser | typeof adminUser;
  dashboard?: unknown;
  ok?: boolean;
  status?: number;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user, passwordChangeRequired: false }));
    }
    if (url === '/api/staff/dashboard') {
      return Promise.resolve(jsonResponse(dashboard, ok, status));
    }
    if (url === '/api/categories' || url === '/api/related-systems') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.startsWith('/api/staff/tickets?')) {
      return Promise.resolve(jsonResponse({
        items: [{
          id: 21,
          ticketNumber: 'L4-STAFF-000021',
          ticketDate: '2099-10-29T10:00:00.000Z',
          summary: 'Wireless access is intermittent',
          requester: { id: 31, name: 'Requester Dashboard Test', email: 'requester@example.test' },
          category: { id: 1, name: 'Network' },
          relatedSystem: { id: 2, name: 'Campus Wi-Fi' },
          requestedPriority: 'HIGH',
          itPriority: 'HIGH',
          currentStatus: 'IN_PROGRESS',
          owner: { id: user.id, name: user.name, role: user.role },
          updatedAt: '2099-10-30T11:00:00.000Z',
        }],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
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
  setPath('/staff/dashboard');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 4 Staff dashboard UI', () => {
  it('shows authoritative metrics, zero-filled breakdowns, recent rows, and exact filters', async () => {
    const fetchMock = installStaffApi();
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: /^Staff Dashboard$/ })).toBeVisible();
    expect(await screen.findByText('Requester Dashboard Test')).toBeVisible();
    expect(screen.getByText('The connection stayed stable during testing.')).toBeVisible();
    expect(screen.getByText(new Date('2099-10-30T11:00:00.000Z').toLocaleString())).toBeVisible();

    expect(within(screen.getByRole('link', { name: /Unassigned Active Tickets/ })).getByText('2')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Active Tickets Owned by Me/ })).getByText('3')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Actions Taken by Me/ })).getByText('9')).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Recently Updated Tickets/ })).getByText('5')).toBeVisible();
    expect(screen.getByRole('link', { name: /Unassigned Active Tickets/ }))
      .toHaveAttribute('href', '/staff/tickets?statusGroup=ACTIVE&ownerId=UNASSIGNED');
    expect(screen.getByRole('link', { name: /Active Tickets Owned by Me/ }))
      .toHaveAttribute('href', '/staff/tickets?statusGroup=ACTIVE&ownerId=ME');
    expect(screen.getByRole('link', { name: /Actions Taken by Me/ }))
      .toHaveAttribute('href', '/staff/tickets?actionPerformedBy=ME');
    expect(screen.getByRole('link', { name: /Recently Updated Tickets/ }))
      .toHaveAttribute('href', `/staff/tickets?activitySince=${encodeURIComponent(windowStart)}&activityUntil=${encodeURIComponent(asOf)}`);
    const statusCounts = within(screen.getByRole('region', { name: 'Active Tickets by Status' }));
    for (const [status, label, count] of [
      ['NEW', 'New', 1],
      ['OPEN', 'Open', 2],
      ['IN_PROGRESS', 'In Progress', 3],
      ['WAITING_FOR_REQUESTER', 'Waiting for Requester', 1],
      ['REOPENED', 'Reopened', 0],
    ] as const) {
      const ticketWord = count === 1 ? 'Ticket' : 'Tickets';
      expect(statusCounts.getByRole('link', { name: `${label}: ${count} active ${ticketWord}` }))
        .toHaveAttribute('href', `/staff/tickets?status=${status}`);
    }
    const priorityCounts = within(screen.getByRole('region', { name: 'Active Tickets by IT Priority' }));
    for (const [priority, label, count] of [
      ['LOW', 'Low', 1],
      ['MEDIUM', 'Medium', 2],
      ['HIGH', 'High', 3],
      ['URGENT', 'Urgent', 0],
      ['UNASSIGNED', 'Unassigned', 1],
    ] as const) {
      const ticketWord = count === 1 ? 'Ticket' : 'Tickets';
      expect(priorityCounts.getByRole('link', { name: `${label}: ${count} active ${ticketWord}` }))
        .toHaveAttribute('href', `/staff/tickets?statusGroup=ACTIVE&itPriority=${priority}`);
    }
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/staff/dashboard');
    const staffTicketLinks = screen.getAllByRole('link', { name: /L4-STAFF-000021/ });
    expect(staffTicketLinks).toHaveLength(2);
    expect(staffTicketLinks.map((link) => link.getAttribute('href')))
      .toEqual(['/staff/tickets/21', '/staff/tickets/21']);
    expect(screen.getAllByText('Reopened').length).toBeGreaterThan(0);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/staff/dashboard', expect.anything());
  });

  it('allows Administrator dashboard drill-down to read the filtered Staff Queue', async () => {
    const fetchMock = installStaffApi({ user: adminUser });
    setPath('/staff/tickets?statusGroup=ACTIVE&ownerId=ME');
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: /^Staff Ticket Queue$/ })).toBeVisible();
    await waitFor(() => {
      const ticketRequests = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.startsWith('/api/staff/tickets?'));
      expect(ticketRequests.some((url) => url.includes('statusGroup=ACTIVE') && url.includes('ownerId=ME'))).toBe(true);
    });

    const detailLinks = screen.getAllByRole('link', { name: /L4-STAFF-000021/ });
    expect(detailLinks).toHaveLength(2);
    expect(detailLinks.map((link) => link.getAttribute('href')))
      .toEqual(['/admin/tickets/21', '/admin/tickets/21']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/staff/dashboard');
    expect(screen.queryByRole('button', { name: /Assign Owner|Change Status|Add Internal Note/i })).not.toBeInTheDocument();
  });

  it('uses Administrator detail links for the shared, read-only dashboard', async () => {
    installStaffApi({ user: adminUser });
    render(<BrowserRouter><App /></BrowserRouter>);

    const adminTicketLinks = await screen.findAllByRole('link', { name: /L4-STAFF-000021/ });
    expect(adminTicketLinks).toHaveLength(2);
    expect(adminTicketLinks.map((link) => link.getAttribute('href')))
      .toEqual(['/admin/tickets/21', '/admin/tickets/21']);
    expect(screen.queryByRole('button', { name: /Assign Owner|Change Status|Add Internal Note/i })).not.toBeInTheDocument();
  });

  it('shows an accessible safe error for unavailable dashboard data', async () => {
    installStaffApi({
      dashboard: { error: 'Unable to load the Staff dashboard.', code: 'UNEXPECTED_ERROR' },
      ok: false,
      status: 500,
    });
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load the Staff dashboard.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/stack|sql|token|password|file path/i);
    expect(screen.queryByRole('link', { name: /L4-STAFF-000021/ })).not.toBeInTheDocument();
  });
});
