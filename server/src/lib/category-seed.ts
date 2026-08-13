export const CATEGORY_NAMES = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network',
] as const;

type CategoryUpsertArguments = {
  where: { name: string };
  update: Record<string, never>;
  create: { name: string };
};

export type CategorySeedClient = {
  category: {
    upsert(args: CategoryUpsertArguments): Promise<unknown>;
  };
};

export async function seedCategories(database: CategorySeedClient): Promise<void> {
  for (const name of CATEGORY_NAMES) {
    await database.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}
