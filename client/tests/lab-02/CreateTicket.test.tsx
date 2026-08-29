import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const requesters = [
  { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
  { id: 2, name: 'Narin Chai', email: 'narin@example.test' },
];

const categories = [
  { id: 2, name: 'Hardware' },
  { id: 3, name: 'Software' },
];

const relatedSystems = [
  { id: 4, name: 'Corporate Laptop' },
  { id: 5, name: 'VPN' },
];

const createdTicket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  ticketDate: '2026-08-21T09:00:00.000Z',
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 4,
  summary: 'Laptop battery drains quickly',
  description: 'The battery drains while the laptop is idle.',
  requestedPriority: 'MEDIUM',
  itPriority: null,
  currentStatus: 'NEW',
  createdAt: '2026-08-21T09:00:00.000Z',
  updatedAt: '2026-08-21T09:00:00.000Z',
};

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function stubCreateTicketApi(
  ticketResponse: { ok: boolean; json: () => Promise<unknown> } = {
    ok: true,
    json: async () => ({ ticket: createdTicket }),
  },
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/development-requesters')) {
      return Promise.resolve({ ok: true, json: async () => requesters });
    }
    if (url.endsWith('/categories')) {
      return Promise.resolve({ ok: true, json: async () => categories });
    }
    if (url.endsWith('/related-systems')) {
      return Promise.resolve({ ok: true, json: async () => relatedSystems });
    }
    if (url.endsWith('/tickets') && init?.method === 'POST') {
      return Promise.resolve(ticketResponse);
    }
    if (url.includes('/attachments') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          attachment: {
            id: 9,
            ticketId: 42,
            originalName: 'evidence.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 4,
            uploadedAt: '2026-08-21T09:00:00.000Z',
            removedAt: null,
            removalReason: null,
            downloadAvailable: true,
          },
        }),
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderCreateTicket() {
  sessionStorage.setItem('toktickit.developmentRequesterId', '1');
  setPath('/tickets/new');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Create Ticket' })).toBeInTheDocument();
  await screen.findByRole('combobox', { name: 'Category' });
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/select-requester');
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 2 requester selection and shell context', () => {
  it('shows a loading state while active requesters are loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(screen.getByRole('status')).toHaveTextContent(/Loading Development Requesters/i);
  });

  it('selects an active requester, persists the context, and opens the shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => requesters }),
    );

    render(<BrowserRouter><App /></BrowserRouter>);

    const select = await screen.findByRole('combobox', { name: /Development Requester/i });
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();
    expect(screen.queryByText('Mali Boonmee')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: '2' } });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(screen.getAllByText('Narin Chai').length).toBeGreaterThan(0);
    expect(sessionStorage.getItem('toktickit.developmentRequesterId')).toBe('2');
  });

  it('shows an empty state and can retry to load active requesters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => requesters });
    vi.stubGlobal('fetch', fetchMock);

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent(/No active Development Requesters/i);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('combobox', { name: /Development Requester/i })).toBeInTheDocument();
  });

  it('shows an API failure with a retry action', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load Development Requesters/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('guards ticket routes when no valid requester context exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => requesters }));
    setPath('/tickets');

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: /Select a Development Requester/i })).toBeInTheDocument();
  });

  it('clears an invalid stored requester id before allowing ticket routes', async () => {
    sessionStorage.setItem('toktickit.developmentRequesterId', '999');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => requesters }));
    setPath('/tickets');

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: /Select a Development Requester/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('toktickit.developmentRequesterId')).toBeNull();
  });

  it('clears the old context when Change Requester is selected', async () => {
    sessionStorage.setItem('toktickit.developmentRequesterId', '1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => requesters }));
    setPath('/tickets');

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change Requester' }));

    expect(await screen.findByRole('heading', { name: /Select a Development Requester/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('toktickit.developmentRequesterId')).toBeNull();
  });
});

describe('Lab 2 Create Ticket screen', () => {
  it('loads active reference data and shows the selected requester as read-only context', async () => {
    stubCreateTicketApi();
    await renderCreateTicket();

    expect(screen.getByLabelText('Development Requester')).toHaveValue('Ariya Anderson');
    expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Corporate Laptop' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Requested Priority' })).toHaveValue('MEDIUM');
  });

  it('shows field-level validation and does not call the create API for blank fields', async () => {
    const fetchMock = stubCreateTicketApi();
    await renderCreateTicket();

    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    expect(await screen.findByText(/Summary must be between 5 and 120 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Description must be between 10 and 4000 characters/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith('/tickets') && init?.method === 'POST')).toBe(false);
  });

  it('creates a ticket with trimmed values and displays the backend Ticket Number', async () => {
    const fetchMock = stubCreateTicketApi();
    await renderCreateTicket();

    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Related System' }), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: '  Laptop battery drains quickly  ' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '  The battery drains while the laptop is idle.  ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith('/tickets') && init?.method === 'POST');
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 4,
      summary: 'Laptop battery drains quickly',
      description: 'The battery drains while the laptop is idle.',
      requestedPriority: 'MEDIUM',
    });
  });

  it('rejects invalid attachments and preserves form values after a create API failure', async () => {
    const fetchMock = stubCreateTicketApi({
      ok: false,
      json: async () => ({ error: 'Unable to create the Ticket.' }),
    });
    await renderCreateTicket();

    const validFile = new File(['pdf'], 'evidence.pdf', { type: 'application/pdf' });
    const invalidFile = new File(['script'], 'malware.exe', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByLabelText('Attachments'), { target: { files: [validFile, invalidFile] } });
    expect(await screen.findByText(/malware\.exe.*not supported/i)).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf.*3 B/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence.pdf' }));
    expect(screen.queryByText('evidence.pdf')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Related System' }), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Laptop battery drains quickly' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'The battery drains while the laptop is idle.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to create the Ticket/i);
    expect(screen.getByLabelText('Summary')).toHaveValue('Laptop battery drains quickly');
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith('/tickets') && init?.method === 'POST')).toBe(true);
  });

  it('keeps the success result and reports each failed initial upload', async () => {
    let uploadCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/development-requesters')) return Promise.resolve({ ok: true, json: async () => requesters });
      if (url.endsWith('/categories')) return Promise.resolve({ ok: true, json: async () => categories });
      if (url.endsWith('/related-systems')) return Promise.resolve({ ok: true, json: async () => relatedSystems });
      if (url.endsWith('/tickets') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ ticket: createdTicket }) });
      if (url.includes('/attachments') && init?.method === 'POST') {
        uploadCount += 1;
        if (uploadCount === 1) return Promise.reject(new Error('connection reset'));
        return Promise.resolve({ ok: true, json: async () => ({ attachment: { id: 10 } }) });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    await renderCreateTicket();

    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Related System' }), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'Laptop battery drains quickly' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'The battery drains while the laptop is idle.' } });
    fireEvent.change(screen.getByLabelText('Attachments'), {
      target: {
        files: [
          new File(['first'], 'first.pdf', { type: 'application/pdf' }),
          new File(['second'], 'second.pdf', { type: 'application/pdf' }),
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Ticket' }));

    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument();
    expect(screen.getByText(/first\.pdf: Unable to upload this attachment/i)).toBeInTheDocument();
    expect(uploadCount).toBe(2);
  });
});
