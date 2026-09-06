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
