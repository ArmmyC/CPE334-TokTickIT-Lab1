import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const activeRequester = {
  id: 1,
  name: 'Ariya Anderson',
  email: 'ariya@example.test',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: false,
};

const activeStaff = {
  ...activeRequester,
  id: 3,
  name: 'Somchai Rattanakul',
  email: 'somchai@example.test',
  role: 'IT_STAFF',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function installAuthFetch(options: {
  loginBody?: unknown;
  loginStatus?: number;
  meBody?: unknown;
  meStatus?: number;
  logoutResponse?: Promise<Response> | Response;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return Promise.resolve(jsonResponse(
        options.meBody ?? { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' },
        options.meStatus ?? 401,
      ));
    }
    if (url === '/api/auth/login') {
      return Promise.resolve(jsonResponse(
        options.loginBody ?? { user: activeRequester, passwordChangeRequired: false },
        options.loginStatus ?? 200,
      ));
    }
    if (url === '/api/auth/logout') {
      return Promise.resolve(options.logoutResponse ?? jsonResponse(null, 204));
    }
    if (url === '/api/categories') {
      return Promise.resolve(jsonResponse([{ id: 2, name: 'Hardware' }]));
    }
    if (url === '/api/related-systems') {
      return Promise.resolve(jsonResponse([{ id: 3, name: 'VPN' }]));
    }
    if (url.startsWith('/api/tickets')) {
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

async function renderLogin() {
  setPath('/login');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Sign in to TokTickIT' })).toBeInTheDocument();
}

beforeEach(() => {
  document.cookie = 'toktickit_csrf=test-csrf';
  setPath('/login');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'toktickit_csrf=; Max-Age=0';
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 3 Login screen', () => {
  it('validates email and password before submitting', async () => {
    const fetchMock = installAuthFetch();
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('A valid email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/login')).toBe(false);
  });

  it('shows a generic safe failure for invalid or inactive accounts', async () => {
    installAuthFetch({
      loginStatus: 401,
      loginBody: { error: 'Email or password is incorrect.', code: 'AUTHENTICATION_FAILED' },
    });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mali@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.queryByText(/inactive/i)).not.toBeInTheDocument();
  });

  it('routes an initial-password user to Change Password before normal destinations', async () => {
    installAuthFetch({
      loginBody: {
        user: { ...activeRequester, mustChangePassword: true },
        passwordChangeRequired: true,
      },
    });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ariya@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Change your password' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument();
  });

  it('shows the authenticated identity and only permitted Requester navigation', async () => {
    const fetchMock = installAuthFetch();
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ariya@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(screen.getAllByText('Ariya Anderson').length).toBeGreaterThan(0);
    expect(screen.getByText('Requester')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Tickets' })).toHaveAttribute('href', '/tickets');
    expect(screen.getAllByRole('link', { name: 'Create Ticket' }).some((link) => link.getAttribute('href') === '/tickets/new')).toBe(true);
    expect(screen.queryByText(/Development Requester/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change Requester/i })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('toktickit.developmentRequesterId')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('requesterId='))).toBe(false);
  });

  it('shows a non-Requester role in the shell without exposing Requester destinations', async () => {
    installAuthFetch({ loginBody: { user: activeStaff, passwordChangeRequired: false } });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'somchai@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Somchai Rattanakul' })).toBeInTheDocument();
    expect(screen.getByText('IT Staff')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument();
  });

  it('logs out, clears the shell, and blocks protected access', async () => {
    const fetchMock = installAuthFetch();
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ariya@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to TokTickIT' })).toBeInTheDocument();
    const logoutCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/auth/logout');
    expect(logoutCall?.[1]?.headers).toEqual(expect.objectContaining({ 'X-CSRF-Token': 'test-csrf' }));
    expect(screen.queryByRole('heading', { name: 'My Tickets' })).not.toBeInTheDocument();
  });

  it('shows a busy state while login is pending', async () => {
    let resolveLogin!: (response: Response) => void;
    const fetchMock = installAuthFetch();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/auth/me') return Promise.resolve(jsonResponse({ error: 'Authentication is required.' }, 401));
      if (String(input) === '/api/auth/login') return new Promise((resolve) => { resolveLogin = resolve; });
      return Promise.resolve(jsonResponse({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNext: false, hasPrevious: false }));
    });
    await renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ariya@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    resolveLogin(jsonResponse({ user: activeRequester, passwordChangeRequired: false }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My Tickets' })).toBeInTheDocument());
  });
});
