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

function createUploadHarness() {
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

  return { database, storage };
}

function createAttachmentHarness() {
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
    attachmentFindUnique,
    attachmentUpdate,
  };
}

describe('Lab 2 attachment upload API', () => {
  it('stores a permitted attachment and returns metadata without the storage key', async () => {
    const { database, storage } = createUploadHarness();

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
    const { database, storage } = createUploadHarness();
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
    const { database, storage } = createUploadHarness();

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
    const { database, storage } = createUploadHarness();
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
    const { database, storage } = createUploadHarness();
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
    const { database, storage } = createUploadHarness();
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
});

describe('Lab 2 attachment metadata and content API', () => {
  it('returns owned active metadata without exposing the storage key', async () => {
    const { database } = createAttachmentHarness();

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
    const { database } = createAttachmentHarness();

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
    const { database, storage } = createAttachmentHarness();

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
    const { database, storage, attachmentFindUnique } = createAttachmentHarness();
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
    const { database } = createAttachmentHarness();

    const response = await request(createApp(database))
      .get('/api/attachments/7/download?requesterId=1&disposition=preview');

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
  });

  it('soft-removes an owned Attachment, keeps its metadata, and records a trimmed reason', async () => {
    const { database, attachmentUpdate } = createAttachmentHarness();

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
    const { database, attachmentUpdate } = createAttachmentHarness();

    const response = await request(createApp(database))
      .delete('/api/attachments/7')
      .send({ requesterId: 1, removalReason });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(attachmentUpdate).not.toHaveBeenCalled();
  });

  it('rejects a repeated removal with 409 and foreign removal with safe 404', async () => {
    const { database, attachmentFindUnique } = createAttachmentHarness();
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
