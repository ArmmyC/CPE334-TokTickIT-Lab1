import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const restrictedRequester = {
  id: 1,
  name: 'Ariya Anderson',
  email: 'ariya@example.test',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: true,
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

function installChangePasswordFetch(changeResponse: Response = jsonResponse({
  user: { ...restrictedRequester, mustChangePassword: false },
  passwordChangeRequired: false,
})) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/me') return Promise.resolve(jsonResponse({ user: restrictedRequester, passwordChangeRequired: true }));
    if (url === '/api/auth/change-password') return Promise.resolve(changeResponse);
    if (url === '/api/categories') return Promise.resolve(jsonResponse([{ id: 2, name: 'Hardware' }]));
    if (url === '/api/related-systems') return Promise.resolve(jsonResponse([{ id: 3, name: 'VPN' }]));
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

async function renderChangePassword() {
  setPath('/change-password');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Change your password' })).toBeInTheDocument();
}

beforeEach(() => {
  document.cookie = 'toktickit_csrf=test-csrf';
  setPath('/change-password');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'toktickit_csrf=; Max-Age=0';
  setPath('/');
});

describe('Lab 3 Change Password screen', () => {
  it('shows password rules and validates boundary and confirmation errors', async () => {
    const fetchMock = installChangePasswordFetch();
    await renderChangePassword();

    expect(screen.getByText(/12 to 128 characters/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByText('Current password is required.')).toBeInTheDocument();
    expect(screen.getByText('New password is required.')).toBeInTheDocument();
    expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/change-password')).toBe(false);
  });

  it('changes the password and continues to the authenticated Requester destination', async () => {
    const fetchMock = installChangePasswordFetch();
    await renderChangePassword();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Initial-password1!' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'New-strong-password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'New-strong-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    const changeCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/auth/change-password');
    expect(changeCall?.[1]?.headers).toEqual(expect.objectContaining({ 'X-CSRF-Token': 'test-csrf' }));
    expect(JSON.parse(String(changeCall?.[1]?.body))).toEqual({
      currentPassword: 'Initial-password1!',
      newPassword: 'New-strong-password1!',
      confirmPassword: 'New-strong-password1!',
    });
  });

  it('accepts a hyphen as the only non-alphanumeric password character', async () => {
    const fetchMock = installChangePasswordFetch();
    await renderChangePassword();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Initial-password1!' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Aaaaaaaa111-' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Aaaaaaaa111-' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/auth/change-password')).toBe(true);
  });

  it('shows safe failure feedback and clears password fields after a rejected change', async () => {
    installChangePasswordFetch(jsonResponse({
      error: 'Current password is incorrect.',
      code: 'PASSWORD_CHANGE_FAILED',
    }, 401));
    await renderChangePassword();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Wrong-password1!' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'New-strong-password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'New-strong-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.');
    await waitFor(() => {
      expect(screen.getByLabelText('Current password')).toHaveValue('');
      expect(screen.getByLabelText('New password')).toHaveValue('');
      expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    });
  });
});
