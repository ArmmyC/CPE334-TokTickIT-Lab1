import { PrismaClient } from '@prisma/client';
import { repairMigratedUserCredentials } from '../src/lib/lab-03-credentials.js';
import { seedLab3Data, type Lab3SeedClient } from '../src/lib/lab-03-seed.js';
import { seedLab4Data } from '../src/lib/lab-04-seed.js';

const prisma = new PrismaClient();

try {
  await repairMigratedUserCredentials(prisma);
  await seedLab3Data(prisma as unknown as Lab3SeedClient);
  await seedLab4Data(prisma);
  console.log('Seeded TokTickIT Lab 3 reference data, users, Tickets, comments, notes, and Lab 4 Actions Taken.');
} catch (error) {
  console.error('Unable to seed TokTickIT data.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
