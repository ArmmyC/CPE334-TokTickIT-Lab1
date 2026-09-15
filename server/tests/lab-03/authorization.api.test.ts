import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type ApplicationApiDatabase } from '../../src/app.js';
import { hashPassword } from '../../src/auth/password.js';

type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

type User = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
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

type Ticket = {
  id: number;
  ticketNumber: string;
  ticketDate: Date;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

type Attachment = {
  id: number;
  ticketId: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getCookie(response: request.Response, name: string): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Cookie ${name} was not set.`);
  }
  return cookie.split(';', 1)[0].slice(name.length + 1);
}

async function createAuthorizationHarness() {
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
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    }],
    [2, {
      id: 2,
      name: 'Narin Chai',
      email: 'narin@example.test',
      passwordHash,
      role: 'REQUESTER',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    }],
    [3, {
      id: 3,
      name: 'Somchai Rattanakul',
      email: 'somchai@example.test',
      passwordHash,
      role: 'IT_STAFF',
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    }],
  ]);
  const sessions = new Map<string, Session>();
  const tickets = new Map<number, Ticket>([
    [42, {
      id: 42,
      ticketNumber: 'TKT-2026-000042',
      ticketDate: now,
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: 'Ariya owned ticket',
      description: 'The ticket belongs to Ariya.',
      requestedPriority: 'MEDIUM',
      itPriority: null,
      currentStatus: 'NEW',
      createdAt: now,
      updatedAt: now,
    }],
    [43, {
      id: 43,
      ticketNumber: 'TKT-2026-000043',
      ticketDate: now,
      requesterId: 2,
      categoryId: 2,
      relatedSystemId: 3,
      summary: 'Narin owned ticket',
      description: 'The ticket belongs to Narin.',
      requestedPriority: 'HIGH',
      itPriority: null,
      currentStatus: 'NEW',
      createdAt: now,
      updatedAt: now,
    }],
  ]);
  const attachments = new Map<number, Attachment>([
    [7, {
      id: 7,
      ticketId: 42,
      originalName: 'ariya.pdf',
      storageKey: 'ariya-key',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      uploadedAt: now,
      removedAt: null,
      removalReason: null,
    }],
    [8, {
      id: 8,
      ticketId: 43,
      originalName: 'narin.pdf',
      storageKey: 'narin-key',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      uploadedAt: now,
      removedAt: null,
      removalReason: null,
    }],
  ]);
  let nextTicketId = 44;
  let nextAttachmentId = 9;
  const createdTickets: Ticket[] = [];

  const findTicket = async ({ where, select }: {
    where: { id: number };
    select?: Record<string, unknown>;
  }) => {
    const ticket = tickets.get(where.id);
    if (!ticket) return null;
    if (select && 'requester' in select) {
      const requester = users.get(ticket.requesterId)!;
      return {
        ...clone(ticket),
        requester: { id: requester.id, name: requester.name, email: requester.email },
        category: { id: ticket.categoryId, name: 'Hardware' },
        relatedSystem: { id: ticket.relatedSystemId, name: 'VPN' },
      };
    }
    return { id: ticket.id, requesterId: ticket.requesterId };
  };

  const transaction = {
    category: {
      findUnique: vi.fn().mockResolvedValue({ id: 2, isActive: true }),
    },
    relatedSystem: {
      findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    ticket: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const ticket: Ticket = {
          id: nextTicketId,
          ticketNumber: String(data.ticketNumber),
          ticketDate: now,
          requesterId: Number(data.requesterId),
          categoryId: Number(data.categoryId),
          relatedSystemId: Number(data.relatedSystemId),
          summary: String(data.summary),
          description: String(data.description),
          requestedPriority: String(data.requestedPriority),
          itPriority: null,
          currentStatus: 'NEW',
          createdAt: now,
          updatedAt: now,
        };
        nextTicketId += 1;
        tickets.set(ticket.id, ticket);
        createdTickets.push(ticket);
        return Promise.resolve(clone(ticket));
      }),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: number }; data: { ticketNumber: string } }) => {
        const ticket = tickets.get(where.id)!;
        ticket.ticketNumber = data.ticketNumber;
        return Promise.resolve(clone(ticket));
      }),
    },
  };

  const database = {
    user: {
      findUnique: async ({ where }: { where: { id?: number; email?: string } }) => {
        const user = where.id !== undefined
          ? users.get(where.id)
          : [...users.values()].find((candidate) => candidate.email === where.email);
        return user ? clone(user) : null;
      },
      update: async ({ where, data }: { where: { id: number }; data: Partial<User> }) => {
        const user = users.get(where.id)!;
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
        if (!session) return null;
        const user = users.get(session.userId);
        return user ? { ...clone(session), user: clone(user) } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Session> }) => {
        const session = sessions.get(where.id)!;
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
      findMany: vi.fn().mockResolvedValue([{ id: 2, name: 'Hardware' }]),
      findUnique: transaction.category.findUnique,
    },
    relatedSystem: {
      findMany: vi.fn().mockResolvedValue([{ id: 3, name: 'VPN' }]),
      findUnique: transaction.relatedSystem.findUnique,
    },
    ticket: {
      findUnique: findTicket,
      findMany: vi.fn().mockImplementation(async ({ where }: { where: { requesterId: number } }) =>
        [...tickets.values()].filter((ticket) => ticket.requesterId === where.requesterId).map(clone)),
      count: vi.fn().mockImplementation(async ({ where }: { where: { requesterId: number } }) =>
        [...tickets.values()].filter((ticket) => ticket.requesterId === where.requesterId).length),
    },
    attachment: {
      count: vi.fn().mockImplementation(async ({ where }: { where: { ticketId: number; removedAt: null } }) =>
        [...attachments.values()].filter((attachment) => attachment.ticketId === where.ticketId && attachment.removedAt === null).length),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const attachment: Attachment = {
          id: nextAttachmentId,
          ticketId: Number(data.ticketId),
          originalName: String(data.originalName),
          storageKey: String(data.storageKey),
          mimeType: String(data.mimeType),
          sizeBytes: Number(data.sizeBytes),
          uploadedAt: now,
          removedAt: null,
          removalReason: null,
        };
        nextAttachmentId += 1;
        attachments.set(attachment.id, attachment);
        return Promise.resolve(clone(attachment));
      }),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(clone(attachments.get(where.id) ?? null))),
      findMany: vi.fn().mockImplementation(({ where }: { where: { ticketId: number } }) =>
        Promise.resolve([...attachments.values()].filter((attachment) => attachment.ticketId === where.ticketId).map(clone))),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: number }; data: { removedAt: Date; removalReason: string } }) => {
        const attachment = attachments.get(where.id)!;
        Object.assign(attachment, data);
        return Promise.resolve(clone(attachment));
      }),
    },
    $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction)),
  } as unknown as ApplicationApiDatabase;

  return { app: createApp(database), database, users, createdTickets };
}

async function login(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/login')
    .send({ email, password: 'Initial-password1!' });
  expect(response.status).toBe(200);
  return { agent, csrfToken: getCookie(response, 'toktickit_csrf') };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Lab 3 requester authorization', () => {
  it('distinguishes an unauthenticated requester API call from a forbidden role', async () => {
    const { app } = await createAuthorizationHarness();

    const unauthenticated = await request(app).get('/api/tickets');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });

    const staff = await login(app, 'somchai@example.test');
    const forbidden = await staff.agent.get('/api/tickets');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({
      error: 'You do not have permission to access this resource.',
      code: 'FORBIDDEN',
    });
  });

  it('uses the authenticated requester for list and detail even when another requesterId is supplied', async () => {
    const { app } = await createAuthorizationHarness();
    const requester = await login(app, 'ariya@example.test');

    const list = await requester.agent.get('/api/tickets?requesterId=2');
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({ id: 42, ticketNumber: 'TKT-2026-000042' }),
    ]);
    expect(list.body.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 43 }),
    ]));

    const foreignDetail = await requester.agent.get('/api/tickets/43?requesterId=2');
    expect(foreignDetail.status).toBe(404);
    expect(foreignDetail.body).toEqual({ error: 'Ticket not found.' });
  });

  it('creates a ticket for the authenticated requester despite a conflicting body requesterId', async () => {
    const { app, createdTickets } = await createAuthorizationHarness();
    const requester = await login(app, 'ariya@example.test');

    const response = await requester.agent
      .post('/api/tickets')
      .set('X-CSRF-Token', requester.csrfToken)
      .send({
        requesterId: 2,
        categoryId: 2,
        relatedSystemId: 3,
        summary: 'New authenticated ticket',
        description: 'This ticket must use the current authenticated identity.',
        requestedPriority: 'HIGH',
      });

    expect(response.status).toBe(201);
    expect(createdTickets[0]?.requesterId).toBe(1);
    expect(response.body.ticket.requesterId).toBe(1);
  });

  it('protects foreign attachment read, upload, and soft removal paths with the session owner', async () => {
    const { app } = await createAuthorizationHarness();
    const requester = await login(app, 'ariya@example.test');

    const metadata = await requester.agent.get('/api/attachments/8?requesterId=2');
    expect(metadata.status).toBe(404);
    expect(metadata.body).toEqual({ error: 'Attachment not found.' });

    const download = await requester.agent.get('/api/attachments/8/download?requesterId=2');
    expect(download.status).toBe(404);
    expect(download.body).toEqual({ error: 'Attachment not found.' });

    const upload = await requester.agent
      .post('/api/tickets/43/attachments')
      .set('X-CSRF-Token', requester.csrfToken)
      .field('requesterId', '2')
      .attach('file', Buffer.from('proof'), { filename: 'proof.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(404);
    expect(upload.body).toEqual({ error: 'Ticket not found.' });

    const removal = await requester.agent
      .delete('/api/attachments/8')
      .set('X-CSRF-Token', requester.csrfToken)
      .send({ requesterId: 2, removalReason: 'No longer needed.' });
    expect(removal.status).toBe(404);
    expect(removal.body).toEqual({ error: 'Attachment not found.' });
  });
});
