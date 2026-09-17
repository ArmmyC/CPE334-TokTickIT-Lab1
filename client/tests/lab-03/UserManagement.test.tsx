import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const administratorUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@example.test',
  role: 'ADMINISTRATOR',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
};

const requesterUser = {
  id: 2,
  name: 'Ariya Anderson',
  email: 'ariya@example.test',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
};

const staffUser = {
  id: 3,
  name: 'Somsak Staff',
  email: 'somsak@example.test',
  role: 'IT_STAFF',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
};

const users = [
  administratorUser,
  requesterUser,
  {
    ...staffUser,
    id: 4,
    name: 'Inactive Staff',
    email: 'inactive.staff@example.test',
    isActive: false,
  },
];

type MockResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
type ListResponder = (url: string, init?: RequestInit) => MockResponse | Promise<MockResponse>;
type MutationResponder = (url: string, init?: RequestInit) => MockResponse | Promise<MockResponse>;

function jsonResponse(body: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function installAdminUsersApi({
  user = administratorUser,
  listResponder = () => jsonResponse(users),
  mutationResponder = () => jsonResponse(users[0]),
}: {
  user?: typeof administratorUser | typeof requesterUser | typeof staffUser;
  listResponder?: ListResponder;
  mutationResponder?: MutationResponder;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse({ user, passwordChangeRequired: false }));
    }
    if (url.startsWith('/api/admin/users')) {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method !== 'GET') {
        return Promise.resolve(mutationResponder(url, init));
      }
      return Promise.resolve(listResponder(url, init));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderUserManagement(options?: Parameters<typeof installAdminUsersApi>[0]) {
  const fetchMock = installAdminUsersApi(options);
  setPath('/admin/users');
  render(<BrowserRouter><App /></BrowserRouter>);
  return fetchMock;
}

async function openCreateUserForm(options?: Parameters<typeof installAdminUsersApi>[0]) {
  const fetchMock = await renderUserManagement(options);
  await screen.findByText('Admin User');
  fireEvent.click(screen.getByRole('button', { name: 'Add User' }));
  expect(await screen.findByRole('heading', { name: 'Create User' })).toBeInTheDocument();
  return fetchMock;
}

async function openEditUserForm(
  userName = 'Ariya Anderson',
  options?: Parameters<typeof installAdminUsersApi>[0],
) {
  const fetchMock = await renderUserManagement(options);
  fireEvent.click(await screen.findByRole('button', { name: `Edit ${userName}` }));
  expect(await screen.findByRole('heading', { name: 'Edit User' })).toBeInTheDocument();
  return fetchMock;
}

function mutationCalls(fetchMock: ReturnType<typeof installAdminUsersApi>) {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET').toUpperCase() !== 'GET');
}

function requestBody(call: [RequestInfo | URL, RequestInit?]) {
  return JSON.parse(String(call[1]?.body));
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/admin/users');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 3 Administrator User Management screen', () => {
  it('shows Administrator navigation and the protected list route', async () => {
    await renderUserManagement();

    expect(await screen.findByRole('heading', { name: 'User Management' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'User Management' })).toHaveAttribute('href', '/admin/users');
    expect(screen.queryByRole('link', { name: 'Ticket Queue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument();
  });

  it.each([
    ['Requester', requesterUser],
    ['IT Staff', staffUser],
  ])('keeps the User Management route unavailable to %s accounts', async (_role, user) => {
    const fetchMock = await renderUserManagement({ user });

    expect(await screen.findByText(/Administrator access is required/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/api/admin/users'))).toBe(false);
    expect(screen.queryByRole('link', { name: 'User Management' })).not.toBeInTheDocument();
  });

  it('shows loading state and then the required safe User fields and Edit actions', async () => {
    let resolveList: ((response: MockResponse) => void) | undefined;
    const fetchMock = await renderUserManagement({
      listResponder: () => new Promise<MockResponse>((resolve) => {
        resolveList = resolve;
      }),
    });

    expect(await screen.findByRole('heading', { name: 'User Management' })).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Loading Users...');
    await waitFor(() => expect(resolveList).toBeDefined());
    resolveList?.(jsonResponse(users));

    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    for (const heading of ['Name', 'Email', 'Role', 'Status', 'Edit']) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getAllByText('admin@example.test').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Ariya Anderson' })).toBeInTheDocument();
    expect(screen.queryByText(/passwordHash|toktickit_session|initial password/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/admin/users'))).toBe(true);
  });

  it('sends only the search and optional role filter, and clears both filters', async () => {
    const fetchMock = await renderUserManagement();
    await screen.findByText('Admin User');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Users' }), {
      target: { value: 'ari' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'REQUESTER' },
    });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(urls.some((url) => (
        url.includes('/api/admin/users?')
        && url.includes('search=ari')
        && url.includes('role=REQUESTER')
      ))).toBe(true);
    });
    expect(screen.getByRole('searchbox', { name: 'Search Users' })).toHaveValue('ari');
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('REQUESTER');

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(urls.some((url) => url.endsWith('/api/admin/users'))).toBe(true);
    });
    expect(screen.getByRole('searchbox', { name: 'Search Users' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('');
  });

  it('distinguishes an empty User list from filtered no-results', async () => {
    await renderUserManagement({ listResponder: () => jsonResponse([]) });
    expect(await screen.findByText(/No Users have been created yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Users' }), {
      target: { value: 'printer' },
    });
    expect(await screen.findByText(/No Users match your search or filters/i)).toBeInTheDocument();
  });

  it.each([
    [401, 'AUTHENTICATION_REQUIRED', /session has expired/i],
    [403, 'FORBIDDEN', /do not have permission/i],
    [500, 'UNEXPECTED_ERROR', /Unable to load User Management/i],
  ])('shows a safe state for a %s User list response', async (status, code, message) => {
    const fetchMock = await renderUserManagement({
      listResponder: () => jsonResponse({
        error: status === 500 ? 'Unable to load administrator users.' : 'Request failed.',
        code,
      }, status),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    if (status === 401) {
      expect(screen.getByRole('link', { name: 'Sign in again' })).toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    }
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/api/admin/users'))).toBe(true);
  });
});

describe('Lab 3 Administrator User Management create mode', () => {
  it('opens a create form with the required User fields', async () => {
    await openCreateUserForm();

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByLabelText('Initial Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Initial Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('rejects missing create values before making a network mutation', async () => {
    const fetchMock = await openCreateUserForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Role is required.')).toBeInTheDocument();
    expect(screen.getByText('Active state is required.')).toBeInTheDocument();
    expect(screen.getByText('Initial password is required.')).toBeInTheDocument();
    expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
    expect(mutationCalls(fetchMock)).toHaveLength(0);
  });

  it('rejects invalid email, password, and confirmation values before submission', async () => {
    const fetchMock = await openCreateUserForm();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'REQUESTER' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Active' }), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirm Initial Password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    expect(await screen.findByText('A valid email address is required.')).toBeInTheDocument();
    expect(screen.getByText(/Password must be at least 12 characters long/i)).toBeInTheDocument();
    expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
    expect(mutationCalls(fetchMock)).toHaveLength(0);
  });

  it('posts the normalized create body and returns to the list with success feedback', async () => {
    const createdUser = {
      ...requesterUser,
      id: 5,
      name: 'New User',
      email: 'new.user@example.test',
      createdAt: '2026-09-17T01:00:00.000Z',
      updatedAt: '2026-09-17T01:00:00.000Z',
    };
    const fetchMock = await openCreateUserForm({
      mutationResponder: (url, init) => {
        expect(url).toBe('/api/admin/users');
        expect(init?.method).toBe('POST');
        return jsonResponse(createdUser, 201);
      },
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  New User  ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  NEW.USER@EXAMPLE.TEST ' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'REQUESTER' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Active' }), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm Initial Password'), { target: { value: 'Initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

    expect(await screen.findByText(/User created successfully/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'User Management' })).toBeInTheDocument();
    const calls = mutationCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(requestBody(calls[0])).toEqual({
      name: 'New User',
      email: 'new.user@example.test',
      role: 'REQUESTER',
      isActive: true,
      initialPassword: 'Initial-password1!',
    });
  });
});

describe('Lab 3 Administrator User Management edit mode', () => {
  it('loads a User into edit mode and sends only changed profile fields', async () => {
    const updatedUser = {
      ...requesterUser,
      name: 'Ariya Renamed',
      role: 'IT_STAFF',
      isActive: false,
      updatedAt: '2026-09-17T02:00:00.000Z',
    };
    const fetchMock = await openEditUserForm('Ariya Anderson', {
      mutationResponder: (url, init) => {
        expect(url).toBe('/api/admin/users/2');
        expect(init?.method).toBe('PATCH');
        return jsonResponse(updatedUser);
      },
    });

    expect(screen.getByLabelText('Name')).toHaveValue('Ariya Anderson');
    expect(screen.getByLabelText('Email')).toHaveValue('ariya@example.test');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ariya Renamed' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'IT_STAFF' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Active' }), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    expect(await screen.findByText(/User updated successfully/i)).toBeInTheDocument();
    const calls = mutationCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(requestBody(calls[0])).toEqual({
      name: 'Ariya Renamed',
      role: 'IT_STAFF',
      isActive: false,
    });
  });

  it.each([
    [409, 'A User with that email already exists.'],
    [403, 'You do not have permission to manage Users.'],
    [500, 'Unable to update User.'],
  ])('preserves entered values after a safe %s profile failure', async (status, message) => {
    const fetchMock = await openEditUserForm('Ariya Anderson', {
      mutationResponder: () => jsonResponse({ error: message, code: status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : 'UNEXPECTED_ERROR' }, status),
    });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'changed@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Email')).toHaveValue('changed@example.test');
    expect(mutationCalls(fetchMock)).toHaveLength(1);
  });

  it('shows the backend self-deactivation conflict in edit mode', async () => {
    const fetchMock = await openEditUserForm('Admin User', {
      mutationResponder: () => jsonResponse({
        error: 'You cannot deactivate your own account.',
        code: 'CONFLICT',
      }, 409),
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Active' }), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot deactivate your own account/i);
    expect(screen.getByRole('combobox', { name: 'Active' })).toHaveValue('false');
    expect(mutationCalls(fetchMock)).toHaveLength(1);
  });
});

describe('Lab 3 Administrator User Management initial-password mode', () => {
  it('submits a separate initial-password request and confirms the next-login change requirement', async () => {
    const resetUser = {
      ...requesterUser,
      mustChangePassword: true,
      updatedAt: '2026-09-17T03:00:00.000Z',
    };
    const fetchMock = await openEditUserForm('Ariya Anderson', {
      mutationResponder: (url, init) => {
        expect(url).toBe('/api/admin/users/2/initial-password');
        expect(init?.method).toBe('POST');
        return jsonResponse(resetUser);
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Set New Initial Password' }));
    expect(screen.getByLabelText('New Initial Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Initial Password')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New Initial Password'), { target: { value: 'New-initial-password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Initial Password'), { target: { value: 'New-initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Initial Password' }));

    expect(await screen.findByText(/Initial password updated/i)).toBeInTheDocument();
    expect(screen.getByText(/must change the password at the next login/i)).toBeInTheDocument();
    const calls = mutationCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(requestBody(calls[0])).toEqual({ initialPassword: 'New-initial-password1!' });
  });

  it('rejects an invalid replacement password before calling the reset endpoint', async () => {
    const fetchMock = await openEditUserForm('Ariya Anderson');
    fireEvent.click(screen.getByRole('button', { name: 'Set New Initial Password' }));
    fireEvent.change(screen.getByLabelText('New Initial Password'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirm New Initial Password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Initial Password' }));

    expect(await screen.findByText(/Password must be at least 12 characters long/i)).toBeInTheDocument();
    expect(mutationCalls(fetchMock)).toHaveLength(0);
  });

  it('keeps profile and password-reset saving controls independent', async () => {
    let resolveMutation: ((response: MockResponse) => void) | undefined;
    const fetchMock = await openEditUserForm('Ariya Anderson', {
      mutationResponder: () => new Promise<MockResponse>((resolve) => {
        resolveMutation = resolve;
      }),
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ariya Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));
    expect(await screen.findByRole('button', { name: 'Saving User...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Set New Initial Password' })).toBeEnabled();
    await act(async () => {
      resolveMutation?.(jsonResponse(requesterUser));
      await Promise.resolve();
    });
    await screen.findByRole('heading', { name: 'User Management' });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Ariya Anderson' }));
    await screen.findByRole('heading', { name: 'Edit User' });

    fireEvent.click(screen.getByRole('button', { name: 'Set New Initial Password' }));
    fireEvent.change(screen.getByLabelText('New Initial Password'), { target: { value: 'New-initial-password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Initial Password'), { target: { value: 'New-initial-password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Initial Password' }));
    expect(await screen.findByRole('button', { name: 'Setting Initial Password...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save User' })).toBeEnabled();
    await act(async () => {
      resolveMutation?.(jsonResponse(requesterUser));
      await Promise.resolve();
    });
    expect(mutationCalls(fetchMock)).toHaveLength(2);
  });
});
