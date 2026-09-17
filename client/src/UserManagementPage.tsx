import { useEffect, useState } from 'react';
import { apiErrorMessage, apiFetch, isApiErrorBody, readJson, type ApiErrorBody } from './api';

export type ManagedUserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: ManagedUserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListState = 'idle' | 'loading' | 'ready' | 'error';

class UserRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    super(message);
    this.name = 'UserRequestError';
  }
}

function isManagedUserRole(value: unknown): value is ManagedUserRole {
  return value === 'REQUESTER' || value === 'IT_STAFF' || value === 'ADMINISTRATOR';
}

function isManagedUser(value: unknown): value is ManagedUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<ManagedUser>;
  return Number.isSafeInteger(candidate.id) && (candidate.id ?? 0) > 0
    && typeof candidate.name === 'string'
    && typeof candidate.email === 'string'
    && isManagedUserRole(candidate.role)
    && typeof candidate.isActive === 'boolean'
    && typeof candidate.mustChangePassword === 'boolean'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string';
}

function buildListUrl(search: string, role: ManagedUserRole | ''): string {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set('search', search.trim());
  }
  if (role) {
    params.set('role', role);
  }
  const query = params.toString();
  return query ? `/api/admin/users?${query}` : '/api/admin/users';
}

async function requestUsers(search: string, role: ManagedUserRole | ''): Promise<ManagedUser[]> {
  const response = await apiFetch(buildListUrl(search, role));
  const rawBody = await readJson(response);
  const body = isApiErrorBody(rawBody) ? rawBody : null;
  if (!response.ok) {
    throw new UserRequestError(
      apiErrorMessage(body, 'Unable to load User Management.'),
      response.status,
      body,
    );
  }
  if (!Array.isArray(rawBody) || !rawBody.every(isManagedUser)) {
    throw new UserRequestError('Unable to load User Management.', response.status, body);
  }
  return rawBody;
}

function userRoleLabel(role: ManagedUserRole): string {
  return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester';
}

function UserList({ users, onEdit }: { users: ManagedUser[]; onEdit: (user: ManagedUser) => void }) {
  return (
    <div className="admin-users-table-view admin-users-card-view">
      <table className="admin-users-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Edit</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="Name">{user.name}</td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Role"><span className="role-badge admin-user-role-badge">{userRoleLabel(user.role)}</span></td>
              <td data-label="Status"><span className={user.isActive ? 'user-status-badge user-status-active' : 'user-status-badge user-status-inactive'}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
              <td data-label="Edit">
                <button type="button" className="btn btn-secondary" onClick={() => onEdit(user)} aria-label={`Edit ${user.name}`}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserManagementPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<ManagedUserRole | ''>('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [listError, setListError] = useState<UserRequestError | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setListState('loading');
    setListError(null);
    void requestUsers(search, role)
      .then((nextUsers) => {
        if (cancelled) return;
        setUsers(nextUsers);
        setListState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const requestError = error instanceof UserRequestError
          ? error
          : new UserRequestError('Unable to load User Management.', 0, null);
        setListError(requestError);
        setListState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [role, retryKey, search]);

  const hasFilters = Boolean(search.trim() || role);
  const clearFilters = () => {
    setSearch('');
    setRole('');
  };

  return (
    <section className="admin-users-page" aria-labelledby="admin-users-title">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 3</p>
          <h1 id="admin-users-title">User Management</h1>
          <p className="text-secondary mb-0">Maintain service-desk accounts and access safely.</p>
        </div>
        <button type="button" className="btn btn-primary">Add User</button>
      </div>

      <div className="admin-users-filter-panel" aria-label="User Management filters">
        <div className="admin-users-filter-grid">
          <div className="ticket-field">
            <label htmlFor="admin-user-search">Search Users</label>
            <input
              id="admin-user-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
            />
          </div>
          <div className="ticket-field">
            <label htmlFor="admin-user-role">Role</label>
            <select id="admin-user-role" value={role} onChange={(event) => setRole(event.target.value as ManagedUserRole | '')}>
              <option value="">All Roles</option>
              <option value="REQUESTER">Requester</option>
              <option value="IT_STAFF">IT Staff</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </div>
        </div>
        <div className="action-row admin-users-filter-actions">
          <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={!hasFilters}>Clear Filters</button>
        </div>
      </div>

      {listState === 'loading' && (
        <p role="status" className="state-message" aria-busy="true">Loading Users...</p>
      )}

      {listState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{listError?.status === 401 ? 'Your session has expired.' : listError?.status === 403 ? 'You do not have permission to manage Users.' : 'Unable to load User Management. Try again.'}</p>
          {listError?.status === 401 ? (
            <a className="btn btn-secondary" href="/login">Sign in again</a>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
          )}
        </div>
      )}

      {listState === 'ready' && users.length === 0 && (
        <p className="state-message">{hasFilters ? 'No Users match your search or filters.' : 'No Users have been created yet.'}</p>
      )}

      {listState === 'ready' && users.length > 0 && (
        <UserList users={users} onEdit={() => undefined} />
      )}
    </section>
  );
}
