import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AuthUserRecord } from '../../src/auth/types.js';
import {
  createAuthTestHarness,
  withAuthDatabase,
} from './auth-test-harness.js';

async function createAdminUsersHarness() {
  const auth = await createAuthTestHarness([
    { role: 'ADMINISTRATOR' },
    { role: 'REQUESTER' },
    { role: 'IT_STAFF' },
  ]);
  const findMany = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const count = vi.fn();
  const originalSessionUpdateMany = auth.database.session.updateMany;
  const updateMany = vi.fn((args: Parameters<typeof originalSessionUpdateMany>[0]) => (
    originalSessionUpdateMany(args)
  ));
  Object.assign(auth.database.user, { findMany, create, update, count });
  Object.assign(auth.database.session, { updateMany });

  const database = withAuthDatabase({
    category: {
      findMany: vi.fn(),
    },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database),
    findMany,
    create,
    update,
    count,
    updateMany,
  };
}

function safeUser(user: AuthUserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

describe('Lab 3 Administrator User Management list API', () => {
  it('returns a direct safe User array with trimmed search, role filtering, and stable ordering', async () => {
    const harness = await createAdminUsersHarness();
    const requester = harness.users.get(2)!;
    requester.mustChangePassword = true;
    harness.findMany.mockResolvedValue([requester]);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .get('/api/admin/users')
      .query({ search: '  ari  ', role: 'REQUESTER' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([safeUser(requester)]);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('toktickit_session');
    expect(harness.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'ari', mode: 'insensitive' } },
          { email: { contains: 'ari', mode: 'insensitive' } },
        ],
        role: 'REQUESTER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('returns all safe Users for a blank search and preserves the documented order contract', async () => {
    const harness = await createAdminUsersHarness();
    const users = [...harness.users.values()];
    harness.findMany.mockResolvedValue(users);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .get('/api/admin/users')
      .query({ search: '   ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(users.map(safeUser));
    expect(harness.findMany).toHaveBeenCalledWith({
      where: {},
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it.each([
    ['invalid role', { role: 'SUPPORT' }, 'role'],
    ['overlong search', { search: 'x'.repeat(121) }, 'search'],
  ])('rejects %s before reading User data', async (_caseName, query, field) => {
    const harness = await createAdminUsersHarness();
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .get('/api/admin/users')
      .query(query);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { [field]: expect.any(String) },
    });
    expect(harness.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication and restricts listing to Administrators', async () => {
    const harness = await createAdminUsersHarness();

    const unauthenticated = await request(harness.app).get('/api/admin/users');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });

    const requester = await harness.login(harness.app, 'mali@example.test');
    const requesterResponse = await requester.agent.get('/api/admin/users');
    expect(requesterResponse.status).toBe(403);
    expect(requesterResponse.body.code).toBe('FORBIDDEN');

    const staff = await harness.login(harness.app, 'somsak@example.test');
    const staffResponse = await staff.agent.get('/api/admin/users');
    expect(staffResponse.status).toBe(403);
    expect(staffResponse.body.code).toBe('FORBIDDEN');
    expect(harness.findMany).not.toHaveBeenCalled();
  });

  it('returns a safe 500 response when User listing fails unexpectedly', async () => {
    const harness = await createAdminUsersHarness();
    harness.findMany.mockRejectedValue(new Error('database unavailable'));
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent.get('/api/admin/users');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Unable to list administrator users.',
      code: 'UNEXPECTED_ERROR',
    });
    expect(JSON.stringify(response.body)).not.toContain('database unavailable');
  });
});

describe('Lab 3 Administrator User Management creation API', () => {
  it('creates one User with a normalized email, hashed initial password, and forced password change', async () => {
    const harness = await createAdminUsersHarness();
    const createdUser: AuthUserRecord = {
      id: 4,
      name: 'New Requester',
      email: 'new.requester@example.test',
      passwordHash: 'scrypt$v1$N=32768,r=8,p=1$hashed$placeholder',
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date('2026-09-17T01:00:00.000Z'),
      updatedAt: new Date('2026-09-17T01:00:00.000Z'),
    };
    harness.create.mockResolvedValue(createdUser);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users')
      .set('x-csrf-token', administrator.csrfToken)
      .send({
        name: '  New Requester  ',
        email: '  New.Requester@Example.Test ',
        role: 'REQUESTER',
        isActive: true,
        initialPassword: 'Initial-password1!',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(safeUser(createdUser));
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('Initial-password1!');
    expect(harness.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'New Requester',
        email: 'new.requester@example.test',
        role: 'REQUESTER',
        isActive: true,
        mustChangePassword: true,
        passwordHash: expect.any(String),
      }),
    });
    const createData = harness.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(createData.passwordHash).not.toBe('Initial-password1!');
  });

  it.each([
    ['missing name', { email: 'new@example.test', role: 'REQUESTER', isActive: true, initialPassword: 'Initial-password1!' }, 'name'],
    ['blank name', { name: '   ', email: 'new@example.test', role: 'REQUESTER', isActive: true, initialPassword: 'Initial-password1!' }, 'name'],
    ['invalid email', { name: 'New User', email: 'not-an-email', role: 'REQUESTER', isActive: true, initialPassword: 'Initial-password1!' }, 'email'],
    ['invalid role', { name: 'New User', email: 'new@example.test', role: 'SUPPORT', isActive: true, initialPassword: 'Initial-password1!' }, 'role'],
    ['non-boolean activation state', { name: 'New User', email: 'new@example.test', role: 'REQUESTER', isActive: 'yes', initialPassword: 'Initial-password1!' }, 'isActive'],
    ['missing initial password', { name: 'New User', email: 'new@example.test', role: 'REQUESTER', isActive: true }, 'initialPassword'],
    ['invalid initial password', { name: 'New User', email: 'new@example.test', role: 'REQUESTER', isActive: true, initialPassword: 'weak' }, 'initialPassword'],
  ])('rejects %s before creating a User', async (_caseName, payload, field) => {
    const harness = await createAdminUsersHarness();
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users')
      .set('x-csrf-token', administrator.csrfToken)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { [field]: expect.any(String) },
    });
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('rejects unknown creation fields with a safe validation response', async () => {
    const harness = await createAdminUsersHarness();
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users')
      .set('x-csrf-token', administrator.csrfToken)
      .send({
        name: 'New User',
        email: 'new@example.test',
        role: 'REQUESTER',
        isActive: true,
        initialPassword: 'Initial-password1!',
        passwordHash: 'client-controlled',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate normalized email without creating a User', async () => {
    const harness = await createAdminUsersHarness();
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users')
      .set('x-csrf-token', administrator.csrfToken)
      .send({
        name: 'Duplicate User',
        email: '  ARIYA@EXAMPLE.TEST ',
        role: 'REQUESTER',
        isActive: true,
        initialPassword: 'Initial-password1!',
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('requires CSRF protection for User creation', async () => {
    const harness = await createAdminUsersHarness();
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users')
      .send({
        name: 'New User',
        email: 'new@example.test',
        role: 'REQUESTER',
        isActive: true,
        initialPassword: 'Initial-password1!',
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_VALIDATION_FAILED');
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('returns a safe validation response for malformed JSON', async () => {
    const harness = await createAdminUsersHarness();
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users')
      .set('content-type', 'application/json')
      .set('x-csrf-token', administrator.csrfToken)
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid JSON request.');
    expect(harness.create).not.toHaveBeenCalled();
  });
});

function enableUserUpdateMock(harness: Awaited<ReturnType<typeof createAdminUsersHarness>>) {
  harness.update.mockImplementation(async ({
    where,
    data,
  }: {
    where: { id: number };
    data: Partial<Pick<
      AuthUserRecord,
      'name' | 'email' | 'role' | 'isActive' | 'passwordHash' | 'mustChangePassword'
    >>;
  }) => {
    const user = harness.users.get(where.id);
    if (!user) {
      throw new Error('user not found');
    }
    Object.assign(user, data, { updatedAt: new Date('2026-09-17T02:00:00.000Z') });
    return structuredClone(user);
  });
}

function addSecondActiveAdministrator(harness: Awaited<ReturnType<typeof createAdminUsersHarness>>) {
  const administrator = harness.users.get(1)!;
  harness.users.set(4, {
    ...structuredClone(administrator),
    id: 4,
    name: 'Narin Administrator',
    email: 'narin@example.test',
    role: 'ADMINISTRATOR',
  });
}

describe('Lab 3 Administrator User Management edit API', () => {
  it('edits the permitted profile fields and returns the safe updated User', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    harness.count.mockResolvedValue(1);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .patch('/api/admin/users/2')
      .set('x-csrf-token', administrator.csrfToken)
      .send({
        name: '  Mali Updated  ',
        email: '  MALI.UPDATED@EXAMPLE.TEST ',
        role: 'IT_STAFF',
        isActive: false,
      });

    const expectedUser = harness.users.get(2)!;
    expect(response.status).toBe(200);
    expect(response.body).toEqual(safeUser(expectedUser));
    expect(harness.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        name: 'Mali Updated',
        email: 'mali.updated@example.test',
        role: 'IT_STAFF',
        isActive: false,
      },
    });
  });

  it('accepts a partial edit without changing password state or Ticket history', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .patch('/api/admin/users/2')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ name: 'Mali Renamed' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Mali Renamed');
    expect(response.body.email).toBe('mali@example.test');
    expect(response.body.mustChangePassword).toBe(false);
    expect(harness.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { name: 'Mali Renamed' },
    });
  });

  it.each([
    ['malformed id', 'not-a-number', { name: 'Updated' }, 'userId'],
    ['non-positive id', '0', { name: 'Updated' }, 'userId'],
    ['invalid role', '2', { role: 'SUPPORT' }, 'role'],
    ['invalid activation state', '2', { isActive: 'yes' }, 'isActive'],
    ['unknown field', '2', { passwordHash: 'client-controlled' }, 'passwordHash'],
    ['empty patch', '2', {}, 'form'],
  ])('rejects %s before updating a User', async (_caseName, userId, payload, field) => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .patch(`/api/admin/users/${userId}`)
      .set('x-csrf-token', administrator.csrfToken)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { [field]: expect.any(String) },
    });
    expect(harness.update).not.toHaveBeenCalled();
  });

  it('rejects a duplicate normalized email and a missing target safely', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const duplicate = await administrator.agent
      .patch('/api/admin/users/2')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ email: '  ARIYA@EXAMPLE.TEST ' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('CONFLICT');
    expect(harness.update).not.toHaveBeenCalled();

    const missing = await administrator.agent
      .patch('/api/admin/users/999')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ name: 'Missing User' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: 'User not found.',
      code: 'USER_NOT_FOUND',
    });
    expect(harness.update).not.toHaveBeenCalled();
  });

  it('requires CSRF protection for User edits', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .patch('/api/admin/users/2')
      .send({ name: 'Updated' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_VALIDATION_FAILED');
    expect(harness.update).not.toHaveBeenCalled();
  });

  it('rejects Administrator self-deactivation', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    harness.count.mockResolvedValue(1);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .patch('/api/admin/users/1')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
    expect(harness.update).not.toHaveBeenCalled();
  });

  it('does not allow deactivation or role removal for the last active Administrator', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    harness.count.mockResolvedValue(1);
    const administrator = await harness.login(harness.app);

    const deactivation = await administrator.agent
      .patch('/api/admin/users/1')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ isActive: false });
    expect(deactivation.status).toBe(409);
    expect(deactivation.body.code).toBe('CONFLICT');

    const roleChange = await administrator.agent
      .patch('/api/admin/users/1')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ role: 'IT_STAFF' });
    expect(roleChange.status).toBe(409);
    expect(roleChange.body.code).toBe('CONFLICT');
    expect(harness.update).not.toHaveBeenCalled();
  });

  it('allows changes to a non-last Administrator and does not falsely conflict for a safe active edit', async () => {
    const harness = await createAdminUsersHarness();
    addSecondActiveAdministrator(harness);
    enableUserUpdateMock(harness);
    harness.count.mockResolvedValue(2);
    const administrator = await harness.login(harness.app);

    const roleChange = await administrator.agent
      .patch('/api/admin/users/4')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ role: 'IT_STAFF' });
    expect(roleChange.status).toBe(200);
    expect(roleChange.body.role).toBe('IT_STAFF');

    const activeEdit = await administrator.agent
      .patch('/api/admin/users/1')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ name: 'Administrator Renamed' });
    expect(activeEdit.status).toBe(200);
    expect(activeEdit.body.name).toBe('Administrator Renamed');
    expect(harness.update).toHaveBeenCalledTimes(2);
  });

  it('allows deactivation of a non-Administrator User', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .patch('/api/admin/users/2')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
  });
});

describe('Lab 3 Administrator User Management initial-password API', () => {
  it('sets a new hashed initial password, forces the next change, and revokes every target session', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);
    const targetSessionOne = await harness.login(harness.app, 'mali@example.test');
    const targetSessionTwo = await harness.login(harness.app, 'mali@example.test');
    const target = harness.users.get(2)!;
    const previousHash = target.passwordHash;
    const newPassword = 'New-initial-password1!';

    const response = await administrator.agent
      .post('/api/admin/users/2/initial-password')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ initialPassword: newPassword });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(safeUser(target));
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(newPassword);
    expect(target.passwordHash).not.toBe(previousHash);
    expect(target.passwordHash).not.toBe(newPassword);
    expect(target.mustChangePassword).toBe(true);
    expect(harness.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        passwordHash: expect.any(String),
        mustChangePassword: true,
      },
    });
    expect(harness.updateMany).toHaveBeenCalledWith({
      where: { userId: 2 },
      data: { revokedAt: expect.any(Date) },
    });
    const targetSessions = [...harness.sessions.values()].filter((session) => session.userId === 2);
    expect(targetSessions).toHaveLength(2);
    expect(targetSessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    const administratorSession = [...harness.sessions.values()].find((session) => session.userId === 1);
    expect(administratorSession?.revokedAt).toBeNull();
    expect(targetSessionOne.agent).toBeDefined();
    expect(targetSessionTwo.agent).toBeDefined();
  });

  it.each([
    ['malformed id', 'not-a-number', { initialPassword: 'New-initial-password1!' }, 'userId'],
    ['non-positive id', '0', { initialPassword: 'New-initial-password1!' }, 'userId'],
    ['missing password', '2', {}, 'initialPassword'],
    ['invalid password', '2', { initialPassword: 'weak' }, 'initialPassword'],
  ])('rejects %s without changing User credentials or sessions', async (_caseName, userId, payload, field) => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);
    await harness.login(harness.app, 'mali@example.test');
    const target = harness.users.get(2)!;
    const previousHash = target.passwordHash;
    const previousMustChangePassword = target.mustChangePassword;
    const previousSessions = [...harness.sessions.values()]
      .filter((session) => session.userId === 2)
      .map((session) => ({ id: session.id, revokedAt: session.revokedAt }));

    const response = await administrator.agent
      .post(`/api/admin/users/${userId}/initial-password`)
      .set('x-csrf-token', administrator.csrfToken)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { [field]: expect.any(String) },
    });
    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.updateMany).not.toHaveBeenCalled();
    expect(target.passwordHash).toBe(previousHash);
    expect(target.mustChangePassword).toBe(previousMustChangePassword);
    expect([...harness.sessions.values()]
      .filter((session) => session.userId === 2)
      .map((session) => ({ id: session.id, revokedAt: session.revokedAt })))
      .toEqual(previousSessions);
  });

  it('returns a safe not-found response for a missing target User', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users/999/initial-password')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ initialPassword: 'New-initial-password1!' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'User not found.',
      code: 'USER_NOT_FOUND',
    });
    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.updateMany).not.toHaveBeenCalled();
  });

  it('requires CSRF and Administrator authorization for initial-password changes', async () => {
    const harness = await createAdminUsersHarness();
    enableUserUpdateMock(harness);
    const administrator = await harness.login(harness.app);

    const csrfFailure = await administrator.agent
      .post('/api/admin/users/2/initial-password')
      .send({ initialPassword: 'New-initial-password1!' });
    expect(csrfFailure.status).toBe(403);
    expect(csrfFailure.body.code).toBe('CSRF_VALIDATION_FAILED');

    const requester = await harness.login(harness.app, 'mali@example.test');
    const forbidden = await requester.agent
      .post('/api/admin/users/2/initial-password')
      .set('x-csrf-token', requester.csrfToken)
      .send({ initialPassword: 'New-initial-password1!' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const unauthenticated = await request(harness.app)
      .post('/api/admin/users/2/initial-password')
      .send({ initialPassword: 'New-initial-password1!' });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.code).toBe('AUTHENTICATION_REQUIRED');
    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.updateMany).not.toHaveBeenCalled();
  });

  it('returns a safe 500 response when the credential update fails unexpectedly', async () => {
    const harness = await createAdminUsersHarness();
    harness.update.mockRejectedValue(new Error('database unavailable'));
    const administrator = await harness.login(harness.app);

    const response = await administrator.agent
      .post('/api/admin/users/2/initial-password')
      .set('x-csrf-token', administrator.csrfToken)
      .send({ initialPassword: 'New-initial-password1!' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Unable to set administrator initial password.',
      code: 'UNEXPECTED_ERROR',
    });
    expect(JSON.stringify(response.body)).not.toContain('database unavailable');
    expect(harness.updateMany).not.toHaveBeenCalled();
  });
});
