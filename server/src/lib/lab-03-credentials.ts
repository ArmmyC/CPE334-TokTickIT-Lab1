import { hashPassword } from '../auth/password.js';

export const LEGACY_MIGRATION_PLACEHOLDER_HASH =
  'scrypt$v1$N=32768,r=8,p=1$iHhJsiG382bBcRAG55hdFw$nBbkzfRQY1Qb4vUQH-MSMoXtJUAyJcMYRmL81r0U9Po';

export type LegacyCredentialClient = {
  user: {
    findMany(args: {
      where: { passwordHash: string };
      select: { id: true };
    }): Promise<Array<{ id: number }>>;
    update(args: {
      where: { id: number };
      data: { passwordHash: string; mustChangePassword: true };
    }): Promise<unknown>;
  };
};

export function legacyInitialPassword(userId: number): string {
  return `TokTickIT-Lab3!User-${userId}-Aa`;
}

export async function repairMigratedUserCredentials(database: LegacyCredentialClient): Promise<number> {
  const migratedUsers = await database.user.findMany({
    where: { passwordHash: LEGACY_MIGRATION_PLACEHOLDER_HASH },
    select: { id: true },
  });

  for (const user of migratedUsers) {
    await database.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(legacyInitialPassword(user.id)),
        mustChangePassword: true,
      },
    });
  }

  return migratedUsers.length;
}
