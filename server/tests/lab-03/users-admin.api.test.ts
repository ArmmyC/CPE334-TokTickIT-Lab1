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
  Object.assign(auth.database.user, { findMany, create });

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
