import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  { id: 5, name: 'VPN' },
  { id: 7, name: 'Corporate Laptop' },
];
const ticket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  ticketDate: '2026-08-21T10:00:00.000Z',
  summary: 'Laptop battery drains quickly',
  category: { id: 2, name: 'Hardware' },
  relatedSystem: { id: 7, name: 'Corporate Laptop' },
  requestedPriority: 'MEDIUM',
  itPriority: null,
  currentStatus: 'NEW',
  updatedAt: '2026-08-21T10:00:00.000Z',
};

const listResponse = (overrides: Partial<Record<string, unknown>> = {}) => ({
  items: [ticket],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
  ...overrides,
});

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function stubMyTicketsApi(
  response: { ok: boolean; json: () => Promise<unknown> } = {
    ok: true,
    json: async () => listResponse(),
  },
) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/development-requesters')) return Promise.resolve({ ok: true, json: async () => requesters });
    if (url.endsWith('/categories')) return Promise.resolve({ ok: true, json: async () => categories });
    if (url.endsWith('/related-systems')) return Promise.resolve({ ok: true, json: async () => relatedSystems });
    if (url.includes('/tickets?') || url.endsWith('/tickets')) return Promise.resolve(response);
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderMyTickets() {
  sessionStorage.setItem('toktickit.developmentRequesterId', '1');
  setPath('/tickets');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
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

describe('Lab 2 My Tickets screen', () => {
  it('shows loading, owned ticket data, required controls, and a Create Ticket action', async () => {
    let resolveTickets: ((response: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/development-requesters')) return Promise.resolve({ ok: true, json: async () => requesters });
      if (url.endsWith('/categories')) return Promise.resolve({ ok: true, json: async () => categories });
      if (url.endsWith('/related-systems')) return Promise.resolve({ ok: true, json: async () => relatedSystems });
      if (url.includes('/tickets?')) return new Promise((resolve) => { resolveTickets = resolve; });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    await renderMyTickets();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading Tickets/i);
    resolveTickets?.({ ok: true, json: async () => listResponse() });
    expect((await screen.findAllByText('TKT-2026-000042')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Laptop battery drains quickly').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hardware').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Corporate Laptop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NEW').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Create Ticket' })[0]).toHaveAttribute('href', '/tickets/new');
    expect(screen.getAllByRole('link', { name: /View Ticket/i })[0]).toHaveAttribute('href', '/tickets/42');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('requesterId=1'))).toBe(true);
  });

  it('shows the requester empty state and distinguishes a filtered no-results state', async () => {
    const fetchMock = stubMyTicketsApi({ ok: true, json: async () => listResponse({ items: [], totalItems: 0, totalPages: 0 }) });
    await renderMyTickets();
    expect(await screen.findByText(/No Tickets yet for this Requester/i)).toBeInTheDocument();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/development-requesters')) return Promise.resolve({ ok: true, json: async () => requesters });
      if (url.endsWith('/categories')) return Promise.resolve({ ok: true, json: async () => categories });
      if (url.endsWith('/related-systems')) return Promise.resolve({ ok: true, json: async () => relatedSystems });
      if (url.includes('/tickets?')) return Promise.resolve({ ok: true, json: async () => listResponse({ items: [], totalItems: 0, totalPages: 0 }) });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    fireEvent.change(screen.getByRole('searchbox', { name: /Search Tickets/i }), { target: { value: 'printer' } });
    expect(await screen.findByText(/No Tickets match your search or filters/i)).toBeInTheDocument();
  });

  it('sends filter and sort changes with requester context and resets to page one', async () => {
    const fetchMock = stubMyTicketsApi();
    await renderMyTickets();
    await screen.findAllByText('TKT-2026-000042');

    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort By' }), { target: { value: 'ticketNumber' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort Order' }), { target: { value: 'asc' } });
    fireEvent.change(screen.getByRole('searchbox', { name: /Search Tickets/i }), { target: { value: 'battery' } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls.some((url) => url.includes('requesterId=1') && url.includes('categoryId=2') && url.includes('search=battery') && url.includes('sortBy=ticketNumber') && url.includes('sortOrder=asc') && url.includes('page=1'))).toBe(true);
    });
  });

  it('supports clear filters, pagination, and a safe retryable API error', async () => {
    const fetchMock = stubMyTicketsApi({ ok: false, json: async () => ({ error: 'Unable to load Tickets.' }) });
    await renderMyTickets();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load Tickets/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    vi.unstubAllGlobals();
    const loadedFetch = stubMyTicketsApi({ ok: true, json: async () => listResponse({ page: 2, totalItems: 21, totalPages: 3, hasNext: true, hasPrevious: true }) });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findAllByText(/Page 2 of 3/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(loadedFetch.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('');
  });
});
