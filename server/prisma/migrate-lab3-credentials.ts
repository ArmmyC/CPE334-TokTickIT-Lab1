import { PrismaClient } from '@prisma/client';
import { repairMigratedUserCredentials } from '../src/lib/lab-03-credentials.js';

const prisma = new PrismaClient();

try {
  const repairedUsers = await repairMigratedUserCredentials(prisma);
  console.log(`Repaired ${repairedUsers} migrated Lab 3 User credential${repairedUsers === 1 ? '' : 's'}.`);
} catch (error) {
  console.error('Unable to repair migrated Lab 3 User credentials.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
