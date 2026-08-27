import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type ApplicationApiDatabase, type AttachmentRecord } from '../../src/app.js';
import type { AttachmentStorage } from '../../src/lib/attachment-storage.js';

const ticketDate = new Date('2026-08-21T10:00:00.000Z');
const removedAt = new Date('2026-08-21T11:00:00.000Z');

const activeAttachment = {
  id: 7,
  ticketId: 42,
  originalName: 'evidence.pdf',
  storageKey: '12345678-1234-4234-8234-123456789012',
  mimeType: 'application/pdf',
  sizeBytes: 7,
  uploadedAt: ticketDate,
  removedAt: null,
  removalReason: null,
};

const removedAttachment = {
  id: 8,
  ticketId: 42,
  originalName: 'old-screenshot.png',
  storageKey: '22345678-1234-4234-8234-123456789012',
  mimeType: 'image/png',
  sizeBytes: 2048,
  uploadedAt: ticketDate,
  removedAt,
  removalReason: 'Uploaded the wrong document',
};

const ticketDetail = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  ticketDate,
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 7,
  summary: 'Laptop battery drains quickly',
  description: 'The battery drains while the laptop is idle.',
  requestedPriority: 'MEDIUM',
  itPriority: null,
  currentStatus: 'NEW',
  createdAt: ticketDate,
  updatedAt: ticketDate,
  requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
  category: { id: 2, name: 'Hardware' },
  relatedSystem: { id: 7, name: 'Corporate Laptop' },
};

function createDetailHarness() {
  const attachments = new Map<number, AttachmentRecord>([
    [activeAttachment.id, activeAttachment],
    [removedAttachment.id, removedAttachment],
  ]);
  const ticketFindUnique = vi.fn().mockResolvedValue(ticketDetail);
  const attachmentFindUnique = vi.fn().mockImplementation(({ where }: { where: { id: number } }) =>
    Promise.resolve(attachments.get(where.id) ?? null));
  const attachmentFindMany = vi.fn().mockResolvedValue([...attachments.values()]);
  const attachmentUpdate = vi.fn().mockImplementation(({ where, data }: {
    where: { id: number };
    data: { removedAt: Date; removalReason: string };
  }) => {
    const current = attachments.get(where.id);
    if (!current) {
      throw new Error('Attachment fixture not found.');
    }
    const updated = { ...current, ...data };
    attachments.set(where.id, updated);
    return Promise.resolve(updated);
  });
  const storage: AttachmentStorage = {
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7 test bytes')),
  };
  const database = {
    category: { findMany: vi.fn() },
    relatedSystem: { findMany: vi.fn() },
    developmentRequester: { findMany: vi.fn() },
    ticket: { findUnique: ticketFindUnique },
    attachment: {
      findUnique: attachmentFindUnique,
      findMany: attachmentFindMany,
      update: attachmentUpdate,
    },
  } as unknown as ApplicationApiDatabase;

  return {
    database,
    storage,
    ticketFindUnique,
    attachmentFindUnique,
    attachmentFindMany,
    attachmentUpdate,
  };
}

describe('Lab 2 Ticket Detail API', () => {
  it('returns owned read-only Ticket fields and active plus removed attachment metadata', async () => {
    const { database } = createDetailHarness();

    const response = await request(createApp(database)).get('/api/tickets/42?requesterId=1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ticket: {
        id: 42,
        ticketNumber: 'TKT-2026-000042',
        ticketDate: ticketDate.toISOString(),
        requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
        category: { id: 2, name: 'Hardware' },
        relatedSystem: { id: 7, name: 'Corporate Laptop' },
        summary: 'Laptop battery drains quickly',
        description: 'The battery drains while the laptop is idle.',
        requestedPriority: 'MEDIUM',
        itPriority: null,
        currentStatus: 'NEW',
        createdAt: ticketDate.toISOString(),
        updatedAt: ticketDate.toISOString(),
      },
      attachments: [
        expect.objectContaining({
          id: 7,
          originalName: 'evidence.pdf',
          downloadAvailable: true,
        }),
        expect.objectContaining({
          id: 8,
          originalName: 'old-screenshot.png',
          removedAt: removedAt.toISOString(),
          removalReason: 'Uploaded the wrong document',
          downloadAvailable: false,
        }),
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain('storageKey');
  });

  it('uses the same safe 404 for a foreign Ticket that exists', async () => {
    const { database } = createDetailHarness();

    const response = await request(createApp(database)).get('/api/tickets/42?requesterId=2');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Ticket not found.' });
  });

  it('uses the same safe 404 for a missing Ticket', async () => {
    const { database, ticketFindUnique } = createDetailHarness();
    ticketFindUnique.mockResolvedValue(null);

    const response = await request(createApp(database)).get('/api/tickets/42?requesterId=1');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Ticket not found.' });
  });

  it('rejects malformed Ticket Detail identifiers with a safe 400', async () => {
    const { database } = createDetailHarness();

    const response = await request(createApp(database)).get('/api/tickets/not-a-ticket?requesterId=1');

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });
});

describe('Lab 2 Attachment metadata and content API', () => {
  it('returns owned active metadata without exposing the storage key', async () => {
    const { database } = createDetailHarness();

    const response = await request(createApp(database)).get('/api/attachments/7?requesterId=1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      attachment: {
        id: 7,
        ticketId: 42,
        originalName: 'evidence.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 7,
        uploadedAt: ticketDate.toISOString(),
        removedAt: null,
        removalReason: null,
        downloadAvailable: true,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('storageKey');
  });

  it('keeps removed metadata readable but marks content unavailable', async () => {
    const { database } = createDetailHarness();

    const response = await request(createApp(database)).get('/api/attachments/8?requesterId=1');

    expect(response.status).toBe(200);
    expect(response.body.attachment).toMatchObject({
      id: 8,
      originalName: 'old-screenshot.png',
      removedAt: removedAt.toISOString(),
      removalReason: 'Uploaded the wrong document',
      downloadAvailable: false,
    });
  });

  it('returns active bytes with inline disposition and safe download headers', async () => {
    const { database, storage } = createDetailHarness();

    const response = await request(createApp(database, { attachmentStorage: storage }))
      .get('/api/attachments/7/download?requesterId=1&disposition=inline');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe('inline; filename="evidence.pdf"');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toContain('private');
    expect(response.body).toEqual(Buffer.from('%PDF-1.7 test bytes'));
    expect(storage.read).toHaveBeenCalledWith(activeAttachment.storageKey);
  });

  it('uses the same safe 404 for removed, foreign, and missing content', async () => {
    const { database, storage, attachmentFindUnique } = createDetailHarness();
    const app = createApp(database, { attachmentStorage: storage });

    const removedResponse = await request(app).get('/api/attachments/8/download?requesterId=1');
    expect(removedResponse.status).toBe(404);
    expect(removedResponse.body).toEqual({ error: 'Attachment not found.' });
    expect(storage.read).not.toHaveBeenCalled();

    const foreignResponse = await request(app).get('/api/attachments/7/download?requesterId=2');
    expect(foreignResponse.status).toBe(404);
    expect(foreignResponse.body).toEqual({ error: 'Attachment not found.' });

    const missingResponse = await request(app).get('/api/attachments/999/download?requesterId=1');
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toEqual({ error: 'Attachment not found.' });
  });

  it('rejects unsupported content disposition with a safe 400', async () => {
    const { database } = createDetailHarness();

    const response = await request(createApp(database))
      .get('/api/attachments/7/download?requesterId=1&disposition=preview');

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
  });

  it('soft-removes an owned Attachment, keeps its metadata, and records a trimmed reason', async () => {
    const { database, attachmentUpdate } = createDetailHarness();

    const response = await request(createApp(database))
      .delete('/api/attachments/7')
      .send({ requesterId: 1, removalReason: '  Uploaded the wrong document  ' });

    expect(response.status).toBe(200);
    expect(response.body.attachment).toMatchObject({
      id: 7,
      originalName: 'evidence.pdf',
      removalReason: 'Uploaded the wrong document',
      downloadAvailable: false,
    });
    expect(response.body.attachment.removedAt).toEqual(expect.any(String));
    expect(attachmentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({ removalReason: 'Uploaded the wrong document' }),
    }));
  });

  it.each([
    ['too short', 'nope'],
    ['too long', 'x'.repeat(501)],
  ])('rejects a %s removal reason without updating metadata', async (_label, removalReason) => {
    const { database, attachmentUpdate } = createDetailHarness();

    const response = await request(createApp(database))
      .delete('/api/attachments/7')
      .send({ requesterId: 1, removalReason });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(attachmentUpdate).not.toHaveBeenCalled();
  });

  it('rejects a repeated removal with 409 and foreign removal with safe 404', async () => {
    const { database, attachmentFindUnique } = createDetailHarness();
    attachmentFindUnique.mockResolvedValueOnce(removedAttachment);

    const repeatedResponse = await request(createApp(database))
      .delete('/api/attachments/8')
      .send({ requesterId: 1, removalReason: 'Another valid reason' });
    expect(repeatedResponse.status).toBe(409);
    expect(repeatedResponse.body.error).toEqual(expect.any(String));

    attachmentFindUnique.mockResolvedValueOnce(activeAttachment);
    const foreignResponse = await request(createApp(database))
      .delete('/api/attachments/7')
      .send({ requesterId: 2, removalReason: 'Another valid reason' });
    expect(foreignResponse.status).toBe(404);
    expect(foreignResponse.body).toEqual({ error: 'Attachment not found.' });
  });
});
