import { CATEGORY_NAMES } from './category-seed.js';

export const RELATED_SYSTEM_NAMES = [
  'Email',
  'Campus Wi-Fi',
  'VPN',
  'LEB2 App',
  'Grade Submission App',
  'Printer',
  'Corporate Laptop',
] as const;

export const DEVELOPMENT_REQUESTERS = [
  { name: 'Ariya Anderson', email: 'ariya@example.test', isActive: true },
  { name: 'Narin Chai', email: 'narin@example.test', isActive: true },
  { name: 'Pimchanok Dee', email: 'pimchanok@example.test', isActive: true },
  { name: 'Kittipong Saelim', email: 'kittipong@example.test', isActive: true },
  { name: 'Mali Boonmee', email: 'mali@example.test', isActive: false },
] as const;

type NamedReferenceUpsertArguments = {
  where: { name: string };
  update: { name: string; isActive: boolean };
  create: { name: string; isActive: boolean };
};

type RequesterUpsertArguments = {
  where: { email: string };
  update: { name: string; isActive: boolean };
  create: { name: string; email: string; isActive: boolean };
};

export type Lab2SeedClient = {
  category: {
    upsert(args: NamedReferenceUpsertArguments): Promise<unknown>;
  };
  relatedSystem: {
    upsert(args: NamedReferenceUpsertArguments): Promise<unknown>;
  };
  developmentRequester: {
    upsert(args: RequesterUpsertArguments): Promise<unknown>;
  };
};

export async function seedLab2ReferenceData(database: Lab2SeedClient): Promise<void> {
  for (const name of CATEGORY_NAMES) {
    await database.category.upsert({
      where: { name },
      update: { name, isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of RELATED_SYSTEM_NAMES) {
    await database.relatedSystem.upsert({
      where: { name },
      update: { name, isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of DEVELOPMENT_REQUESTERS) {
    await database.developmentRequester.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: { ...requester },
    });
  }
}
