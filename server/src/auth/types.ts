export type AuthUserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export type AuthUserRecord = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: AuthUserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthSessionRecord = {
  id: string;
  tokenHash: string;
  csrfTokenHash: string;
  userId: number;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};

export type AuthSessionWithUser = AuthSessionRecord & {
  user?: AuthUserRecord | null;
};

export type AuthDatabase = {
  $transaction?<T>(callback: (database: AuthDatabase) => Promise<T>): Promise<T>;
  user: {
    findUnique(args: {
      where: { id?: number; email?: string };
      select?: Record<string, boolean>;
    }): Promise<AuthUserRecord | null>;
    update(args: {
      where: { id: number };
      data: Partial<Pick<AuthUserRecord, 'passwordHash' | 'mustChangePassword'>>;
    }): Promise<AuthUserRecord>;
  };
  session: {
    create(args: { data: Omit<AuthSessionRecord, 'id'> }): Promise<AuthSessionRecord>;
    findUnique(args: {
      where: { tokenHash: string };
      include?: { user: true };
    }): Promise<AuthSessionWithUser | null>;
    update(args: {
      where: { id: string };
      data: Partial<Pick<AuthSessionRecord, 'lastUsedAt' | 'expiresAt' | 'revokedAt'>>;
    }): Promise<AuthSessionRecord>;
    updateMany(args: {
      where: { userId: number; id?: { not: string } };
      data: Pick<AuthSessionRecord, 'revokedAt'>;
    }): Promise<{ count: number }>;
  };
};

export type AuthDatabaseLike = Partial<AuthDatabase>;

export type SafeUser = Pick<
  AuthUserRecord,
  'id' | 'name' | 'email' | 'role' | 'isActive' | 'mustChangePassword'
>;

export function serializeSafeUser(user: AuthUserRecord): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}
