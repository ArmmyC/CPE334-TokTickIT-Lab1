import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const requesters = [
  { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
  { id: 2, name: 'Narin Chai', email: 'narin@example.test' },
];

const detailResponse = {
  ticket: {
    id: 42,
    ticketNumber: 'TKT-2026-000042',
    ticketDate: '2026-08-21T10:00:00.000Z',
    requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
    category: { id: 2, name: 'Hardware' },
    relatedSystem: { id: 7, name: 'Corporate Laptop' },
    summary: 'Laptop battery drains quickly',
    description: 'The battery drains while the laptop is idle.',
    requestedPriority: 'MEDIUM',
    itPriority: null,
    currentStatus: 'NEW',
    createdAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T10:00:00.000Z',
  },
  attachments: [
    {
      id: 7,
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12000,
      uploadedAt: '2026-08-21T10:00:00.000Z',
      removedAt: null,
      removalReason: null,
      downloadAvailable: true,
    },
    {
      id: 8,
      originalName: 'old-screenshot.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      uploadedAt: '2026-08-21T10:00:00.000Z',
      removedAt: '2026-08-21T11:00:00.000Z',
      removalReason: 'Uploaded the wrong document',
      downloadAvailable: false,
    },
  ],
};

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function stubDetailApi(
  detail: { ok: boolean; json: () => Promise<unknown> } = {
    ok: true,
    json: async () => detailResponse,
  },
) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/development-requesters')) {
      return Promise.resolve({ ok: true, json: async () => requesters });
    }
    if (url.startsWith('/api/tickets/42')) {
      return Promise.resolve(detail);
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderDetail() {
  sessionStorage.setItem('toktickit.developmentRequesterId', '1');
  setPath('/tickets/42');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Ticket Detail' })).toBeInTheDocument();
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/select-requester');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 2 Ticket Detail screen', () => {
  it('loads owned Ticket data as read-only and shows active and removed attachment metadata', async () => {
    const fetchMock = stubDetailApi();

    await renderDetail();

    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument();
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument();
    expect(screen.getByText('The battery drains while the laptop is idle.')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
    expect(screen.getByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.getByText('old-screenshot.png')).toBeInTheDocument();
    expect(screen.getByText('Removed', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to My Tickets' })).toHaveAttribute('href', '/tickets');
    expect(screen.queryByRole('textbox', { name: /Summary/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/tickets/42?requesterId=1')).toBe(true);
  });

  it('announces loading and then renders the owned detail after the request resolves', async () => {
    let resolveDetail: ((response: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/development-requesters')) {
        return Promise.resolve({ ok: true, json: async () => requesters });
      }
      if (url.startsWith('/api/tickets/42')) {
        return new Promise((resolve) => { resolveDetail = resolve; });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    await renderDetail();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading Ticket Detail/i);

    resolveDetail?.({ ok: true, json: async () => detailResponse });
    expect(await screen.findByText('TKT-2026-000042')).toBeInTheDocument();
  });

  it('shows a safe not-found/API failure state with retry', async () => {
    const fetchMock = stubDetailApi({ ok: false, json: async () => ({ error: 'Ticket not found.' }) });

    await renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ticket not found/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/development-requesters')) {
        return Promise.resolve({ ok: true, json: async () => requesters });
      }
      if (url.startsWith('/api/tickets/42')) {
        return Promise.resolve({ ok: true, json: async () => detailResponse });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText('TKT-2026-000042')).toBeInTheDocument());
  });
});
