import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const requesters = [
  { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
  { id: 2, name: 'Narin Chai', email: 'narin@example.test' },
];

function setPath(path: string) {
  window.history.pushState({}, '', path);
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
    expect(screen.getByText('Narin Chai')).toBeInTheDocument();
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
