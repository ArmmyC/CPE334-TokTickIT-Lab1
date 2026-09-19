import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AttachmentStorage } from '../../src/lib/attachment-storage.js';
import {
  createAuthTestHarness,
  withAuthDatabase,
} from './auth-test-harness.js';

const ticketDate = new Date('2026-09-08T10:00:00.000Z');
const commentDate = new Date('2026-09-08T11:10:00.000Z');
const noteDate = new Date('2026-09-08T11:15:00.000Z');
type TestAuthorRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

const attachment = {
  id: 7,
  ticketId: 12,
  originalName: 'evidence.pdf',
  storageKey: '11111111-1111-4111-8111-111111111111',
  mimeType: 'application/pdf',
  sizeBytes: 12000,
  uploadedAt: ticketDate,
  removedAt: null,
  removalReason: null,
};

const publicCommentFixture = {
  id: 4,
  ticketId: 12,
  authorId: 1,
  content: 'The issue still occurs after restarting.',
  createdAt: commentDate,
  author: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' as TestAuthorRole },
};

const internalNoteFixture = {
  id: 7,
  ticketId: 12,
  authorId: 3,
  content: 'Waiting for network team confirmation.',
  createdAt: noteDate,
  author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' as const },
};

const ticketFixture = {
  id: 12,
  ticketNumber: 'TKT-2026-000012',
  ticketDate,
  requesterId: 1,
  ownerId: 3,
  requesterResolvedAt: null as Date | null,
  requesterResolvedById: null as number | null,
  requesterResolvedBy: null as {
    id: number;
    name: string;
    role: TestAuthorRole;
  } | null,
  categoryId: 2,
  relatedSystemId: 5,
  summary: 'Campus Wi-Fi disconnects',
  description: 'The wireless connection drops every few minutes in the engineering lab.',
  requestedPriority: 'HIGH' as const,
  itPriority: 'HIGH' as const,
  currentStatus: 'NEW' as const,
  createdAt: ticketDate,
  updatedAt: ticketDate,
  requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
  owner: {
    id: 3,
    name: 'Somsak Staff',
    email: 'somsak@example.test',
    role: 'IT_STAFF' as const,
  },
  category: { id: 2, name: 'Network' },
  relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
};

async function createCommunicationHarness({ administrator = false } = {}) {
  const auth = await createAuthTestHarness(administrator ? [{}, {}, { role: 'ADMINISTRATOR' }] : []);
  const ticket = structuredClone(ticketFixture);
  const comments = [structuredClone(publicCommentFixture)];
  const notes = [structuredClone(internalNoteFixture)];
  const ticketFindUnique = vi.fn().mockImplementation(({ where }: { where: { id: number } }) => (
    Promise.resolve(where.id === 12 ? ticket : null)
  ));
  const ticketUpdate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    Object.assign(ticket, data);
    if ('requesterResolvedById' in data && data.requesterResolvedById === 1) {
      ticket.requesterResolvedBy = {
        id: 1,
        name: 'Ariya Anderson',
        role: 'REQUESTER' as TestAuthorRole,
      };
    }
    return Promise.resolve(ticket);
  });
  const publicCommentFindMany = vi.fn().mockResolvedValue(comments);
  const publicCommentCreate = vi.fn().mockImplementation(({ data }: {
    data: { ticketId: number; authorId: number; content: string };
  }) => {
    const author = data.authorId === 1
      ? { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' as TestAuthorRole }
      : { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' as TestAuthorRole };
    const created = {
      id: 10 + comments.length,
      ...data,
      createdAt: new Date('2026-09-08T11:30:00.000Z'),
      author,
    };
    comments.push(created);
    return Promise.resolve(created);
  });
  const internalNoteFindMany = vi.fn().mockResolvedValue(notes);
  const internalNoteCreate = vi.fn().mockImplementation(({ data }: {
    data: { ticketId: number; authorId: number; content: string };
  }) => {
    const created = {
      id: 20 + notes.length,
      ...data,
      createdAt: new Date('2026-09-08T11:35:00.000Z'),
      author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' as const },
    };
    notes.push(created);
    return Promise.resolve(created);
  });
  const attachmentFindUnique = vi.fn().mockResolvedValue(attachment);
  const attachmentFindMany = vi.fn().mockResolvedValue([attachment]);
  const storage: AttachmentStorage = {
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7 test bytes')),
  };
  const database = withAuthDatabase({
    category: { findMany: vi.fn() },
    relatedSystem: { findMany: vi.fn() },
    ticket: { findUnique: ticketFindUnique, update: ticketUpdate },
    attachment: { findUnique: attachmentFindUnique, findMany: attachmentFindMany },
    publicComment: { findMany: publicCommentFindMany, create: publicCommentCreate },
    internalNote: { findMany: internalNoteFindMany, create: internalNoteCreate },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database, { attachmentStorage: storage }),
    ticket,
    ticketUpdate,
    publicCommentFindMany,
    publicCommentCreate,
    internalNoteFindMany,
    internalNoteCreate,
    attachmentFindUnique,
    storage,
  };
}

describe('Lab 3 Ticket communication and resolution API', () => {
  it('includes public communication, requester resolution, and attachments in the authenticated requester detail', async () => {
    const harness = await createCommunicationHarness();
    const requester = await harness.login(harness.app, 'ariya@example.test');

    const response = await requester.agent.get('/api/tickets/12');

    expect(response.status).toBe(200);
    expect(response.body.ticket).toMatchObject({
      attachments: [{ id: 7, originalName: 'evidence.pdf', downloadAvailable: true }],
      publicComments: [{
        id: 4,
        content: 'The issue still occurs after restarting.',
        author: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
      }],
      requesterResolution: null,
    });
    expect(response.body.attachments).toBeUndefined();
  });

  it('lets IT Staff append and retrieve attributed Public Comments and Internal Notes', async () => {
    const harness = await createCommunicationHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const commentResponse = await staff.agent
      .post('/api/staff/tickets/12/comments')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ content: '  Staff update  ' });
    expect(commentResponse.status).toBe(201);
    expect(commentResponse.body.comment).toMatchObject({
      content: 'Staff update',
      author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
    });
    expect(harness.publicCommentCreate).toHaveBeenCalledWith({
      data: { ticketId: 12, authorId: 3, content: 'Staff update' },
    });

    const noteResponse = await staff.agent
      .post('/api/staff/tickets/12/notes')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ content: '  Private investigation  ' });
    expect(noteResponse.status).toBe(201);
    expect(noteResponse.body.note).toMatchObject({
      content: 'Private investigation',
      author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
    });
    expect(harness.internalNoteCreate).toHaveBeenCalledWith({
      data: { ticketId: 12, authorId: 3, content: 'Private investigation' },
    });

    const commentsResponse = await staff.agent.get('/api/staff/tickets/12/comments');
    expect(commentsResponse.status).toBe(200);
    expect(commentsResponse.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: 'The issue still occurs after restarting.' }),
      expect.objectContaining({ content: 'Staff update' }),
    ]));

    const notesResponse = await staff.agent.get('/api/staff/tickets/12/notes');
    expect(notesResponse.status).toBe(200);
    expect(notesResponse.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: 'Waiting for network team confirmation.' }),
      expect.objectContaining({ content: 'Private investigation' }),
    ]));
  });

  it('rejects unsafe communication content and restricts Internal Notes to IT Staff and Administrators', async () => {
    const harness = await createCommunicationHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    for (const content of ['   ', 'x'.repeat(4001)]) {
      const response = await staff.agent
        .post('/api/staff/tickets/12/notes')
        .set('X-CSRF-Token', staff.csrfToken)
        .send({ content });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fieldErrors: { content: expect.any(String) },
      });
    }
    expect(harness.internalNoteCreate).not.toHaveBeenCalled();

    const requester = await harness.login(harness.app, 'ariya@example.test');
    const requesterNotes = await requester.agent.get('/api/staff/tickets/12/notes');
    expect(requesterNotes.status).toBe(403);
    expect(requesterNotes.body).toEqual({
      error: 'You do not have permission to access this resource.',
      code: 'FORBIDDEN',
    });

    const foreignRequester = await harness.login(harness.app, 'mali@example.test');
    const foreignComments = await foreignRequester.agent.get('/api/tickets/12/comments');
    expect(foreignComments.status).toBe(404);
    expect(foreignComments.body).toEqual({
      error: 'Ticket not found.',
      code: 'TICKET_NOT_FOUND',
    });
  });

  it('lets the owning Requester add a Public Comment and record resolution without changing formal status', async () => {
    const harness = await createCommunicationHarness();
    const requester = await harness.login(harness.app, 'ariya@example.test');

    const commentResponse = await requester.agent
      .post('/api/tickets/12/comments')
      .set('X-CSRF-Token', requester.csrfToken)
      .send({ content: '  The issue is still present.  ' });
    expect(commentResponse.status).toBe(201);
    expect(harness.publicCommentCreate).toHaveBeenCalledWith({
      data: { ticketId: 12, authorId: 1, content: 'The issue is still present.' },
    });

    const resolutionResponse = await requester.agent
      .post('/api/tickets/12/requester-resolution')
      .set('X-CSRF-Token', requester.csrfToken)
      .send({ requesterId: 2 });
    expect(resolutionResponse.status).toBe(200);
    expect(resolutionResponse.body.requesterResolution).toMatchObject({
      resolvedBy: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
    });
    expect(harness.ticket.currentStatus).toBe('NEW');
    expect(harness.ticketUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { requesterResolvedAt: expect.any(Date), requesterResolvedById: 1 },
    });

    const repeatedResponse = await requester.agent
      .post('/api/tickets/12/requester-resolution')
      .set('X-CSRF-Token', requester.csrfToken)
      .send({});
    expect(repeatedResponse.status).toBe(409);
    expect(repeatedResponse.body).toEqual({
      error: 'The resolution indication has already been recorded.',
      code: 'RESOLUTION_ALREADY_RECORDED',
    });
  });

  it('allows Staff and Administrators to read Attachments but keeps Requester mutations restricted', async () => {
    const harness = await createCommunicationHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const metadataResponse = await staff.agent.get('/api/attachments/7');
    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.body.attachment).toMatchObject({
      id: 7,
      originalName: 'evidence.pdf',
      downloadAvailable: true,
    });
    expect(JSON.stringify(metadataResponse.body)).not.toContain('storageKey');

    const downloadResponse = await staff.agent
      .get('/api/attachments/7/download')
      .query({ disposition: 'inline' });
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers['content-type']).toContain('application/pdf');
    expect(downloadResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(harness.storage.read).toHaveBeenCalledWith(attachment.storageKey);

    const uploadResponse = await staff.agent
      .post('/api/tickets/12/attachments')
      .set('X-CSRF-Token', staff.csrfToken);
    expect(uploadResponse.status).toBe(403);

    const adminHarness = await createCommunicationHarness({ administrator: true });
    const admin = await adminHarness.login(adminHarness.app, 'somsak@example.test');
    const adminNotes = await admin.agent.get('/api/staff/tickets/12/notes');
    expect(adminNotes.status).toBe(200);
    const adminAttachment = await admin.agent.get('/api/attachments/7');
    expect(adminAttachment.status).toBe(200);
    const adminCreateNote = await admin.agent
      .post('/api/staff/tickets/12/notes')
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ content: 'Not allowed.' });
    expect(adminCreateNote.status).toBe(403);
  });
});
