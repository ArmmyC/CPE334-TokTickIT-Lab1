const TEST_DATABASE_PATH = '/toktickit_test';

export function assertTestDatabaseUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('DATABASE_URL must point to the dedicated /toktickit_test database.');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL for /toktickit_test.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.pathname !== TEST_DATABASE_PATH) {
    throw new Error('DATABASE_URL must point to the dedicated /toktickit_test database.');
  }

  return parsed;
}
