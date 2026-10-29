import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import { seedLab4Data } from '../../src/lib/lab-04-seed.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '../..', '..');
config({ path: path.join(repositoryRoot, '.env.test'), override: true, quiet: true });

const database = new PrismaClient();

describe('Lab 4 idempotent data seeds', () => {
  afterAll(async () => database.$disconnect());

  it('repeats without duplicate Actions Taken or password changes and covers workflow/dashboard variants', async () => {
    const passwordsBefore = await database.user.findMany({
      select: { id: true, passwordHash: true },
      orderBy: { id: 'asc' },
    });

    await seedLab4Data(database);
    const firstRun = await database.actionTaken.findMany({
      select: {
        id: true,
        ticketId: true,
        performedById: true,
        idempotencyKey: true,
        followUpRequired: true,
        followUpCompleted: true,
        ticket: { select: { ownerId: true, currentStatus: true } },
      },
      orderBy: [{ performedById: 'asc' }, { idempotencyKey: 'asc' }],
    });

    await seedLab4Data(database);
    const secondRun = await database.actionTaken.findMany({
      select: {
        id: true,
        ticketId: true,
        performedById: true,
        idempotencyKey: true,
        followUpRequired: true,
        followUpCompleted: true,
        ticket: { select: { ownerId: true, currentStatus: true } },
      },
      orderBy: [{ performedById: 'asc' }, { idempotencyKey: 'asc' }],
    });
    const passwordsAfter = await database.user.findMany({
      select: { id: true, passwordHash: true },
      orderBy: { id: 'asc' },
    });
    const tickets = await database.ticket.findMany({
      select: { id: true, ticketNumber: true, currentStatus: true, itPriority: true, ownerId: true },
      orderBy: { ticketNumber: 'asc' },
    });

    expect(secondRun).toEqual(firstRun);
    expect(passwordsAfter).toEqual(passwordsBefore);
    expect(new Set(tickets.map((ticket) => ticket.currentStatus))).toEqual(new Set([
      'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED',
    ]));
    expect(new Set(tickets.map((ticket) => ticket.itPriority))).toEqual(new Set([
      'LOW', 'MEDIUM', 'HIGH', 'URGENT',
    ]));
    expect(tickets.some((ticket) => ticket.ownerId === null)).toBe(true);
    expect(tickets.some((ticket) => ticket.ownerId !== null)).toBe(true);
    expect(new Set(firstRun.map((action) => action.performedById)).size).toBeGreaterThan(1);
    expect(firstRun.some((action) => action.ticket.ownerId !== action.performedById)).toBe(true);
    expect(firstRun.some((action) => action.followUpRequired && !action.followUpCompleted)).toBe(true);
    expect(firstRun.some((action) => action.followUpRequired && action.followUpCompleted)).toBe(true);
    expect(firstRun.some((action) => !action.followUpRequired && !action.followUpCompleted)).toBe(true);

    const ticketActionCounts = new Map<number, number>();
    for (const action of firstRun) {
      ticketActionCounts.set(action.ticketId, (ticketActionCounts.get(action.ticketId) ?? 0) + 1);
    }
    const zeroActionTicket = tickets.find((ticket) => ticket.ticketNumber === 'TKT-2026-000001');
    const oneActionTicket = tickets.find((ticket) => ticket.ticketNumber === 'TKT-2026-000003');
    const multipleActionTicket = tickets.find((ticket) => ticket.ticketNumber === 'TKT-2026-000002');
    expect(zeroActionTicket).toBeDefined();
    expect(oneActionTicket).toBeDefined();
    expect(multipleActionTicket).toBeDefined();
    expect(ticketActionCounts.get(zeroActionTicket!.id) ?? 0).toBe(0);
    expect(ticketActionCounts.get(oneActionTicket!.id)).toBe(1);
    expect(ticketActionCounts.get(multipleActionTicket!.id)).toBeGreaterThan(1);
    expect(firstRun.length).toBeGreaterThan(0);
    expect(new Set(firstRun.map((action) => action.ticketId)).size).toBeGreaterThan(1);

    const users = await database.user.findMany({
      where: { role: 'ADMINISTRATOR' },
      select: { id: true },
    });
    const adminActionCount = await database.actionTaken.count({
      where: { performedById: users[0]?.id },
    });
    expect(adminActionCount).toBe(0);
  }, 30_000);
});
