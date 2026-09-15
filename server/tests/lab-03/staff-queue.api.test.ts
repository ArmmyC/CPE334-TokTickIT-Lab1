import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  createAuthTestHarness,
  withAuthDatabase,
} from './auth-test-harness.js';

const ticketDate = new Date('2026-09-08T10:00:00.000Z');
const updatedAt = new Date('2026-09-08T11:00:00.000Z');

const queueTicket = {
  id: 12,
  ticketNumber: 'TKT-2026-000012',
  ticketDate,
  summary: 'Campus Wi-Fi disconnects',
  description: 'The connection drops repeatedly in the engineering lab.',
  requester: {
    id: 1,
    name: 'Ariya Anderson',
    email: 'ariya@example.test',
  },
  category: {
    id: 2,
    name: 'Network',
  },
  relatedSystem: {
    id: 5,
    name: 'Campus Wi-Fi',
  },
  requestedPriority: 'HIGH',
  itPriority: 'URGENT',
  currentStatus: 'IN_PROGRESS',
  owner: {
    id: 3,
    name: 'Somsak Staff',
    role: 'IT_STAFF',
  },
  updatedAt,
};

async function createStaffQueueHarness({
  userOverrides = [],
  items = [queueTicket],
  totalItems = items.length,
}: {
  userOverrides?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  totalItems?: number;
} = {}) {
  const auth = await createAuthTestHarness(userOverrides);
  const categoryFindUnique = vi.fn().mockResolvedValue({ id: 2, isActive: true });
  const relatedSystemFindUnique = vi.fn().mockResolvedValue({ id: 5, isActive: true });
  const findMany = vi.fn().mockResolvedValue(items);
  const count = vi.fn().mockResolvedValue(totalItems);
  const database = withAuthDatabase({
    category: {
      findMany: vi.fn(),
      findUnique: categoryFindUnique,
    },
    relatedSystem: {
      findMany: vi.fn(),
      findUnique: relatedSystemFindUnique,
    },
    ticket: {
      findMany,
      count,
    },
  }, auth.database);

  return {
    ...auth,
    app: createApp(database),
    categoryFindUnique,
    relatedSystemFindUnique,
    findMany,
    count,
  };
}

describe('Lab 3 Staff Ticket Queue API', () => {
  it('returns the documented queue item and default pagination for an active IT Staff user', async () => {
    const harness = await createStaffQueueHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent.get('/api/staff/tickets');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{
        id: 12,
        ticketNumber: 'TKT-2026-000012',
        ticketDate: '2026-09-08T10:00:00.000Z',
        summary: 'Campus Wi-Fi disconnects',
        requester: {
          id: 1,
          name: 'Ariya Anderson',
          email: 'ariya@example.test',
        },
        category: {
          id: 2,
          name: 'Network',
        },
        relatedSystem: {
          id: 5,
          name: 'Campus Wi-Fi',
        },
        requestedPriority: 'HIGH',
        itPriority: 'URGENT',
        currentStatus: 'IN_PROGRESS',
        owner: {
          id: 3,
          name: 'Somsak Staff',
          role: 'IT_STAFF',
        },
        updatedAt: '2026-09-08T11:00:00.000Z',
      }],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(harness.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 20,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }));
  });

  it('applies staff search, filters, deterministic sorting, and pagination metadata', async () => {
    const harness = await createStaffQueueHarness({ totalItems: 23 });
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent
      .get('/api/staff/tickets')
      .query({
        page: 2,
        pageSize: 10,
        search: '  campus  ',
        status: 'WAITING_FOR_REQUESTER',
        requestedPriority: 'HIGH',
        itPriority: 'UNASSIGNED',
        ownerId: 'UNASSIGNED',
        categoryId: 2,
        relatedSystemId: 5,
        sortBy: 'itPriority',
        sortOrder: 'asc',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 2,
      pageSize: 10,
      totalItems: 23,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });

    const expectedWhere = {
      OR: [
        { ticketNumber: { contains: 'campus', mode: 'insensitive' } },
        { summary: { contains: 'campus', mode: 'insensitive' } },
        { description: { contains: 'campus', mode: 'insensitive' } },
        { requester: { name: { contains: 'campus', mode: 'insensitive' } } },
        { requester: { email: { contains: 'campus', mode: 'insensitive' } } },
      ],
      currentStatus: 'WAITING_FOR_REQUESTER',
      requestedPriority: 'HIGH',
      itPriority: null,
      ownerId: null,
      categoryId: 2,
      relatedSystemId: 5,
    };
    expect(harness.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      skip: 10,
      take: 10,
      orderBy: [{ itPriority: 'asc' }, { id: 'asc' }],
    }));
    expect(harness.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(harness.categoryFindUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { id: true, isActive: true },
    });
    expect(harness.relatedSystemFindUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      select: { id: true, isActive: true },
    });
  });

  it('rejects invalid query values with field errors before reading queue data', async () => {
    const harness = await createStaffQueueHarness();
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent
      .get('/api/staff/tickets')
      .query({
        page: 0,
        pageSize: 15,
        search: 'x'.repeat(121),
        status: 'NOT_A_STATUS',
        requestedPriority: 'NOT_A_PRIORITY',
        itPriority: 'NOT_A_PRIORITY',
        ownerId: 0,
        sortBy: 'not-a-field',
        sortOrder: 'sideways',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: {
        page: expect.any(String),
        pageSize: expect.any(String),
        search: expect.any(String),
        status: expect.any(String),
        requestedPriority: expect.any(String),
        itPriority: expect.any(String),
        ownerId: expect.any(String),
        sortBy: expect.any(String),
        sortOrder: expect.any(String),
      },
    });
    expect(harness.findMany).not.toHaveBeenCalled();
    expect(harness.count).not.toHaveBeenCalled();
  });

  it('rejects an inactive category or related system as a validation error', async () => {
    const harness = await createStaffQueueHarness();
    harness.categoryFindUnique.mockResolvedValueOnce(null);
    const staff = await harness.login(harness.app, 'somsak@example.test');

    const response = await staff.agent
      .get('/api/staff/tickets')
      .query({ categoryId: 999 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: {
        categoryId: expect.any(String),
      },
    });
    expect(harness.findMany).not.toHaveBeenCalled();
    expect(harness.count).not.toHaveBeenCalled();
  });

  it('returns safe authentication and role failures without touching queue data', async () => {
    const harness = await createStaffQueueHarness();

    const unauthenticated = await request(harness.app).get('/api/staff/tickets');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({
      error: 'Authentication is required.',
      code: 'AUTHENTICATION_REQUIRED',
    });

    const requester = await harness.login(harness.app, 'ariya@example.test');
    const requesterResponse = await requester.agent.get('/api/staff/tickets');
    expect(requesterResponse.status).toBe(403);
    expect(requesterResponse.body).toEqual({
      error: 'You do not have permission to access this resource.',
      code: 'FORBIDDEN',
    });

    const adminHarness = await createStaffQueueHarness({
      userOverrides: [{}, {}, { role: 'ADMINISTRATOR' }],
    });
    const admin = await adminHarness.login(adminHarness.app, 'somsak@example.test');
    const adminResponse = await admin.agent.get('/api/staff/tickets');
    expect(adminResponse.status).toBe(403);
    expect(adminResponse.body).toEqual({
      error: 'You do not have permission to access this resource.',
      code: 'FORBIDDEN',
    });

    expect(harness.findMany).not.toHaveBeenCalled();
    expect(harness.count).not.toHaveBeenCalled();
    expect(adminHarness.findMany).not.toHaveBeenCalled();
    expect(adminHarness.count).not.toHaveBeenCalled();
  });

  it('rejects inactive Staff accounts and returns a safe server failure', async () => {
    const inactiveHarness = await createStaffQueueHarness({
      userOverrides: [{}, {}, { isActive: false }],
    });
    const inactiveLogin = await request(inactiveHarness.app)
      .post('/api/auth/login')
      .send({ email: 'somsak@example.test', password: 'Initial-password1!' });
    expect(inactiveLogin.status).toBe(401);
    expect(inactiveLogin.body).toEqual({
      error: 'Email or password is incorrect.',
      code: 'AUTHENTICATION_FAILED',
    });

    const unavailableHarness = await createStaffQueueHarness();
    unavailableHarness.findMany.mockRejectedValueOnce(new Error('database unavailable'));
    const staff = await unavailableHarness.login(unavailableHarness.app, 'somsak@example.test');
    const response = await staff.agent.get('/api/staff/tickets');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Unable to load Staff Ticket Queue.',
      code: 'UNEXPECTED_ERROR',
    });
  });
});
