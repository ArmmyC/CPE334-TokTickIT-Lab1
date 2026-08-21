import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type ApplicationApiDatabase } from '../../src/app.js';

const firstUpdatedAt = new Date('2026-08-21T10:00:00.000Z');
const secondUpdatedAt = new Date('2026-08-20T10:00:00.000Z');

const rows = [
  {
    id: 42,
    ticketNumber: 'TKT-2026-000042',
    ticketDate: firstUpdatedAt,
    summary: 'Laptop battery drains quickly',
    category: { id: 2, name: 'Hardware' },
    relatedSystem: { id: 7, name: 'Corporate Laptop' },
    requestedPriority: 'MEDIUM',
    itPriority: null,
    currentStatus: 'NEW',
    updatedAt: firstUpdatedAt,
  },
  {
    id: 41,
    ticketNumber: 'TKT-2026-000041',
    ticketDate: secondUpdatedAt,
    summary: 'VPN access request',
    category: { id: 3, name: 'Software' },
    relatedSystem: { id: 5, name: 'VPN' },
    requestedPriority: 'LOW',
    itPriority: null,
    currentStatus: 'NEW',
    updatedAt: secondUpdatedAt,
  },
];

function createListHarness() {
  const findMany = vi.fn().mockResolvedValue(rows);
  const count = vi.fn().mockResolvedValue(rows.length);
  const requesterFindUnique = vi.fn().mockResolvedValue({ id: 1, isActive: true });
  const categoryFindUnique = vi.fn().mockResolvedValue({ id: 2, isActive: true });
  const relatedSystemFindUnique = vi.fn().mockResolvedValue({ id: 7, isActive: true });
  const database = {
    category: { findMany: vi.fn(), findUnique: categoryFindUnique },
    relatedSystem: { findMany: vi.fn(), findUnique: relatedSystemFindUnique },
    developmentRequester: { findMany: vi.fn(), findUnique: requesterFindUnique },
    ticket: { findMany, count },
  } as unknown as ApplicationApiDatabase;

  return {
    database,
    findMany,
    count,
    requesterFindUnique,
    categoryFindUnique,
    relatedSystemFindUnique,
  };
}

describe('Lab 2 My Tickets list API', () => {
  it('returns an owned, paginated list with stable default sorting and safe fields', async () => {
    const { database, findMany, count } = createListHarness();

    const response = await request(createApp(database)).get('/api/tickets?requesterId=1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [
        { ...rows[0], ticketDate: firstUpdatedAt.toISOString(), updatedAt: firstUpdatedAt.toISOString() },
        { ...rows[1], ticketDate: secondUpdatedAt.toISOString(), updatedAt: secondUpdatedAt.toISOString() },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requesterId: 1 },
      skip: 0,
      take: 10,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }));
    expect(count).toHaveBeenCalledWith({ where: { requesterId: 1 } });
  });

  it('applies trimmed search, every filter, ascending sort, and requested pagination', async () => {
    const { database, findMany, count } = createListHarness();
    count.mockResolvedValue(21);
    findMany.mockResolvedValue([rows[1]]);

    const response = await request(createApp(database)).get(
      '/api/tickets?requesterId=1&page=2&pageSize=20&search=%20VPN%20&categoryId=2&relatedSystemId=7&requestedPriority=URGENT&currentStatus=NEW&sortBy=ticketNumber&sortOrder=asc',
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [{ ...rows[1], ticketDate: secondUpdatedAt.toISOString(), updatedAt: secondUpdatedAt.toISOString() }],
      page: 2,
      pageSize: 20,
      totalItems: 21,
      totalPages: 2,
      hasNext: false,
      hasPrevious: true,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        requesterId: 1,
        OR: [
          { ticketNumber: { contains: 'VPN', mode: 'insensitive' } },
          { summary: { contains: 'VPN', mode: 'insensitive' } },
          { description: { contains: 'VPN', mode: 'insensitive' } },
        ],
        categoryId: 2,
        relatedSystemId: 7,
        requestedPriority: 'URGENT',
        currentStatus: 'NEW',
      },
      skip: 20,
      take: 20,
      orderBy: [{ ticketNumber: 'asc' }, { id: 'desc' }],
    }));
    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: 1, categoryId: 2 }),
    }));
  });

  it('returns an empty page beyond the final page with accurate totals', async () => {
    const { database, findMany, count } = createListHarness();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(1);

    const response = await request(createApp(database)).get('/api/tickets?requesterId=1&page=3&pageSize=10');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      page: 3,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: true,
    });
  });

  it.each([
    ['missing requester', '/api/tickets', 'requesterId'],
    ['malformed requester', '/api/tickets?requesterId=abc', 'requesterId'],
    ['invalid page', '/api/tickets?requesterId=1&page=0', 'page'],
    ['invalid page size', '/api/tickets?requesterId=1&pageSize=15', 'pageSize'],
    ['long search', `/api/tickets?requesterId=1&search=${'x'.repeat(121)}`, 'search'],
    ['invalid category', '/api/tickets?requesterId=1&categoryId=0', 'categoryId'],
    ['invalid priority', '/api/tickets?requesterId=1&requestedPriority=ASAP', 'requestedPriority'],
    ['invalid status', '/api/tickets?requesterId=1&currentStatus=OPEN', 'currentStatus'],
    ['invalid sort field', '/api/tickets?requesterId=1&sortBy=summary', 'sortBy'],
    ['invalid sort order', '/api/tickets?requesterId=1&sortOrder=sideways', 'sortOrder'],
  ])('rejects %s with a safe 400 field error', async (_label, url, field) => {
    const { database, findMany, count } = createListHarness();

    const response = await request(createApp(database)).get(url);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Please correct the Ticket list query.');
    expect(response.body.fieldErrors[field]).toEqual(expect.any(String));
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('rejects inactive requester and inactive reference filters without querying Tickets', async () => {
    const { database, requesterFindUnique, categoryFindUnique, findMany } = createListHarness();
    requesterFindUnique.mockResolvedValueOnce({ id: 1, isActive: false });

    const requesterResponse = await request(createApp(database)).get('/api/tickets?requesterId=1');
    expect(requesterResponse.status).toBe(400);
    expect(requesterResponse.body.fieldErrors.requesterId).toEqual(expect.any(String));

    requesterFindUnique.mockResolvedValue({ id: 1, isActive: true });
    categoryFindUnique.mockResolvedValueOnce({ id: 2, isActive: false });
    const categoryResponse = await request(createApp(database)).get('/api/tickets?requesterId=1&categoryId=2');
    expect(categoryResponse.status).toBe(400);
    expect(categoryResponse.body.fieldErrors.categoryId).toEqual(expect.any(String));
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns a safe 500 when the database list query fails', async () => {
    const { database, findMany } = createListHarness();
    findMany.mockRejectedValue(new Error('database unavailable'));

    const response = await request(createApp(database)).get('/api/tickets?requesterId=1');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Unable to load Tickets.' });
  });
});
