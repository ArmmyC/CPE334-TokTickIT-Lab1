import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type CategoryApiDatabase } from '../../src/app.js';

describe('TokTickIT categories API', () => {
  it('returns category IDs and names in ascending ID order', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 1, name: 'Account and Access' },
      { id: 2, name: 'Hardware' },
      { id: 3, name: 'Software' },
      { id: 4, name: 'Network' },
    ]);
    const database = {
      category: { findMany },
    } as unknown as CategoryApiDatabase;

    const response = await request(createApp(database)).get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 1, name: 'Account and Access' },
      { id: 2, name: 'Hardware' },
      { id: 3, name: 'Software' },
      { id: 4, name: 'Network' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
  });
});
