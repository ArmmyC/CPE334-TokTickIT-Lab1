import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { assertTestDatabaseUrl } from './test-db-guard.mjs';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const testEnvPath = path.join(repositoryRoot, '.env.test');
const loaded = config({ path: testEnvPath, override: true });

if (loaded.error) {
  console.error('Missing .env.test. Copy .env.test.example and set the dedicated test database credentials.');
  process.exit(1);
}

let databaseUrl;
try {
  databaseUrl = assertTestDatabaseUrl(loaded.parsed?.DATABASE_URL);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid test database configuration.');
  process.exit(1);
}

const childEnvironment = {
  ...process.env,
  ...loaded.parsed,
  DATABASE_URL: databaseUrl.toString(),
};
const serverDirectory = path.join(repositoryRoot, 'server');
const npxCommand = process.platform === 'win32'
  ? process.execPath
  : 'npx';
const npxPrefix = process.platform === 'win32'
  ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
  : [];
const truncateSql = `
DO $$
DECLARE
  target_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
  INTO target_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';

  IF target_tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || target_tables || ' RESTART IDENTITY CASCADE';
  END IF;
END
$$;
`;

const commands = [
  { args: ['prisma', 'migrate', 'deploy'] },
  ...(process.env.TOKTICKIT_SKIP_PRISMA_GENERATE === '1'
    ? []
    : [{ args: ['prisma', 'generate'] }]),
  {
    args: ['prisma', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'],
    input: truncateSql,
  },
  { args: ['tsx', 'prisma/seed.ts'] },
];

for (const { args, input } of commands) {
  const result = spawnSync(npxCommand, [...npxPrefix, ...args], {
    cwd: serverDirectory,
    env: childEnvironment,
    ...(input === undefined
      ? { stdio: 'inherit' }
      : { input, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] }),
  });
  if (result.error) {
    console.error(`Unable to run ${npxCommand} ${[...npxPrefix, ...args].join(' ')}.`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Prepared and seeded the dedicated TokTickIT test database.');
