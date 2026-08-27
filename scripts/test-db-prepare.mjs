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
const commands = [
  ['prisma', 'migrate', 'reset', '--force', '--skip-seed'],
  ['prisma', 'migrate', 'deploy'],
  ['tsx', 'prisma/seed.ts'],
];

for (const args of commands) {
  const result = spawnSync(npxCommand, [...npxPrefix, ...args], {
    cwd: serverDirectory,
    env: childEnvironment,
    stdio: 'inherit',
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
