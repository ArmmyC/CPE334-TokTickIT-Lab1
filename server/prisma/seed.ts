import { PrismaClient } from '@prisma/client';
import { seedCategories } from '../src/lib/category-seed.js';

const prisma = new PrismaClient();

try {
  await seedCategories(prisma);
  console.log('Seeded TokTickIT request categories.');
} catch (error) {
  console.error('Unable to seed TokTickIT request categories.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
