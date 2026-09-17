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
  Object.assign(auth.database.user, { findMany });

  const database = withAuthDatabase({
    category: {
      findMany: vi.fn(),
    },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database),
    findMany,
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
