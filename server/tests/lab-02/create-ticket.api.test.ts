import { readFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  DEVELOPMENT_REQUESTERS,
  RELATED_SYSTEM_NAMES,
  type Lab2SeedClient,
  seedLab2ReferenceData,
} from '../../src/lib/lab-02-seed.js';
import { createApp, type ApplicationApiDatabase } from '../../src/app.js';

type SeedRow = {
  name: string;
  email?: string;
  isActive: boolean;
};

function createSeedHarness() {
  const categories = new Map<string, SeedRow>();
  const relatedSystems = new Map<string, SeedRow>();
  const requesters = new Map<string, SeedRow>();

  const database: Lab2SeedClient = {
    category: {
      async upsert({ where, update, create }) {
        const current = categories.get(where.name);
        const next = current ? { ...current, ...update } : create;
        categories.set(where.name, next);
        return next;
      },
    },
    relatedSystem: {
      async upsert({ where, update, create }) {
        const current = relatedSystems.get(where.name);
        const next = current ? { ...current, ...update } : create;
        relatedSystems.set(where.name, next);
        return next;
      },
    },
    developmentRequester: {
      async upsert({ where, update, create }) {
        const current = requesters.get(where.email);
        const next = current ? { ...current, ...update } : create;
        requesters.set(where.email, next);
        return next;
      },
    },
  };

  return { categories, relatedSystems, requesters, database };
}

describe('Lab 2 reference data seed', () => {
  it('exposes the required Prisma models, ownership fields, enums, and indexes', () => {
    const modelNames = Prisma.dmmf.datamodel.models.map(({ name }) => name);
    const ticket = Prisma.dmmf.datamodel.models.find(({ name }) => name === 'Ticket');
    const attachment = Prisma.dmmf.datamodel.models.find(({ name }) => name === 'Attachment');
    const enumValues = Object.fromEntries(
      Prisma.dmmf.datamodel.enums.map(({ name, values }) => [
        name,
        values.map((value) => value.name),
      ]),
    );
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');

    expect(modelNames).toEqual([
      'Category',
      'RelatedSystem',
      'DevelopmentRequester',
      'Ticket',
      'Attachment',
    ]);
    expect(ticket?.fields.find(({ name }) => name === 'ticketNumber')?.isUnique).toBe(true);
    expect(ticket?.fields.find(({ name }) => name === 'currentStatus')?.default).toBe('NEW');
    expect(ticket?.fields.find(({ name }) => name === 'itPriority')?.isRequired).toBe(false);
    expect(attachment?.fields.find(({ name }) => name === 'storageKey')?.isUnique).toBe(true);
    expect(attachment?.fields.find(({ name }) => name === 'removedAt')?.isRequired).toBe(false);
    expect(attachment?.fields.find(({ name }) => name === 'removalReason')?.isRequired).toBe(false);
    expect(enumValues).toEqual({
      RequestedPriority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      TicketPriority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      TicketStatus: ['NEW'],
    });
    expect(schema).toContain('@@index([requesterId, updatedAt, id])');
    expect(schema).toContain('@@index([categoryId])');
    expect(schema).toContain('@@index([relatedSystemId])');
    expect(schema).toContain('@@index([requestedPriority])');
    expect(schema).toContain('@@index([currentStatus])');
    expect(schema).toContain('@@index([ticketId, removedAt])');
  });

  it('creates the required stable reference data and requester activity states', async () => {
    const harness = createSeedHarness();

    await seedLab2ReferenceData(harness.database);

    expect([...harness.categories.keys()]).toEqual([
      'Account and Access',
      'Hardware',
      'Software',
      'Network',
    ]);
    expect([...harness.relatedSystems.keys()]).toEqual([...RELATED_SYSTEM_NAMES]);
    expect(harness.relatedSystems.size).toBeGreaterThanOrEqual(6);
    expect(harness.requesters.size).toBe(5);
    expect([...harness.requesters.values()].filter(({ isActive }) => isActive)).toHaveLength(4);
    expect([...harness.requesters.values()].filter(({ isActive }) => !isActive)).toHaveLength(1);
    expect([...harness.requesters.keys()]).toEqual(
      DEVELOPMENT_REQUESTERS.map(({ email }) => email),
    );
  });

  it('is idempotent and restores the declared names and activity flags', async () => {
    const harness = createSeedHarness();

    await seedLab2ReferenceData(harness.database);
    harness.relatedSystems.set('VPN', { name: 'Old VPN label', isActive: false });
    harness.requesters.set('ariya@example.test', {
      name: 'Old requester name',
      email: 'ariya@example.test',
      isActive: false,
    });

    await seedLab2ReferenceData(harness.database);

    expect(harness.categories.size).toBe(4);
    expect(harness.relatedSystems.size).toBe(7);
    expect(harness.requesters.size).toBe(5);
    expect(harness.relatedSystems.get('VPN')).toEqual({ name: 'VPN', isActive: true });
    expect(harness.requesters.get('ariya@example.test')).toEqual({
      name: 'Ariya Anderson',
      email: 'ariya@example.test',
      isActive: true,
    });
  });
});

describe('Lab 2 Development Requesters API', () => {
  it('returns active requesters ordered by name and excludes inactive rows', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 2, name: 'Ariya Anderson', email: 'ariya@example.test' },
      { id: 4, name: 'Narin Chai', email: 'narin@example.test' },
    ]);
    const database = {
      developmentRequester: { findMany },
    } as unknown as ApplicationApiDatabase;

    const response = await request(createApp(database)).get('/api/development-requesters');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 2, name: 'Ariya Anderson', email: 'ariya@example.test' },
      { id: 4, name: 'Narin Chai', email: 'narin@example.test' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  });

  it('returns an empty list when no active requesters exist', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const database = {
      developmentRequester: { findMany },
    } as unknown as ApplicationApiDatabase;

    const response = await request(createApp(database)).get('/api/development-requesters');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns a safe error when requester retrieval fails', async () => {
    const findMany = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const database = {
      developmentRequester: { findMany },
    } as unknown as ApplicationApiDatabase;

    const response = await request(createApp(database)).get('/api/development-requesters');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unable to load Development Requesters.' });
  });
});
