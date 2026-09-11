import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type ApplicationApiDatabase } from '../../src/app.js';
import { hashPassword, validatePassword, verifyPassword } from '../../src/auth/password.js';

type User = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type Session = {
  id: string;
  tokenHash: string;
  csrfTokenHash: string;
  userId: number;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function createAuthHarness() {
  const passwordHash = await hashPassword('Initial-password1!');
  const now = new Date('2026-09-12T00:00:00.000Z');
  const users = new Map<number, User>([
    [1, {
      id: 1,
      name: 'Ariya Anderson',
      email: 'ariya@example.test',
      passwordHash,
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    }],
    [2, {
      id: 2,
      name: 'Mali Boonmee',
      email: 'mali@example.test',
      passwordHash,
      role: 'REQUESTER',
      isActive: false,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    }],
  ]);
  const sessions = new Map<string, Session>();

  const database = {
    user: {
      findUnique: async ({ where }: { where: { id?: number; email?: string } }) => {
        const user = where.id !== undefined
          ? users.get(where.id)
          : [...users.values()].find((candidate) => candidate.email === where.email);
        return user ? clone(user) : null;
      },
      update: async ({ where, data }: { where: { id: number }; data: Partial<User> }) => {
        const user = users.get(where.id);
        if (!user) {
          throw new Error('user not found');
        }
        Object.assign(user, data, { updatedAt: now });
        return clone(user);
      },
    },
    session: {
      create: async ({ data }: { data: Omit<Session, 'id'> }) => {
        const session = { ...clone(data), id: randomUUID() };
        sessions.set(session.id, session);
        return clone(session);
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = [...sessions.values()].find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!session) {
          return null;
        }
        const user = users.get(session.userId);
        return user ? { ...clone(session), user: clone(user) } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Session> }) => {
        const session = sessions.get(where.id);
        if (!session) {
          throw new Error('session not found');
        }
        Object.assign(session, data);
        return clone(session);
      },
      updateMany: async ({ where, data }: { where: { userId: number; id?: { not: string } }; data: Partial<Session> }) => {
        let count = 0;
        for (const session of sessions.values()) {
          if (session.userId === where.userId && (where.id === undefined || session.id !== where.id.not)) {
            Object.assign(session, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    category: {
      findMany: async () => [{ id: 1, name: 'Network' }],
    },
  } as unknown as ApplicationApiDatabase;

  return { app: createApp(database), database, users, sessions };
}

function getCookie(response: request.Response, name: string): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Cookie ${name} was not set.`);
  }
  return cookie.split(';', 1)[0].slice(name.length + 1);
}

describe('Lab 3 password contract', () => {
  it('accepts the documented password policy and stores verifiable non-plaintext hashes', async () => {
    const password = 'Initial-password1!';
    expect(validatePassword(password)).toBeNull();

    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt\$v1\$N=32768,r=8,p=1\$/);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('Wrong-password1!', hash)).toBe(false);
  });

  it.each([
    ['', 'empty'],
    ['short1!', 'too short'],
    ['all-lowercase1!', 'missing uppercase'],
    ['ALL-UPPERCASE1!', 'missing lowercase'],
    ['No-digit-password!', 'missing digit'],
    ['No-symbol-password1', 'missing symbol'],
    ['A'.repeat(129), 'too long'],
  ])('rejects a password that is %s', (password) => {
    expect(validatePassword(password)).not.toBeNull();
  });
});

describe('Lab 3 authentication API', () => {
  beforeEach(() => {
    // Each test creates an isolated database harness below.
  });

  it('logs in an active user with a normalized email and returns only safe identity data', async () => {
    const { app } = await createAuthHarness();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ' ARIYA@EXAMPLE.TEST ', password: 'Initial-password1!' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 1,
        name: 'Ariya Anderson',
        email: 'ariya@example.test',
        role: 'REQUESTER',
        isActive: true,
        mustChangePassword: true,
      },
      passwordChangeRequired: true,
    });
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringContaining('toktickit_session='),
      expect.stringContaining('toktickit_csrf='),
    ]));
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((cookie) => cookie.startsWith('toktickit_session='))).toEqual(
      expect.stringContaining('HttpOnly'),
    );
    expect(cookies.find((cookie) => cookie.startsWith('toktickit_csrf='))).not.toEqual(
      expect.stringContaining('HttpOnly'),
    );
  });

  it('returns field errors when login input is invalid', async () => {
    const { app } = await createAuthHarness();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Please correct the highlighted fields.',
      code: 'VALIDATION_FAILED',
      fieldErrors: expect.objectContaining({
        email: expect.any(String),
        password: expect.any(String),
      }),
    }));
  });

  it('rejects an unexpected Origin before authentication handlers run', async () => {
    const { app } = await createAuthHarness();

    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://unexpected.example')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'The request could not be verified.',
      code: 'CSRF_VALIDATION_FAILED',
    });
  });

  it('uses the same safe failure for invalid credentials and inactive accounts', async () => {
    const { app } = await createAuthHarness();
    const invalid = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Wrong-password1!' });
    const inactive = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mali@example.test', password: 'Initial-password1!' });

    expect(invalid.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(inactive.body).toEqual(invalid.body);
    expect(invalid.body).toEqual({
      error: 'Email or password is incorrect.',
      code: 'AUTHENTICATION_FAILED',
    });
  });

  it('returns the current safe identity and rejects an expired session', async () => {
    const { app, sessions, users } = await createAuthHarness();
    users.get(1)!.mustChangePassword = false;
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });

    const currentUser = await agent.get('/api/auth/me');
    expect(currentUser.status).toBe(200);
    expect(currentUser.body).toMatchObject({
      user: { id: 1, email: 'ariya@example.test', mustChangePassword: false },
      passwordChangeRequired: false,
    });

    const session = [...sessions.values()][0];
    session.expiresAt = new Date(Date.now() - 1);
    const expired = await agent.get('/api/auth/me');
    expect(expired.status).toBe(401);
    expect(expired.body).toEqual({
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(login.status).toBe(200);
  });

  it('slides inactivity only up to the fixed absolute session deadline', async () => {
    const { app, sessions, users } = await createAuthHarness();
    users.get(1)!.mustChangePassword = false;
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });

    const session = [...sessions.values()][0];
    const absoluteDeadline = new Date(Date.now() + 1_000);
    session.absoluteExpiresAt = absoluteDeadline;
    await agent.get('/api/categories');

    expect(session.absoluteExpiresAt).toEqual(absoluteDeadline);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(absoluteDeadline.getTime());
  });

  it('updates the sliding deadline and last-used timestamp on valid protected access', async () => {
    const { app, sessions, users } = await createAuthHarness();
    users.get(1)!.mustChangePassword = false;
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });

    const session = [...sessions.values()][0];
    const previousLastUsedAt = new Date(Date.now() - 60_000);
    const previousExpiresAt = new Date(Date.now() + 60_000);
    session.lastUsedAt = previousLastUsedAt;
    session.expiresAt = previousExpiresAt;
    await agent.get('/api/categories');

    expect(session.lastUsedAt.getTime()).toBeGreaterThan(previousLastUsedAt.getTime());
    expect(session.expiresAt.getTime()).toBeGreaterThan(previousExpiresAt.getTime());
  });

  it('restricts an initial-password session from normal APIs until password change succeeds', async () => {
    const { app } = await createAuthHarness();
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    const csrfToken = getCookie(login, 'toktickit_csrf');

    const restricted = await agent.get('/api/categories');
    expect(restricted.status).toBe(403);
    expect(restricted.body).toEqual({
      error: 'Change your password before continuing.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });

    const changed = await agent
      .post('/api/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: 'Initial-password1!',
        newPassword: 'New-strong-password1!',
        confirmPassword: 'New-strong-password1!',
      });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      user: {
        id: 1,
        email: 'ariya@example.test',
        mustChangePassword: false,
      },
      passwordChangeRequired: false,
    });
    expect((await agent.get('/api/categories')).status).toBe(200);
  });

  it('rejects an incorrect current password and invalid new password without changing the account', async () => {
    const { app, users } = await createAuthHarness();
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    const csrfToken = getCookie(login, 'toktickit_csrf');
    const originalHash = users.get(1)?.passwordHash;

    const response = await agent
      .post('/api/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: 'Wrong-password1!',
        newPassword: 'weak',
        confirmPassword: 'different',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.fieldErrors).toEqual(expect.objectContaining({
      newPassword: expect.any(String),
      confirmPassword: expect.any(String),
    }));
    expect(users.get(1)?.passwordHash).toBe(originalHash);
  });

  it('revokes other sessions when the password is changed', async () => {
    const { app, sessions } = await createAuthHarness();
    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);
    const firstLogin = await firstAgent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    await secondAgent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    const csrfToken = getCookie(firstLogin, 'toktickit_csrf');

    const changed = await firstAgent
      .post('/api/auth/change-password')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: 'Initial-password1!',
        newPassword: 'New-strong-password1!',
        confirmPassword: 'New-strong-password1!',
      });

    expect(changed.status).toBe(200);
    expect([...sessions.values()].filter((session) => session.revokedAt !== null)).toHaveLength(1);
    expect((await secondAgent.get('/api/auth/me')).status).toBe(401);
  });

  it('revokes the session and makes logout idempotent', async () => {
    const { app, sessions } = await createAuthHarness();
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    const csrfToken = getCookie(login, 'toktickit_csrf');

    const firstLogout = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', csrfToken);
    const secondLogout = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', csrfToken);

    expect(firstLogout.status).toBe(204);
    expect(secondLogout.status).toBe(204);
    expect(firstLogout.headers['set-cookie'] as unknown as string[]).toEqual(expect.arrayContaining([
      expect.stringContaining('toktickit_session=;'),
      expect.stringContaining('toktickit_csrf=;'),
      expect.stringContaining('Max-Age=0'),
    ]));
    expect([...sessions.values()]).toEqual([
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    ]);
    expect((await agent.get('/api/auth/me')).body).toEqual({
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('temporarily throttles repeated failures without permanently locking the account', async () => {
    const { app } = await createAuthHarness();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ariya@example.test', password: 'Wrong-password1!' });
      expect(response.status).toBe(401);
    }

    const throttled = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });

    expect(throttled.status).toBe(429);
    expect(throttled.body).toEqual({
      error: 'Too many login attempts. Try again later.',
      code: 'AUTHENTICATION_THROTTLED',
    });
  });

  it('clears the temporary limiter after a successful login', async () => {
    const { app } = await createAuthHarness();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'ariya@example.test', password: 'Wrong-password1!' });
    }

    const success = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    const afterSuccessFailure = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Wrong-password1!' });

    expect(success.status).toBe(200);
    expect(afterSuccessFailure.status).toBe(401);
    expect(afterSuccessFailure.body).toEqual({
      error: 'Email or password is incorrect.',
      code: 'AUTHENTICATION_FAILED',
    });
  });

  it('requires CSRF protection for state-changing authenticated requests', async () => {
    const { app } = await createAuthHarness();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/login')
      .send({ email: 'ariya@example.test', password: 'Initial-password1!' });
    const response = await agent.post('/api/auth/logout');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'The request could not be verified.',
      code: 'CSRF_VALIDATION_FAILED',
    });
  });
});
