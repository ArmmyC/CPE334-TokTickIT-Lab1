import { describe, expect, it } from 'vitest';
import { CATEGORY_NAMES, type CategorySeedClient, seedCategories } from '../../src/lib/category-seed.js';

describe('TokTickIT category seed', () => {
  it('uses the four required request categories', async () => {
    const rows = new Map<string, { name: string }>();
    const createdNames: string[] = [];
    const database: CategorySeedClient = {
      category: {
        async upsert({ where, create }) {
          if (!rows.has(where.name)) {
            rows.set(where.name, create);
            createdNames.push(create.name);
          }

          return rows.get(where.name);
        },
      },
    };

    await seedCategories(database);
    await seedCategories(database);

    expect([...rows.keys()]).toEqual([...CATEGORY_NAMES]);
    expect(createdNames).toEqual([...CATEGORY_NAMES]);
  });
});
