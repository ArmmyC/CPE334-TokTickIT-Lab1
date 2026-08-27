import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from '../../../scripts/test-db-guard.mjs';

describe('Lab 2 test database URL guard', () => {
  it.each([
    ['missing URL', undefined],
    ['empty URL', ''],
    ['malformed URL', 'not-a-database-url'],
    ['development database', 'postgresql://user:password@localhost:5433/toktickit?schema=public'],
    ['similarly named database', 'postgresql://user:password@localhost:5434/toktickit_test_backup?schema=public'],
    ['unsupported protocol', 'https://user:password@localhost:5434/toktickit_test?schema=public'],
  ])('rejects %s before preparation can run', (_label, value) => {
    expect(() => assertTestDatabaseUrl(value)).toThrow(/toktickit_test/);
  });

  it.each([
    'postgresql://user:password@localhost:5434/toktickit_test?schema=public',
    'postgres://user:password@localhost:5434/toktickit_test',
  ])('accepts a dedicated test database URL: %s', (value) => {
    expect(() => assertTestDatabaseUrl(value)).not.toThrow();
  });
});
