import { FormEvent, useEffect, useRef, useState } from 'react';
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

type ListState = 'loading' | 'ready' | 'error';
type FormMode = 'list' | 'create' | 'edit';
type SavingAction = 'create' | 'update' | 'initial-password' | null;

type FormValues = {
  name: string;
  email: string;
  role: ManagedUserRole | '';
  isActive: 'true' | 'false' | '';
  initialPassword: string;
  confirmInitialPassword: string;
  newInitialPassword: string;
  confirmNewInitialPassword: string;
};

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

const EMPTY_FORM: FormValues = {
  name: '',
  email: '',
  role: '',
  isActive: '',
  initialPassword: '',
  confirmInitialPassword: '',
  newInitialPassword: '',
  confirmNewInitialPassword: '',
};

const ROLE_OPTIONS: Array<[ManagedUserRole, string]> = [
  ['REQUESTER', 'Requester'],
  ['IT_STAFF', 'IT Staff'],
  ['ADMINISTRATOR', 'Administrator'],
];

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
  if (search.trim()) params.set('search', search.trim());
  if (role) params.set('role', role);
  const query = params.toString();
  return query ? `/api/admin/users?${query}` : '/api/admin/users';
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

function validatePassword(value: string): string | null {
  if (value.length < 12) return 'Password must be at least 12 characters long.';
  if (value.length > 128) return 'Password must be no more than 128 characters long.';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one number.';
  if (!/[^\p{L}\p{N}\s]/u.test(value)) return 'Password must contain at least one symbol.';
  return null;
}

async function requestUsers(search: string, role: ManagedUserRole | ''): Promise<ManagedUser[]> {
  const response = await apiFetch(buildListUrl(search, role));
  const rawBody = await readJson(response);
  const body = isApiErrorBody(rawBody) ? rawBody : null;
  if (!response.ok) {
    throw new UserRequestError(apiErrorMessage(body, 'Unable to load User Management.'), response.status, body);
  }
  if (!Array.isArray(rawBody) || !rawBody.every(isManagedUser)) {
    throw new UserRequestError('Unable to load User Management.', response.status, body);
  }
  return rawBody;
}

async function requestMutation(path: string, init: RequestInit, fallback: string): Promise<ManagedUser> {
  const response = await apiFetch(path, init);
  const rawBody = await readJson(response);
  const body = isApiErrorBody(rawBody) ? rawBody : null;
  if (!response.ok) {
    throw new UserRequestError(apiErrorMessage(body, fallback), response.status, body);
  }
  if (!isManagedUser(rawBody)) {
    throw new UserRequestError(fallback, response.status, body);
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

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="field-error">{message}</p> : null;
}

function userFormValues(user: ManagedUser): FormValues {
  return {
    ...EMPTY_FORM,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive ? 'true' : 'false',
  };
}

export function UserManagementPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<ManagedUserRole | ''>('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [listError, setListError] = useState<UserRequestError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [mode, setMode] = useState<FormMode>('list');
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    pageHeadingRef.current?.focus();
    if (mode === 'list') {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [mode]);

  const hasFilters = Boolean(search.trim() || role);

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormAlert(null);
  };

  const openCreate = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode('create');
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormAlert(null);
    setPasswordFeedback(null);
    setPasswordResetOpen(false);
    setNotice(null);
  };

  const openEdit = (user: ManagedUser) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode('edit');
    setEditingUser(user);
    setForm(userFormValues(user));
    setFieldErrors({});
    setFormAlert(null);
    setPasswordFeedback(null);
    setPasswordResetOpen(false);
    setNotice(null);
  };

  const cancelForm = () => {
    setMode('list');
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormAlert(null);
    setPasswordFeedback(null);
    setPasswordResetOpen(false);
  };

  const clearFilters = () => {
    setSearch('');
    setRole('');
  };

  const validateCreateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';
    if (!form.email.trim()) errors.email = 'Email is required.';
    else if (!normalizeEmail(form.email)) errors.email = 'A valid email address is required.';
    if (!form.role) errors.role = 'Role is required.';
    else if (!isManagedUserRole(form.role)) errors.role = 'Role is invalid.';
    if (!form.isActive) errors.isActive = 'Active state is required.';
    if (!form.initialPassword) errors.initialPassword = 'Initial password is required.';
    else {
      const passwordError = validatePassword(form.initialPassword);
      if (passwordError) errors.initialPassword = passwordError;
    }
    if (!form.confirmInitialPassword || form.confirmInitialPassword !== form.initialPassword) errors.confirmInitialPassword = 'Passwords must match.';
    return errors;
  };

  const validateEditForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';
    if (!form.email.trim()) errors.email = 'Email is required.';
    else if (!normalizeEmail(form.email)) errors.email = 'A valid email address is required.';
    if (!form.role || !isManagedUserRole(form.role)) errors.role = 'Role is required.';
    if (!form.isActive) errors.isActive = 'Active state is required.';
    return errors;
  };

  const setMutationFailure = (error: unknown, fallback: string) => {
    const requestError = error instanceof UserRequestError
      ? error
      : new UserRequestError(fallback, 0, null);
    setFieldErrors(requestError.body?.fieldErrors ?? {});
    setFormAlert(requestError.message || fallback);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingAction || mode !== 'create') return;
    const errors = validateCreateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormAlert('Please correct the highlighted fields.');
      return;
    }
    setSavingAction('create');
    setFieldErrors({});
    setFormAlert(null);
    try {
      const createdUser = await requestMutation('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: normalizeEmail(form.email),
          role: form.role,
          isActive: form.isActive === 'true',
          initialPassword: form.initialPassword,
        }),
      }, 'Unable to create User.');
      setUsers((current) => [createdUser, ...current.filter((user) => user.id !== createdUser.id)]);
      setMode('list');
      setEditingUser(null);
      setForm(EMPTY_FORM);
      setNotice('User created successfully.');
      setPasswordResetOpen(false);
    } catch (error: unknown) {
      setMutationFailure(error, 'Unable to create User.');
    } finally {
      setSavingAction(null);
    }
  };

  const submitUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingAction || mode !== 'edit' || !editingUser) return;
    const errors = validateEditForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormAlert('Please correct the highlighted fields.');
      return;
    }
    const changes: Partial<Pick<ManagedUser, 'name' | 'email' | 'role' | 'isActive'>> = {};
    const name = form.name.trim();
    const email = normalizeEmail(form.email) as string;
    const isActive = form.isActive === 'true';
    if (name !== editingUser.name) changes.name = name;
    if (email !== editingUser.email) changes.email = email;
    if (form.role !== editingUser.role) changes.role = form.role as ManagedUserRole;
    if (isActive !== editingUser.isActive) changes.isActive = isActive;
    if (Object.keys(changes).length === 0) {
      setFormAlert('Change at least one User field before saving.');
      return;
    }
    setSavingAction('update');
    setFieldErrors({});
    setFormAlert(null);
    try {
      const updatedUser = await requestMutation(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }, 'Unable to update User.');
      setUsers((current) => current.map((user) => user.id === updatedUser.id ? updatedUser : user));
      setMode('list');
      setEditingUser(null);
      setForm(EMPTY_FORM);
      setNotice('User updated successfully.');
      setPasswordResetOpen(false);
    } catch (error: unknown) {
      setMutationFailure(error, 'Unable to update User.');
    } finally {
      setSavingAction(null);
    }
  };

  const submitPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingAction || !editingUser) return;
    const errors: Record<string, string> = {};
    if (!form.newInitialPassword) errors.newInitialPassword = 'New initial password is required.';
    else {
      const passwordError = validatePassword(form.newInitialPassword);
      if (passwordError) errors.newInitialPassword = passwordError;
    }
    if (!form.confirmNewInitialPassword || form.confirmNewInitialPassword !== form.newInitialPassword) errors.confirmNewInitialPassword = 'Passwords must match.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormAlert('Please correct the highlighted fields.');
      return;
    }
    setSavingAction('initial-password');
    setFieldErrors({});
    setFormAlert(null);
    try {
      const updatedUser = await requestMutation(`/api/admin/users/${editingUser.id}/initial-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPassword: form.newInitialPassword }),
      }, 'Unable to set the initial password.');
      setUsers((current) => current.map((user) => user.id === updatedUser.id ? updatedUser : user));
      setEditingUser(updatedUser);
      setPasswordResetOpen(false);
      setForm((current) => ({ ...current, newInitialPassword: '', confirmNewInitialPassword: '' }));
      setPasswordFeedback('Initial password updated. This User must change the password at the next login.');
    } catch (error: unknown) {
      setMutationFailure(error, 'Unable to set the initial password.');
    } finally {
      setSavingAction(null);
    }
  };

  if (mode !== 'list') {
    const isCreate = mode === 'create';
    return (
      <section className="admin-users-page admin-users-form-page" aria-labelledby="admin-user-form-title">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">TokTickIT / Lab 3</p>
            <h1 id="admin-user-form-title" tabIndex={-1} ref={pageHeadingRef}>{isCreate ? 'Create User' : 'Edit User'}</h1>
            <p className="text-secondary mb-0">{isCreate ? 'Add one service-desk account with a controlled initial password.' : `Update ${editingUser?.name ?? 'this User'} without changing Ticket history.`}</p>
          </div>
        </div>
        {formAlert && <div role="alert" className="state-message state-message-error">{formAlert}</div>}
        {passwordFeedback && <div role="status" className="state-message state-message-success">{passwordFeedback}</div>}

        <form className="admin-user-form" onSubmit={isCreate ? submitCreate : submitUpdate} noValidate aria-busy={savingAction === 'create' || savingAction === 'update'}>
          <div className="admin-user-form-grid">
            <div className="ticket-field">
              <label className="required-label" htmlFor="admin-user-name">Name</label>
              <input id="admin-user-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby="admin-user-name-error" />
              <FieldError id="admin-user-name-error" message={fieldErrors.name} />
            </div>
            <div className="ticket-field">
              <label className="required-label" htmlFor="admin-user-email">Email</label>
              <input id="admin-user-email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} aria-invalid={Boolean(fieldErrors.email)} aria-describedby="admin-user-email-error" />
              <FieldError id="admin-user-email-error" message={fieldErrors.email} />
            </div>
            <div className="ticket-field">
              <label className="required-label" htmlFor="admin-user-form-role">Role</label>
              <select id="admin-user-form-role" value={form.role} onChange={(event) => updateForm('role', event.target.value as ManagedUserRole | '')} aria-invalid={Boolean(fieldErrors.role)} aria-describedby="admin-user-form-role-error">
                <option value="">Select a role</option>
                {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <FieldError id="admin-user-form-role-error" message={fieldErrors.role} />
            </div>
            <div className="ticket-field">
              <label className="required-label" htmlFor="admin-user-active">Active</label>
              <select id="admin-user-active" value={form.isActive} onChange={(event) => updateForm('isActive', event.target.value as FormValues['isActive'])} aria-invalid={Boolean(fieldErrors.isActive)} aria-describedby="admin-user-active-error">
                <option value="">Select active state</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <FieldError id="admin-user-active-error" message={fieldErrors.isActive} />
            </div>
            {isCreate && (
              <>
                <div className="ticket-field">
                  <label className="required-label" htmlFor="admin-user-initial-password">Initial Password</label>
                  <input id="admin-user-initial-password" type="password" value={form.initialPassword} onChange={(event) => updateForm('initialPassword', event.target.value)} aria-invalid={Boolean(fieldErrors.initialPassword)} aria-describedby="admin-user-initial-password-error admin-user-password-rules" />
                  <FieldError id="admin-user-initial-password-error" message={fieldErrors.initialPassword} />
                </div>
                <div className="ticket-field">
                  <label className="required-label" htmlFor="admin-user-confirm-initial-password">Confirm Initial Password</label>
                  <input id="admin-user-confirm-initial-password" type="password" value={form.confirmInitialPassword} onChange={(event) => updateForm('confirmInitialPassword', event.target.value)} aria-invalid={Boolean(fieldErrors.confirmInitialPassword)} aria-describedby="admin-user-confirm-initial-password-error" />
                  <FieldError id="admin-user-confirm-initial-password-error" message={fieldErrors.confirmInitialPassword} />
                </div>
                <div id="admin-user-password-rules" className="password-rules admin-user-password-rules" role="note">
                  <strong>Password rules</strong>
                  <p>Use 12 to 128 characters with an uppercase letter, lowercase letter, number, and symbol.</p>
                </div>
              </>
            )}
          </div>

          <div className="action-row">
            <button type="submit" className="btn btn-primary" disabled={isCreate ? savingAction === 'create' : savingAction === 'update'}>
              {isCreate ? (savingAction === 'create' ? 'Creating User...' : 'Create User') : (savingAction === 'update' ? 'Saving User...' : 'Save User')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancel</button>
            </div>
        </form>

        {!isCreate && (
          <section className="admin-user-password-section" aria-labelledby="admin-user-password-title">
            <h2 id="admin-user-password-title">Initial password</h2>
            <p className="text-secondary">Set a new initial password to revoke existing sessions and require a password change at the next login.</p>
            {!passwordResetOpen ? (
              <button type="button" className="btn btn-secondary" onClick={() => { setPasswordResetOpen(true); setFormAlert(null); setFieldErrors({}); setPasswordFeedback(null); }}>
                Set New Initial Password
              </button>
            ) : (
              <form className="admin-user-password-form" onSubmit={submitPasswordReset} noValidate aria-busy={savingAction === 'initial-password'}>
                <div className="admin-user-form-grid">
                  <div className="ticket-field">
                    <label className="required-label" htmlFor="admin-user-new-initial-password">New Initial Password</label>
                    <input id="admin-user-new-initial-password" type="password" value={form.newInitialPassword} onChange={(event) => updateForm('newInitialPassword', event.target.value)} aria-invalid={Boolean(fieldErrors.newInitialPassword)} aria-describedby="admin-user-new-initial-password-error admin-user-reset-password-rules" />
                    <FieldError id="admin-user-new-initial-password-error" message={fieldErrors.newInitialPassword} />
                  </div>
                  <div className="ticket-field">
                    <label className="required-label" htmlFor="admin-user-confirm-new-initial-password">Confirm New Initial Password</label>
                    <input id="admin-user-confirm-new-initial-password" type="password" value={form.confirmNewInitialPassword} onChange={(event) => updateForm('confirmNewInitialPassword', event.target.value)} aria-invalid={Boolean(fieldErrors.confirmNewInitialPassword)} aria-describedby="admin-user-confirm-new-initial-password-error" />
                    <FieldError id="admin-user-confirm-new-initial-password-error" message={fieldErrors.confirmNewInitialPassword} />
                  </div>
                </div>
                <div id="admin-user-reset-password-rules" className="password-rules admin-user-password-rules" role="note">
                  <strong>Password rules</strong>
                  <p>Use 12 to 128 characters with an uppercase letter, lowercase letter, number, and symbol.</p>
                </div>
                <div className="action-row">
                  <button type="submit" className="btn btn-primary" disabled={savingAction === 'initial-password'}>
                    {savingAction === 'initial-password' ? 'Setting Initial Password...' : 'Set Initial Password'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setPasswordResetOpen(false); setFieldErrors({}); setFormAlert(null); }} disabled={savingAction === 'initial-password'}>Cancel Password Reset</button>
                </div>
              </form>
            )}
          </section>
        )}
      </section>
    );
  }

  return (
    <section className="admin-users-page" aria-labelledby="admin-users-title">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">TokTickIT / Lab 3</p>
          <h1 id="admin-users-title" tabIndex={-1} ref={pageHeadingRef}>User Management</h1>
          <p className="text-secondary mb-0">Maintain service-desk accounts and access safely.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add User</button>
      </div>
      {notice && <div role="status" className="state-message state-message-success">{notice}</div>}
      <div className="admin-users-filter-panel" aria-label="User Management filters">
        <div className="admin-users-filter-grid">
          <div className="ticket-field">
            <label htmlFor="admin-user-search">Search Users</label>
            <input id="admin-user-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setNotice(null); }} placeholder="Name or email" />
          </div>
          <div className="ticket-field">
            <label htmlFor="admin-user-role">Role</label>
            <select id="admin-user-role" value={role} onChange={(event) => { setRole(event.target.value as ManagedUserRole | ''); setNotice(null); }}>
              <option value="">All Roles</option>
              {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="action-row admin-users-filter-actions">
          <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={!hasFilters}>Clear Filters</button>
        </div>
      </div>
      {listState === 'loading' && <p role="status" className="state-message" aria-busy="true">Loading Users...</p>}
      {listState === 'error' && (
        <div role="alert" className="state-message state-message-error">
          <p>{listError?.status === 401 ? 'Your session has expired.' : listError?.status === 403 ? 'You do not have permission to manage Users.' : 'Unable to load User Management. Try again.'}</p>
          {listError?.status === 401 ? <a className="btn btn-secondary" href="/login">Sign in again</a> : <button type="button" className="btn btn-secondary" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>}
        </div>
      )}
      {listState === 'ready' && users.length === 0 && <p className="state-message">{hasFilters ? 'No Users match your search or filters.' : 'No Users have been created yet.'}</p>}
      {listState === 'ready' && users.length > 0 && <UserList users={users} onEdit={openEdit} />}
    </section>
  );
}
