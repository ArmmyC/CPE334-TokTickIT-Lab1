import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  createAuthTestHarness,
  withAuthDatabase,
} from './auth-test-harness.js';

const ticketDate = new Date('2026-09-08T10:00:00.000Z');
const updatedAt = new Date('2026-09-08T11:00:00.000Z');
const commentDate = new Date('2026-09-08T11:10:00.000Z');
const noteDate = new Date('2026-09-08T11:15:00.000Z');
const resolutionDate = new Date('2026-09-08T11:20:00.000Z');

const detailTicket = {
  id: 12,
  ticketNumber: 'TKT-2026-000012',
  ticketDate,
  requesterId: 1,
  ownerId: 3,
  requesterResolvedAt: resolutionDate,
  requesterResolvedById: 1,
  categoryId: 2,
  relatedSystemId: 5,
  summary: 'Campus Wi-Fi disconnects',
  description: 'The wireless connection drops every few minutes in the engineering lab.',
  requestedPriority: 'HIGH',
  itPriority: 'URGENT',
  currentStatus: 'IN_PROGRESS',
  createdAt: ticketDate,
  updatedAt,
  requester: {
    id: 1,
    name: 'Ariya Anderson',
    email: 'ariya@example.test',
  },
  owner: {
    id: 3,
    name: 'Somsak Staff',
    email: 'somsak@example.test',
    role: 'IT_STAFF',
  },
  requesterResolvedBy: {
    id: 1,
    name: 'Ariya Anderson',
    role: 'REQUESTER',
  },
  category: { id: 2, name: 'Network' },
  relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
};

const attachments = [
  {
    id: 7,
    ticketId: 12,
    originalName: 'evidence.pdf',
    storageKey: '11111111-1111-4111-8111-111111111111',
    mimeType: 'application/pdf',
    sizeBytes: 12000,
    uploadedAt: ticketDate,
    removedAt: null,
    removalReason: null,
  },
];

const publicComments = [
  {
    id: 4,
    ticketId: 12,
    authorId: 1,
    content: 'The issue still occurs after restarting.',
    createdAt: commentDate,
    author: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
  },
];

const internalNotes = [
  {
    id: 7,
    ticketId: 12,
    authorId: 3,
    content: 'Waiting for network team confirmation.',
    createdAt: noteDate,
    author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
  },
];

async function createStaffDetailHarness() {
  const auth = await createAuthTestHarness();
  const ticketFindUnique = vi.fn().mockResolvedValue(detailTicket);
  const attachmentFindMany = vi.fn().mockResolvedValue(attachments);
  const publicCommentFindMany = vi.fn().mockResolvedValue(publicComments);
  const internalNoteFindMany = vi.fn().mockResolvedValue(internalNotes);
  const database = withAuthDatabase({
    category: { findMany: vi.fn() },
    relatedSystem: { findMany: vi.fn() },
    ticket: { findUnique: ticketFindUnique },
    attachment: { findMany: attachmentFindMany },
    publicComment: { findMany: publicCommentFindMany },
    internalNote: { findMany: internalNoteFindMany },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database),
    ticketFindUnique,
    attachmentFindMany,
    publicCommentFindMany,
    internalNoteFindMany,
  };
}

describe('Lab 3 Staff Ticket Detail API', () => {
  it('returns the documented protected detail with communication, attachments, owner, and resolution data', async () => {
    const harness = await createStaffDetailHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent.get('/api/staff/tickets/12');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ticket: {
        id: 12,
        ticketNumber: 'TKT-2026-000012',
        ticketDate: ticketDate.toISOString(),
        summary: 'Campus Wi-Fi disconnects',
        description: 'The wireless connection drops every few minutes in the engineering lab.',
        requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
        category: { id: 2, name: 'Network' },
        relatedSystem: { id: 5, name: 'Campus Wi-Fi' },
        requestedPriority: 'HIGH',
        itPriority: 'URGENT',
        currentStatus: 'IN_PROGRESS',
        owner: { id: 3, name: 'Somsak Staff', email: 'somsak@example.test', role: 'IT_STAFF' },
        attachments: [{
          id: 7,
          ticketId: 12,
          originalName: 'evidence.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12000,
          uploadedAt: ticketDate.toISOString(),
          removedAt: null,
          removalReason: null,
          downloadAvailable: true,
        }],
        publicComments: [{
          id: 4,
          content: 'The issue still occurs after restarting.',
          author: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
          createdAt: commentDate.toISOString(),
        }],
        internalNotes: [{
          id: 7,
          content: 'Waiting for network team confirmation.',
          author: { id: 3, name: 'Somsak Staff', role: 'IT_STAFF' },
          createdAt: noteDate.toISOString(),
        }],
        requesterResolution: {
          resolvedAt: resolutionDate.toISOString(),
          resolvedBy: { id: 1, name: 'Ariya Anderson', role: 'REQUESTER' },
        },
        createdAt: ticketDate.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('storageKey');
    expect(harness.attachmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticketId: 12 },
    }));
    expect(harness.publicCommentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticketId: 12 },
    }));
    expect(harness.internalNoteFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticketId: 12 },
    }));
  });

  it('keeps Staff Ticket Detail unavailable to unauthenticated and Requester users', async () => {
    const harness = await createStaffDetailHarness();

    const unauthenticated = await request(harness.app).get('/api/staff/tickets/12');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });

    const requester = await harness.login(harness.app, 'ariya@example.test');
    const requesterResponse = await requester.agent.get('/api/staff/tickets/12');
    expect(requesterResponse.status).toBe(403);
    expect(requesterResponse.body).toEqual({
      error: 'You do not have permission to access this resource.',
      code: 'FORBIDDEN',
    });
    expect(harness.ticketFindUnique).not.toHaveBeenCalled();
  });
});
