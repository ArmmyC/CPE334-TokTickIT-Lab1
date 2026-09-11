import { PrismaClient } from '@prisma/client';
import { repairMigratedUserCredentials } from '../src/lib/lab-03-credentials.js';
import { seedLab3Data, type Lab3SeedClient } from '../src/lib/lab-03-seed.js';

const prisma = new PrismaClient();

try {
  await repairMigratedUserCredentials(prisma);
  await seedLab3Data(prisma as unknown as Lab3SeedClient);
  console.log('Seeded TokTickIT Lab 3 reference data, users, Tickets, comments, and notes.');
} catch (error) {
  console.error('Unable to seed TokTickIT Lab 3 data.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
