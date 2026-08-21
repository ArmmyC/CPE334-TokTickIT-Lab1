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
import type { AttachmentStorage } from '../../src/lib/attachment-storage.js';

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

type TicketFixture = {
  id: number;
  ticketNumber: string;
  ticketDate: Date;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
  itPriority: null;
  currentStatus: 'NEW';
  createdAt: Date;
  updatedAt: Date;
};

function createTicketApiHarness() {
  const createdAt = new Date('2026-08-21T09:00:00.000Z');
  const ticket: TicketFixture = {
    id: 42,
    ticketNumber: 'TKT-2026-TMP-ABC12345',
    ticketDate: createdAt,
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 3,
    summary: 'Laptop battery drains quickly',
    description: 'The battery drains while the laptop is idle.',
    requestedPriority: 'MEDIUM',
    itPriority: null,
    currentStatus: 'NEW',
    createdAt,
    updatedAt: createdAt,
  };
  const transaction = {
    developmentRequester: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, isActive: true }),
    },
    category: {
      findUnique: vi.fn().mockResolvedValue({ id: 2, isActive: true }),
    },
    relatedSystem: {
      findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    ticket: {
      create: vi.fn().mockResolvedValue(ticket),
      update: vi.fn().mockImplementation(({ data }: { data: Partial<TicketFixture> }) =>
        Promise.resolve({ ...ticket, ...data })),
    },
  };
  const database = {
    category: {
      findMany: vi.fn(),
      findUnique: transaction.category.findUnique,
    },
    relatedSystem: {
      findMany: vi.fn(),
      findUnique: transaction.relatedSystem.findUnique,
    },
    developmentRequester: {
      findMany: vi.fn(),
      findUnique: transaction.developmentRequester.findUnique,
    },
    ticket: transaction.ticket,
    $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction)),
  } as unknown as ApplicationApiDatabase;

  return { database, transaction, ticket };
}

describe('Lab 2 reference data and ticket creation API', () => {
  it('returns active Related Systems ordered by name', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 2, name: 'Campus Wi-Fi' },
      { id: 1, name: 'Email' },
    ]);
    const { database } = createTicketApiHarness();
    (database.relatedSystem as unknown as { findMany: typeof findMany }).findMany = findMany;

    const response = await request(createApp(database)).get('/api/related-systems');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 2, name: 'Campus Wi-Fi' },
      { id: 1, name: 'Email' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });

  it('creates one owned NEW ticket with a final backend ticket number', async () => {
    const { database, transaction } = createTicketApiHarness();

    const response = await request(createApp(database))
      .post('/api/tickets')
      .send({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 3,
        summary: '  Laptop battery drains quickly  ',
        description: '  The battery drains while the laptop is idle.  ',
        requestedPriority: 'MEDIUM',
      });

    expect(response.status).toBe(201);
    expect(response.body.ticket).toMatchObject({
      id: 42,
      ticketNumber: 'TKT-2026-000042',
      requesterId: 1,
      categoryId: 2,
      relatedSystemId: 3,
      summary: 'Laptop battery drains quickly',
      description: 'The battery drains while the laptop is idle.',
      requestedPriority: 'MEDIUM',
      currentStatus: 'NEW',
      itPriority: null,
    });
    expect(response.body.ticket.ticketNumber).not.toContain('TMP');
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.ticket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 3,
        summary: 'Laptop battery drains quickly',
        description: 'The battery drains while the laptop is idle.',
        requestedPriority: 'MEDIUM',
        ticketNumber: expect.stringMatching(/^TKT-\d{4}-TMP-[a-z0-9]+$/),
      }),
    });
    expect(transaction.ticket.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { ticketNumber: 'TKT-2026-000042' },
    });
  });

  it('returns field errors and does not create a ticket for invalid or server-controlled fields', async () => {
    const { database } = createTicketApiHarness();

    const response = await request(createApp(database))
      .post('/api/tickets')
      .send({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 3,
        summary: ' x ',
        description: ' short ',
        requestedPriority: 'NOT_A_PRIORITY',
        ticketNumber: 'TKT-2026-000001',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Please correct the highlighted fields.',
      fieldErrors: {
        summary: 'Summary must be between 5 and 120 characters after trimming.',
        description: 'Description must be between 10 and 4000 characters after trimming.',
        requestedPriority: 'Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.',
        ticketNumber: 'Ticket Number is generated by the server and cannot be supplied.',
      },
    });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects inactive or missing reference records without creating a ticket', async () => {
    const { database } = createTicketApiHarness();
    const requesterFindUnique = (database.developmentRequester as unknown as {
      findUnique: ReturnType<typeof vi.fn>;
    }).findUnique;
    requesterFindUnique.mockResolvedValue(null);

    const response = await request(createApp(database))
      .post('/api/tickets')
      .send({
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 3,
        summary: 'Laptop battery drains quickly',
        description: 'The battery drains while the laptop is idle.',
        requestedPriority: 'MEDIUM',
      });

    expect(response.status).toBe(400);
    expect(response.body.fieldErrors).toEqual({
      requesterId: 'Development Requester does not exist or is inactive.',
    });
    expect((database.ticket as unknown as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
  });
});

function createAttachmentApiHarness() {
  const attachment = {
    id: 7,
    ticketId: 42,
    originalName: 'evidence.pdf',
    storageKey: 'generated-storage-key',
    mimeType: 'application/pdf',
    sizeBytes: 4,
    uploadedAt: new Date('2026-08-21T09:00:00.000Z'),
    removedAt: null,
    removalReason: null,
  };
  const storage: AttachmentStorage = {
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(Buffer.from('pdf')),
  };
  const database = {
    category: { findMany: vi.fn() },
    ticket: {
      findUnique: vi.fn().mockResolvedValue({ id: 42, requesterId: 1 }),
    },
    attachment: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(attachment),
    },
  } as unknown as ApplicationApiDatabase;

  return { database, storage, attachment };
}

describe('Lab 2 initial attachment upload API', () => {
  it('stores a permitted attachment and returns metadata without the storage key', async () => {
    const { database, storage } = createAttachmentApiHarness();

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .post('/api/tickets/42/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('%PDF'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(response.body.attachment).toMatchObject({
      id: 7,
      ticketId: 42,
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      downloadAvailable: true,
    });
    expect(response.body.attachment.storageKey).toBeUndefined();
    expect(storage.save).toHaveBeenCalledWith(expect.any(String), Buffer.from('%PDF'));
  });

  it('removes stored bytes when attachment metadata creation fails', async () => {
    const { database, storage } = createAttachmentApiHarness();
    (database.attachment as unknown as { create: ReturnType<typeof vi.fn> }).create
      .mockRejectedValue(new Error('metadata failed'));

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .post('/api/tickets/42/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('%PDF'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unable to upload the attachment.' });
    const storedKey = (storage.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(storage.remove).toHaveBeenCalledWith(storedKey);
  });

  it('rejects unsupported extensions or MIME types', async () => {
    const { database, storage } = createAttachmentApiHarness();

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .post('/api/tickets/42/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('not an image'), {
        filename: 'evidence.exe',
        contentType: 'application/octet-stream',
      });

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: 'This attachment type is not supported.' });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects a sixth active attachment', async () => {
    const { database, storage } = createAttachmentApiHarness();
    (database.attachment as unknown as { count: ReturnType<typeof vi.fn> }).count
      .mockResolvedValue(5);

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .post('/api/tickets/42/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('%PDF'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'A Ticket may have at most five active attachments.',
    });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('uses the same safe not-found response for a foreign Ticket', async () => {
    const { database, storage } = createAttachmentApiHarness();
    (database.ticket as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
      .mockResolvedValue(null);

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .post('/api/tickets/42/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('%PDF'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Ticket not found.' });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects an attachment over the 5 MB limit with 413', async () => {
    const { database, storage } = createAttachmentApiHarness();
    const oversizedFile = Buffer.alloc(5 * 1024 * 1024 + 1, 0x61);

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .post('/api/tickets/42/attachments')
      .field('requesterId', '1')
      .attach('file', oversizedFile, {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'This attachment is larger than 5 MB.' });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('returns a safe 400 response for malformed JSON', async () => {
    const { database } = createTicketApiHarness();

    const response = await request(createApp(database))
      .post('/api/tickets')
      .set('Content-Type', 'application/json')
      .send('{"requesterId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid JSON request.' });
  });
});
