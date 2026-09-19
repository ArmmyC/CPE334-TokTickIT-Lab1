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

type OperationalStaffRole = 'IT_STAFF' | 'ADMINISTRATOR';

async function createOperationalHarness({ staffRole = 'IT_STAFF' }: { staffRole?: OperationalStaffRole } = {}) {
  const auth = await createAuthTestHarness(staffRole === 'IT_STAFF' ? [] : [{}, {}, { role: staffRole }]);
  type MutableDetailTicket = Omit<typeof detailTicket, 'owner'> & {
    owner: typeof detailTicket.owner | null;
  };
  const ticket = structuredClone(detailTicket) as MutableDetailTicket;
  const ticketFindUnique = vi.fn().mockResolvedValue(ticket);
  const ticketUpdate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    Object.assign(ticket, data, { updatedAt: new Date('2026-09-08T11:30:00.000Z') });
    if ('ownerId' in data) {
      ticket.owner = data.ownerId === null
        ? null
        : data.ownerId === 3
          ? {
              id: 3,
              name: 'Somsak Staff',
              email: 'somsak@example.test',
              role: 'IT_STAFF',
            }
          : null;
    }
    return Promise.resolve(ticket);
  });
  const database = withAuthDatabase({
    category: { findMany: vi.fn() },
    relatedSystem: { findMany: vi.fn() },
    ticket: { findUnique: ticketFindUnique, update: ticketUpdate },
    attachment: { findMany: vi.fn().mockResolvedValue(attachments) },
    publicComment: { findMany: vi.fn().mockResolvedValue(publicComments) },
    internalNote: { findMany: vi.fn().mockResolvedValue(internalNotes) },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database),
    ticket,
    ticketFindUnique,
    ticketUpdate,
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

  it('allows IT Staff to claim a Ticket, change IT Priority, and perform a confirmed valid transition', async () => {
    const harness = await createOperationalHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const ownerResponse = await staff.agent
      .patch('/api/staff/tickets/12/owner')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ ownerId: 3 });
    expect(ownerResponse.status).toBe(200);
    expect(harness.ticketUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { ownerId: 3 },
    });

    const priorityResponse = await staff.agent
      .patch('/api/staff/tickets/12/priority')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ itPriority: 'URGENT' });
    expect(priorityResponse.status).toBe(200);
    expect(harness.ticketUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { itPriority: 'URGENT' },
    });

    const statusResponse = await staff.agent
      .patch('/api/staff/tickets/12/status')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ currentStatus: 'RESOLVED', confirmed: true });
    expect(statusResponse.status).toBe(200);
    expect(harness.ticketUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { currentStatus: 'RESOLVED' },
    });
  });

  it('allows an Administrator to change only IT Priority', async () => {
    const harness = await createOperationalHarness({ staffRole: 'ADMINISTRATOR' });
    const admin = await harness.login(harness.app, 'somsak@example.test');

    const priorityResponse = await admin.agent
      .patch('/api/staff/tickets/12/priority')
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ itPriority: 'LOW' });
    expect(priorityResponse.status).toBe(200);

    const ownerResponse = await admin.agent
      .patch('/api/staff/tickets/12/owner')
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ ownerId: 3 });
    expect(ownerResponse.status).toBe(403);

    const statusResponse = await admin.agent
      .patch('/api/staff/tickets/12/status')
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ currentStatus: 'RESOLVED', confirmed: true });
    expect(statusResponse.status).toBe(403);
  });

  it('rejects ineligible owners and malformed operation payloads without updating the Ticket', async () => {
    const harness = await createOperationalHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const ineligibleOwner = await staff.agent
      .patch('/api/staff/tickets/12/owner')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ ownerId: 1 });
    expect(ineligibleOwner.status).toBe(409);
    expect(ineligibleOwner.body).toEqual({
      error: 'The selected Ticket owner is not eligible.',
      code: 'OWNER_NOT_ELIGIBLE',
    });

    const malformedPriority = await staff.agent
      .patch('/api/staff/tickets/12/priority')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ itPriority: 'NOT_A_PRIORITY' });
    expect(malformedPriority.status).toBe(400);
    expect(malformedPriority.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { itPriority: expect.any(String) },
    });

    const missingConfirmation = await staff.agent
      .patch('/api/staff/tickets/12/status')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ currentStatus: 'RESOLVED', confirmed: false });
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { confirmed: expect.any(String) },
    });

    expect(harness.ticketUpdate).not.toHaveBeenCalled();
  });

  it('returns a transition conflict with allowed statuses and leaves the Ticket unchanged', async () => {
    const harness = await createOperationalHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent
      .patch('/api/staff/tickets/12/status')
      .set('X-CSRF-Token', staff.csrfToken)
      .send({ currentStatus: 'CLOSED', confirmed: true });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'The requested status transition is not allowed.',
      code: 'STATUS_TRANSITION_CONFLICT',
      currentStatus: 'IN_PROGRESS',
      allowedStatuses: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
    });
    expect(harness.ticketUpdate).not.toHaveBeenCalled();
  });

  it('requires CSRF protection for Staff Ticket mutations', async () => {
    const harness = await createOperationalHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent
      .patch('/api/staff/tickets/12/priority')
      .send({ itPriority: 'LOW' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'The request could not be verified.',
      code: 'CSRF_VALIDATION_FAILED',
    });
    expect(harness.ticketUpdate).not.toHaveBeenCalled();
  });
});
