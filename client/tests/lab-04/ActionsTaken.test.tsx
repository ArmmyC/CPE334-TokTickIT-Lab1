import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { ActionTaken } from '../../src/ActionsTakenSection';

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
    version: 4,
    statusHistory: [],
    owner: { id: 3, name: 'Somsak Staff', email: 'somsak@example.test', role: 'IT_STAFF' },
    attachments: [],
    publicComments: [],
    internalNotes: [],
    requesterResolution: null,
    actionsTaken: [{
      id: 31,
      ticketId: 12,
      actionAt: '2026-10-28T09:30:00.000Z',
      description: 'Replaced the damaged adapter.',
      result: 'The workstation starts normally.',
      performedBy: { id: 9, name: 'Nicha Engineer', role: 'IT_STAFF' },
      followUpRequired: true,
      followUpCompleted: false,
      followUpNote: 'Check battery health next week.',
      attachmentNotes: 'Adapter photo is in the ticket attachments.',
      version: 1,
      createdAt: '2026-10-28T09:31:00.000Z',
      updatedAt: '2026-10-28T09:31:00.000Z',
      updatedBy: { id: 9, name: 'Nicha Engineer', role: 'IT_STAFF' },
    }],
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-10-28T09:31:00.000Z',
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
  createFailure,
  createResponse,
  updateFailure,
  statusAfterUpdateFailure,
}: {
  user?: typeof staffUser | typeof administratorUser;
  detail?: typeof detailResponse;
  createFailure?: { status: number; body: unknown };
  createResponse?: Promise<ReturnType<typeof jsonResponse>>;
  updateFailure?: { status: number; body: unknown };
  statusAfterUpdateFailure?: string;
} = {}) {
  let createdAction: ActionTaken | null = null;
  let editedAction = (detail.ticket.actionsTaken[0] as ActionTaken | undefined) ?? null;
  let updateWasRejected = false;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user, passwordChangeRequired: false }));
    }
    if (url === '/api/staff/tickets/12' && method === 'GET') {
      const actionsTaken = [
        ...detail.ticket.actionsTaken.filter((action) => action.id !== editedAction?.id),
        ...(editedAction ? [editedAction] : []),
        ...(createdAction ? [createdAction] : []),
      ];
      return Promise.resolve(jsonResponse({
        ticket: {
          ...detail.ticket,
          ...(updateWasRejected && statusAfterUpdateFailure ? { currentStatus: statusAfterUpdateFailure } : {}),
          actionsTaken,
        },
      }));
    }
    if (url === '/api/staff/tickets/12/actions/31' && method === 'PATCH') {
      if (!editedAction) return Promise.resolve(jsonResponse({ error: 'Action Taken not found.' }, false, 404));
      if (updateFailure) {
        updateWasRejected = true;
        return Promise.resolve(jsonResponse(updateFailure.body, false, updateFailure.status));
      }
      const submitted = JSON.parse(String(init?.body)) as Record<string, unknown>;
      editedAction = {
        ...editedAction,
        actionAt: String(submitted.actionAt),
        description: String(submitted.description),
        result: String(submitted.result),
        followUpRequired: Boolean(submitted.followUpRequired),
        followUpCompleted: Boolean(submitted.followUpCompleted),
        followUpNote: typeof submitted.followUpNote === 'string' ? submitted.followUpNote : null,
        attachmentNotes: typeof submitted.attachmentNotes === 'string' ? submitted.attachmentNotes : null,
        version: 2,
        updatedAt: '2026-10-29T09:40:00.000Z',
        updatedBy: { id: staffUser.id, name: staffUser.name, role: 'IT_STAFF' },
      };
      return Promise.resolve(jsonResponse({ actionTaken: editedAction }));
    }
    if (url === '/api/staff/tickets/12/actions' && method === 'POST') {
      if (createResponse) return createResponse;
      if (createFailure) return Promise.resolve(jsonResponse(createFailure.body, false, createFailure.status));
      const submitted = JSON.parse(String(init?.body)) as Record<string, unknown>;
      createdAction = {
        id: 32,
        ticketId: 12,
        actionAt: String(submitted.actionAt),
        description: String(submitted.description),
        result: String(submitted.result),
        performedBy: { id: staffUser.id, name: staffUser.name, role: 'IT_STAFF' },
        followUpRequired: Boolean(submitted.followUpRequired),
        followUpCompleted: false,
        followUpNote: typeof submitted.followUpNote === 'string' ? submitted.followUpNote : null,
        attachmentNotes: typeof submitted.attachmentNotes === 'string' ? submitted.attachmentNotes : null,
        version: 1,
        createdAt: '2026-10-29T09:30:00.000Z',
        updatedAt: '2026-10-29T09:30:00.000Z',
        updatedBy: { id: staffUser.id, name: staffUser.name, role: 'IT_STAFF' },
      };
      return Promise.resolve(jsonResponse({ actionTaken: createdAction }, true, 201));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubRequesterDetailApi() {
  const requesterAction = { ...detailResponse.ticket.actionsTaken[0] } as ActionTaken;
  delete requesterAction.updatedBy;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user: requesterUser, passwordChangeRequired: false }));
    }
    if (url === '/api/tickets/12') {
      return Promise.resolve(jsonResponse({
        ticket: { ...detailResponse.ticket, actionsTaken: [requesterAction] },
      }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
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

describe('Lab 4 Actions Taken UI', () => {
  it('shows action details and the original performer separately from Ticket Owner', async () => {
    stubStaffDetailApi();
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    const actions = await screen.findByRole('region', { name: 'Actions Taken' });

    expect(within(actions).getByText('Replaced the damaged adapter.')).toBeInTheDocument();
    expect(within(actions).getByText('The workstation starts normally.')).toBeInTheDocument();
    expect(within(actions).getByText('Nicha Engineer')).toBeInTheDocument();
    expect(within(actions).getByText('Check battery health next week.')).toBeInTheDocument();
    expect(screen.getByText('Ticket Owner').parentElement).toHaveTextContent('Somsak Staff');
  });

  it('creates an action with server-owned identity and refreshes the Ticket detail', async () => {
    const fetchMock = stubStaffDetailApi();
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Action Taken' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Action Description' }), {
      target: { value: 'Cleaned the wireless card.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Result' }), {
      target: { value: 'Connection remained stable during testing.' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Follow-Up Required' }), {
      target: { value: 'yes' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Follow-Up Note' }), {
      target: { value: 'Check connection after one week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Action Taken' }));

    await waitFor(() => {
      const create = fetchMock.mock.calls.find(([input, init]) => (
        String(input) === '/api/staff/tickets/12/actions' && init?.method === 'POST'
      ));
      expect(create).toBeDefined();
      const headers = create?.[1]?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/i);
      const body = JSON.parse(String(create?.[1]?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        description: 'Cleaned the wireless card.',
        result: 'Connection remained stable during testing.',
        followUpRequired: true,
        followUpNote: 'Check connection after one week.',
      });
      expect(body).not.toHaveProperty('performedById');
      expect(body).not.toHaveProperty('ownerId');
      expect(body).not.toHaveProperty('ticketId');
      expect(body).not.toHaveProperty('followUpCompleted');
    });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => (
      String(input) === '/api/staff/tickets/12'
    )).length).toBeGreaterThan(1));
    expect(await screen.findByText('Cleaned the wireless card.')).toBeInTheDocument();
  });

  it('marks a required follow-up complete without clearing its requirement or original performer', async () => {
    const fetchMock = stubStaffDetailApi();
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Action Taken 31' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Follow-Up Completed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      const update = fetchMock.mock.calls.find(([input, init]) => (
        String(input) === '/api/staff/tickets/12/actions/31' && init?.method === 'PATCH'
      ));
      expect(update).toBeDefined();
      const body = JSON.parse(String(update?.[1]?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        expectedVersion: 1,
        followUpRequired: true,
        followUpCompleted: true,
        followUpNote: 'Check battery health next week.',
      });
      expect(body).not.toHaveProperty('performedById');
      expect(body).not.toHaveProperty('ownerId');
    });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => (
      String(input) === '/api/staff/tickets/12'
    )).length).toBeGreaterThan(1));
    const actions = screen.getByRole('region', { name: 'Actions Taken' });
    expect(within(actions).getByText('Follow-Up Required')).toBeInTheDocument();
    expect(within(actions).getByText('Follow-Up Completed')).toBeInTheDocument();
    expect(within(actions).getByText('Nicha Engineer')).toBeInTheDocument();
    expect(within(actions).getByText('Check battery health next week.')).toBeInTheDocument();
    expect(actions).toHaveTextContent('Yes');
  });

  it('requires a Follow-Up Note before submitting a required follow-up', async () => {
    const fetchMock = stubStaffDetailApi();
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Action Taken' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Action Description' }), {
      target: { value: 'Replaced the wireless card.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Result' }), {
      target: { value: 'Connection is stable.' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Follow-Up Required' }), {
      target: { value: 'yes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Action Taken' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Follow-Up Note is required');
    expect(screen.getByRole('textbox', { name: 'Action Description' })).toHaveValue('Replaced the wireless card.');
    expect(screen.getByRole('textbox', { name: 'Result' })).toHaveValue('Connection is stable.');
    expect(fetchMock.mock.calls.some(([input, init]) => (
      String(input) === '/api/staff/tickets/12/actions' && init?.method === 'POST'
    ))).toBe(false);
  });

  it('shows own Ticket actions to Requesters without write controls or editor metadata', async () => {
    stubRequesterDetailApi();
    setPath('/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Ticket Detail' });
    const actions = await screen.findByRole('region', { name: 'Actions Taken' });

    expect(within(actions).getByText('Replaced the damaged adapter.')).toBeInTheDocument();
    expect(within(actions).getByText('Nicha Engineer')).toBeInTheDocument();
    expect(within(actions).queryByText('Last edited by')).not.toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: /Add Action Taken|Edit Action Taken/ })).not.toBeInTheDocument();
    expect(within(actions).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('retains entered values after a safe server failure', async () => {
    stubStaffDetailApi({
      createFailure: { status: 500, body: { error: 'Unable to save the Action Taken record.', code: 'INTERNAL_ERROR' } },
    });
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Action Taken' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Action Description' }), {
      target: { value: 'Retained description after failure.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Result' }), {
      target: { value: 'Retained result after failure.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Action Taken' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save the Action Taken record.');
    expect(screen.getByRole('textbox', { name: 'Action Description' })).toHaveValue('Retained description after failure.');
    expect(screen.getByRole('textbox', { name: 'Result' })).toHaveValue('Retained result after failure.');
  });

  it.each(['RESOLVED', 'CLOSED', 'CANCELLED'])('keeps Actions Taken read-only when a Ticket is %s', async (currentStatus) => {
    const terminalDetail = {
      ticket: { ...detailResponse.ticket, currentStatus },
    };
    stubStaffDetailApi({ detail: terminalDetail });
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    const actions = await screen.findByRole('region', { name: 'Actions Taken' });

    expect(actions).toHaveTextContent(`read-only while this Ticket is ${currentStatus}`);
    expect(within(actions).queryByRole('button', { name: 'Add Action Taken' })).not.toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: /Edit Action Taken/ })).not.toBeInTheDocument();
    expect(within(actions).getByText('Replaced the damaged adapter.')).toBeInTheDocument();
  });

  it('preserves unsaved edits and offers an explicit reload after a stale Action Taken conflict', async () => {
    const fetchMock = stubStaffDetailApi({
      updateFailure: {
        status: 409,
        body: {
          error: 'This Action Taken changed since it was loaded. Reload and review the current values.',
          code: 'ACTION_TAKEN_VERSION_CONFLICT',
        },
      },
    });
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Action Taken 31' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Result' }), {
      target: { value: 'Unsaved result after stale conflict.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('changed since it was loaded');
    expect(screen.getByRole('textbox', { name: 'Result' })).toHaveValue('Unsaved result after stale conflict.');
    fireEvent.click(screen.getByRole('button', { name: 'Reload Ticket Detail' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => (
      String(input) === '/api/staff/tickets/12'
    )).length).toBeGreaterThan(1));
  });

  it('preserves values but locks an open form after the Ticket becomes terminal', async () => {
    stubStaffDetailApi({
      statusAfterUpdateFailure: 'RESOLVED',
      updateFailure: {
        status: 409,
        body: {
          error: 'Actions Taken are locked for this Ticket. Reopen it before editing.',
          code: 'ACTION_TAKEN_LOCKED',
        },
      },
    });
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Action Taken 31' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Result' }), {
      target: { value: 'Keep this unsaved result visible.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Actions Taken are locked for this Ticket');

    fireEvent.click(screen.getByRole('button', { name: 'Reload Ticket Detail' }));
    await waitFor(() => expect(screen.getByText(/Actions Taken are read-only while this Ticket is RESOLVED/)).toBeInTheDocument());

    expect(screen.getByRole('textbox', { name: 'Result' })).toHaveValue('Keep this unsaved result visible.');
    expect(screen.getByRole('textbox', { name: 'Result' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Actions Taken are locked for this Ticket');
  });

  it('allows Administrators to create and edit Actions Taken', async () => {
    stubStaffDetailApi({ user: administratorUser });
    setPath('/admin/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Administrator Ticket View' });
    const actions = await screen.findByRole('region', { name: 'Actions Taken' });
    expect(within(actions).getByRole('button', { name: 'Add Action Taken' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Edit Action Taken 31' })).toBeInTheDocument();
  });

  it('shows a useful empty state and still offers Add Action Taken on an active Ticket', async () => {
    const emptyDetail = {
      ticket: { ...detailResponse.ticket, actionsTaken: [] },
    };
    stubStaffDetailApi({ detail: emptyDetail });
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    const actions = await screen.findByRole('region', { name: 'Actions Taken' });
    expect(within(actions).getByText('No Actions Taken have been recorded yet.')).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Add Action Taken' })).toBeEnabled();
  });

  it('ignores repeated submit events while the create request is in progress', async () => {
    let resolveCreate!: (response: ReturnType<typeof jsonResponse>) => void;
    const createResponse = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = stubStaffDetailApi({ createResponse });
    setPath('/staff/tickets/12');
    render(<BrowserRouter><App /></BrowserRouter>);

    await screen.findByRole('heading', { name: 'Staff Ticket Detail' });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Action Taken' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Action Description' }), {
      target: { value: 'One action from two submit events.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Result' }), {
      target: { value: 'One row should be created.' },
    });
    const form = document.getElementById('actions-taken-form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving Action Taken...' })).toBeDisabled());
    expect(fetchMock.mock.calls.filter(([input, init]) => (
      String(input) === '/api/staff/tickets/12/actions' && init?.method === 'POST'
    ))).toHaveLength(1);
    resolveCreate(jsonResponse({
      actionTaken: {
        ...detailResponse.ticket.actionsTaken[0],
        id: 32,
        description: 'One action from two submit events.',
        result: 'One row should be created.',
        performedBy: { id: staffUser.id, name: staffUser.name, role: 'IT_STAFF' },
        followUpNote: null,
        attachmentNotes: null,
        createdAt: '2026-10-29T09:30:00.000Z',
        updatedAt: '2026-10-29T09:30:00.000Z',
        updatedBy: { id: staffUser.id, name: staffUser.name, role: 'IT_STAFF' },
      },
    }, true, 201));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving Action Taken...' })).not.toBeInTheDocument());
  });
});
