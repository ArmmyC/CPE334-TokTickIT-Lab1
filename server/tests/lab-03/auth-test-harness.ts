import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { hashPassword } from '../../src/auth/password.js';
import type { AuthDatabase, AuthSessionRecord, AuthUserRecord } from '../../src/auth/types.js';
import type { ApplicationApiDatabase } from '../../src/app.js';

export const TEST_PASSWORD = 'Initial-password1!';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function createAuthTestHarness(
  userOverrides: Partial<AuthUserRecord>[] = [],
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const now = new Date('2026-09-12T00:00:00.000Z');
  const defaultUsers: AuthUserRecord[] = [
    {
      id: 1,
      name: 'Ariya Anderson',
      email: 'ariya@example.test',
      passwordHash,
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      name: 'Mali Boonmee',
      email: 'mali@example.test',
      passwordHash,
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      name: 'Somsak Staff',
      email: 'somsak@example.test',
      passwordHash,
      role: 'IT_STAFF',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const users = new Map<number, AuthUserRecord>(defaultUsers.map((user, index) => [
    user.id,
    { ...user, ...userOverrides[index] },
  ]));
  const sessions = new Map<string, AuthSessionRecord>();

  const database: AuthDatabase = {
    user: {
      findUnique: async ({ where }) => {
        const user = where.id !== undefined
          ? users.get(where.id)
          : [...users.values()].find((candidate) => candidate.email === where.email);
        return user ? clone(user) : null;
      },
      update: async ({ where, data }) => {
        const user = users.get(where.id);
        if (!user) {
          throw new Error('user not found');
        }
        Object.assign(user, data, { updatedAt: now });
        return clone(user);
      },
    },
    session: {
      create: async ({ data }) => {
        const session = { ...clone(data), id: randomUUID() };
        sessions.set(session.id, session);
        return clone(session);
      },
      findUnique: async ({ where }) => {
        const session = [...sessions.values()].find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!session) {
          return null;
        }
        const user = users.get(session.userId);
        return user ? { ...clone(session), user: clone(user) } : null;
      },
      update: async ({ where, data }) => {
        const session = sessions.get(where.id);
        if (!session) {
          throw new Error('session not found');
        }
        Object.assign(session, data);
        return clone(session);
      },
      updateMany: async ({ where, data }) => {
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
  };

  async function login(app: Express, email = 'ariya@example.test') {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    if (response.status !== 200) {
      throw new Error(`Test login failed with status ${response.status}.`);
    }
    return { agent, response, csrfToken: getCookie(response, 'toktickit_csrf') };
  }

  return {
    database,
    users,
    sessions,
    login,
  };
}

export function getCookie(response: request.Response, name: string): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Cookie ${name} was not set.`);
  }
  return cookie.split(';', 1)[0].slice(name.length + 1);
}

export function withAuthDatabase(
  database: Record<string, unknown>,
  authDatabase: AuthDatabase,
): ApplicationApiDatabase {
  return { ...database, ...authDatabase } as unknown as ApplicationApiDatabase;
}
