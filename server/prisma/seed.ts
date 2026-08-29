import { PrismaClient } from '@prisma/client';
import { seedLab2ReferenceData } from '../src/lib/lab-02-seed.js';

const prisma = new PrismaClient();

try {
  await seedLab2ReferenceData(prisma);
  console.log('Seeded TokTickIT Lab 2 reference data and Development Requesters.');
} catch (error) {
  console.error('Unable to seed TokTickIT Lab 2 data.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
