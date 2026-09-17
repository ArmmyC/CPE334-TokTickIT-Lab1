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

const administratorUser = {
  id: 8,
  name: 'Nok Administrator',
  email: 'nok@example.test',
  role: 'ADMINISTRATOR' as const,
  isActive: true,
  mustChangePassword: false,
};

const detailResponse = {
  ticket: {
    id: 12,
    ticketNumber: 'TKT-2026-000012',
    ticketDate: '2026-09-08T10:00:00.000Z',
    summary: 'Campus Wi-Fi disconnects',
    description: 'The wireless connection drops every few minutes in the engineering lab.',
    requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
    category: { id: 2, name: 'Network' },
    relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'IN_PROGRESS',
    owner: { id: 3, name: 'Somsak Staff', email: 'somsak@example.test', role: 'IT_STAFF' },
    attachments: [{
      id: 7,
      ticketId: 12,
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12000,
      uploadedAt: '2026-09-08T10:00:00.000Z',
      removedAt: null,
      removalReason: null,
      downloadAvailable: true,
    }],
    publicComments: [{
      id: 4,
      content: 'The issue still occurs after restarting.',
      author: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
      createdAt: '2026-09-08T11:10:00.000Z',
    }],
    internalNotes: [{
      id: 7,
      content: 'Waiting for network team confirmation.',
      author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
      createdAt: '2026-09-08T11:15:00.000Z',
    }],
    requesterResolution: {
      resolvedAt: '2026-09-08T11:20:00.000Z',
      resolvedBy: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
    },
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T11:00:00.000Z',
  },
};

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function stubStaffDetailApi({
  user = staffUser,
  detail = detailResponse,
  detailResponseOverride,
  ownerUpdateResponse,
}: {
  user?: typeof staffUser | typeof administratorUser;
  detail?: typeof detailResponse;
  detailResponseOverride?: { ok: boolean; status: number; body: unknown };
  ownerUpdateResponse?: Promise<ReturnType<typeof jsonResponse>>;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user, passwordChangeRequired: false }));
    }
    if (url === '/api/staff/tickets/12' && method === 'GET') {
      if (detailResponseOverride) {
        return Promise.resolve(jsonResponse(
          detailResponseOverride.body,
          detailResponseOverride.ok,
          detailResponseOverride.status,
        ));
      }
      return Promise.resolve(jsonResponse(detail));
    }
    if (url === '/api/staff/tickets/12/owner' && method === 'PATCH') {
      if (ownerUpdateResponse) {
        return ownerUpdateResponse;
      }
      return Promise.resolve(jsonResponse(detail));
    }
    if (url === '/api/staff/tickets/12/priority' && method === 'PATCH') {
      return Promise.resolve(jsonResponse(detail));
    }
    if (url === '/api/staff/tickets/12/status' && method === 'PATCH') {
      return Promise.resolve(jsonResponse(detail));
    }
    if (url === '/api/staff/tickets/12/comments' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        comment: {
          id: 10,
          content: 'Technician update',
          author: staffUser,
          createdAt: '2026-09-08T11:30:00.000Z',
        },
      }, true, 201));
    }
    if (url === '/api/staff/tickets/12/notes' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        note: {
          id: 11,
          content: 'Internal follow-up',
          author: staffUser,
          createdAt: '2026-09-08T11:35:00.000Z',
        },
      }, true, 201));
    }
    return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderStaffDetail(options?: Parameters<typeof stubStaffDetailApi>[0]) {
  const fetchMock = stubStaffDetailApi(options);
  setPath('/staff/tickets/12');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Staff Ticket Detail' })).toBeInTheDocument();
  if (!options?.detailResponseOverride || options.detailResponseOverride.ok) {
    expect(await screen.findByText('TKT-2026-000012')).toBeInTheDocument();
  }
  return fetchMock;
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

describe('Lab 3 Staff Ticket Detail screen', () => {
  it('renders protected Ticket information, operational controls, attachments, comments, and private notes', async () => {
    await renderStaffDetail();

    expect(await screen.findByText('TKT-2026-000012')).toBeInTheDocument();
    expect(screen.getByText('Campus Wi-Fi disconnects')).toBeInTheDocument();
    expect(screen.getByText('Ariya Anderson (ariya@example.test)')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Owner User ID' })).toHaveValue(3);
    expect(screen.getByRole('button', { name: 'Claim Ticket' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'IT Priority' })).toHaveValue('HIGH');
    expect(screen.getByRole('combobox', { name: 'Current Status' })).toHaveValue('IN_PROGRESS');
    expect(screen.getByRole('button', { name: 'Update Status' })).toBeInTheDocument();
    expect(screen.getByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.getByText('The issue still occurs after restarting.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for network team confirmation.')).toBeInTheDocument();
    expect(screen.getByText('Internal only')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add attachment')).not.toBeInTheDocument();
  });

  it('submits claim, IT Priority, confirmed status, Public Comment, and Internal Note operations', async () => {
    const fetchMock = await renderStaffDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Claim Ticket' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input) === '/api/staff/tickets/12/owner'
      && init?.method === 'PATCH'
      && String(init.body).includes('"ownerId":3')
    ))).toBe(true));

    fireEvent.change(screen.getByRole('combobox', { name: 'IT Priority' }), { target: { value: 'URGENT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save IT Priority' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input) === '/api/staff/tickets/12/priority'
      && init?.method === 'PATCH'
      && String(init.body).includes('"itPriority":"URGENT"')
    ))).toBe(true));

    fireEvent.change(screen.getByRole('combobox', { name: 'Current Status' }), { target: { value: 'RESOLVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));
    expect(screen.getByRole('button', { name: 'Confirm status change' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm status change' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input) === '/api/staff/tickets/12/status'
      && init?.method === 'PATCH'
      && String(init.body).includes('"confirmed":true')
    ))).toBe(true));

    fireEvent.change(screen.getByRole('textbox', { name: 'Public Comment' }), { target: { value: 'Technician update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Public Comment' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input) === '/api/staff/tickets/12/comments'
      && init?.method === 'POST'
    ))).toBe(true));

    fireEvent.change(screen.getByRole('textbox', { name: 'Internal Note' }), { target: { value: 'Internal follow-up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Internal Note' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input) === '/api/staff/tickets/12/notes'
      && init?.method === 'POST'
    ))).toBe(true));
  });

  it('shows the Administrator protected view with IT Priority editing only', async () => {
    const fetchMock = stubStaffDetailApi({ user: administratorUser });
    setPath('/admin/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: 'Administrator Ticket View' })).toBeInTheDocument();
    expect(await screen.findByText('TKT-2026-000012')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'IT Priority' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save IT Priority' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Owner User ID' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Public Comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Internal Note' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/staff/tickets/12').length).toBeGreaterThan(0);
  });

  it('shows a safe forbidden state when the protected detail cannot be read', async () => {
    await renderStaffDetail({
      detailResponseOverride: {
        ok: false,
        status: 403,
        body: { error: 'You do not have permission to access this resource.', code: 'FORBIDDEN' },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have permission/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('moves focus into the status confirmation dialog and back to its trigger', async () => {
    await renderStaffDetail();

    const statusTrigger = screen.getByRole('button', { name: 'Update Status' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Current Status' }), { target: { value: 'RESOLVED' } });
    fireEvent.click(statusTrigger);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel status change' });
    await waitFor(() => expect(cancelButton).toHaveFocus());

    fireEvent.click(cancelButton);
    await waitFor(() => expect(statusTrigger).toHaveFocus());
  });

  it('keeps unrelated actions enabled while one operation is saving', async () => {
    let resolveOwnerUpdate!: (response: ReturnType<typeof jsonResponse>) => void;
    const ownerUpdateResponse = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      resolveOwnerUpdate = resolve;
    });
    await renderStaffDetail({ ownerUpdateResponse });

    fireEvent.click(screen.getByRole('button', { name: 'Claim Ticket' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving Owner...' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Save IT Priority' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Update Status' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Post Public Comment' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Internal Note' })).not.toBeDisabled();

    resolveOwnerUpdate(jsonResponse(detailResponse));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Claim Ticket' })).not.toBeDisabled());
  });
});
