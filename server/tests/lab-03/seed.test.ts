import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../src/auth/password.js';
import { seedLab3Data, type Lab3SeedClient } from '../../src/lib/lab-03-seed.js';

type SeedUser = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
  mustChangePassword: boolean;
};

type SeedTicket = {
  id: number;
  ticketNumber: string;
  requesterId: number;
  ownerId: number | null;
  currentStatus: string;
};

function createSeedHarness() {
  const categories = new Map<string, { id: number; name: string; isActive: boolean }>();
  const relatedSystems = new Map<string, { id: number; name: string; isActive: boolean }>();
  const users = new Map<string, SeedUser>();
  const tickets = new Map<string, SeedTicket>();
  const comments: Array<{ ticketId: number; authorId: number; content: string }> = [];
  const notes: Array<{ ticketId: number; authorId: number; content: string }> = [];
  let nextId = 1;

  const database = {
    category: {
      async upsert({ where, update, create }: { where: { name: string }; update: { name: string; isActive: boolean }; create: { name: string; isActive: boolean } }) {
        const current = categories.get(where.name);
        if (current) {
          Object.assign(current, update);
          return current;
        }
        const row = { id: nextId++, ...create };
        categories.set(where.name, row);
        return row;
      },
    },
    relatedSystem: {
      async upsert({ where, update, create }: { where: { name: string }; update: { name: string; isActive: boolean }; create: { name: string; isActive: boolean } }) {
        const current = relatedSystems.get(where.name);
        if (current) {
          Object.assign(current, update);
          return current;
        }
        const row = { id: nextId++, ...create };
        relatedSystems.set(where.name, row);
        return row;
      },
    },
    user: {
      async upsert({ where, update, create }: { where: { email: string }; update: Omit<SeedUser, 'id' | 'passwordHash' | 'mustChangePassword'>; create: Omit<SeedUser, 'id'> }) {
        const current = users.get(where.email);
        if (current) {
          Object.assign(current, update);
          return current;
        }
        const row = { id: nextId++, ...create };
        users.set(where.email, row);
        return row;
      },
      async findUnique({ where }: { where: { email: string } }) {
        const user = users.get(where.email);
        return user ? { id: user.id, passwordHash: user.passwordHash } : null;
      },
      async update({ where, data }: { where: { id: number }; data: { passwordHash: string; mustChangePassword: boolean } }) {
        const user = [...users.values()].find((candidate) => candidate.id === where.id);
        if (!user) {
          throw new Error('user not found');
        }
        Object.assign(user, data);
        return user;
      },
    },
    ticket: {
      async upsert({ where, update, create }: { where: { ticketNumber: string }; update: Record<string, unknown>; create: Record<string, unknown> }) {
        const current = tickets.get(where.ticketNumber);
        if (current) {
          Object.assign(current, update);
          return current;
        }
        const row = {
          id: nextId++,
          ticketNumber: create.ticketNumber as string,
          requesterId: create.requesterId as number,
          ownerId: create.ownerId as number | null,
          currentStatus: create.currentStatus as string,
        };
        tickets.set(where.ticketNumber, row);
        return row;
      },
      async findUnique({ where }: { where: { ticketNumber: string } }) {
        const ticket = tickets.get(where.ticketNumber);
        return ticket ? { id: ticket.id } : null;
      },
    },
    publicComment: {
      async findFirst({ where }: { where: { ticketId: number; authorId: number; content: string } }) {
        return comments.find((comment) => comment.ticketId === where.ticketId &&
          comment.authorId === where.authorId && comment.content === where.content) ?? null;
      },
      async create({ data }: { data: { ticketId: number; authorId: number; content: string } }) {
        comments.push(data);
        return data;
      },
    },
    internalNote: {
      async findFirst({ where }: { where: { ticketId: number; authorId: number; content: string } }) {
        return notes.find((note) => note.ticketId === where.ticketId &&
          note.authorId === where.authorId && note.content === where.content) ?? null;
      },
      async create({ data }: { data: { ticketId: number; authorId: number; content: string } }) {
        notes.push(data);
        return data;
      },
    },
  } as unknown as Lab3SeedClient;

  return { database, categories, relatedSystems, users, tickets, comments, notes };
}

describe('Lab 3 repeatable seed', () => {
  it('creates the required role counts, workflow states, and communication records without duplicates', async () => {
    const harness = createSeedHarness();

    await seedLab3Data(harness.database);
    await seedLab3Data(harness.database);

    expect(harness.categories.size).toBe(4);
    expect(harness.relatedSystems.size).toBe(7);
    expect(harness.users.size).toBe(10);
    expect([...harness.users.values()].filter((user) => user.role === 'REQUESTER' && user.isActive)).toHaveLength(4);
    expect([...harness.users.values()].filter((user) => user.role === 'REQUESTER' && !user.isActive)).toHaveLength(1);
    expect([...harness.users.values()].filter((user) => user.role === 'IT_STAFF' && user.isActive)).toHaveLength(3);
    expect([...harness.users.values()].filter((user) => user.role === 'IT_STAFF' && !user.isActive)).toHaveLength(1);
    expect([...harness.users.values()].filter((user) => user.role === 'ADMINISTRATOR' && user.isActive)).toHaveLength(1);
    const ariya = harness.users.get('ariya@example.test');
    expect(ariya).toBeDefined();
    expect(await verifyPassword(
      `TokTickIT-Lab3!User-${ariya!.id}-Aa`,
      ariya!.passwordHash,
    )).toBe(true);
    expect(harness.tickets.size).toBe(8);
    expect(new Set([...harness.tickets.values()].map((ticket) => ticket.currentStatus))).toEqual(new Set([
      'NEW',
      'OPEN',
      'IN_PROGRESS',
      'WAITING_FOR_REQUESTER',
      'RESOLVED',
      'CLOSED',
      'REOPENED',
      'CANCELLED',
    ]));
    expect(harness.comments).toHaveLength(3);
    expect(harness.notes).toHaveLength(2);
  });
});
