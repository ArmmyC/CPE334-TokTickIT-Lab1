import type { AuthUserRecord, AuthUserRole } from '../auth/types.js';

export type AdminUserRole = Extract<AuthUserRole, 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'>;

export type AdminUserResponse = Pick<
  AuthUserRecord,
  'id' | 'name' | 'email' | 'role' | 'isActive' | 'mustChangePassword' | 'createdAt' | 'updatedAt'
>;

export type AdminUserQuery = {
  search: string;
  role?: AdminUserRole;
};

type AdminUserSearchFilter = {
  contains: string;
  mode: 'insensitive';
};

export type AdminUserWhere = {
  OR?: Array<{
    name?: AdminUserSearchFilter;
    email?: AdminUserSearchFilter;
  }>;
  role?: AdminUserRole;
};

export const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type AdminUserDatabase = {
  user: {
    findMany(args: {
      where: AdminUserWhere;
      select: typeof ADMIN_USER_SELECT;
      orderBy: [{ name: 'asc' }, { id: 'asc' }];
    }): Promise<AdminUserResponse[]>;
  };
};

const ADMIN_USER_ROLES = new Set<AdminUserRole>([
  'REQUESTER',
  'IT_STAFF',
  'ADMINISTRATOR',
]);

export class AdminUserValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Administrator User validation failed.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseQueryString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'string' ? value : null;
}

export function parseAdminUserQuery(query: unknown): AdminUserQuery {
  const source = isRecord(query) ? query : {};
  const fieldErrors: Record<string, string> = {};

  const searchValue = parseQueryString(source.search);
  if (searchValue === null) {
    fieldErrors.search = 'Search must be a single text value.';
  }
  const search = searchValue?.trim() ?? '';
  if (search.length > 120) {
    fieldErrors.search = 'Search must be 120 characters or fewer.';
  }

  const roleValue = parseQueryString(source.role);
  if (
    roleValue !== undefined
    && (roleValue === null || !ADMIN_USER_ROLES.has(roleValue as AdminUserRole))
  ) {
    fieldErrors.role = 'Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AdminUserValidationError(fieldErrors);
  }

  return {
    search,
    ...(roleValue === undefined ? {} : { role: roleValue as AdminUserRole }),
  };
}

export function buildAdminUserWhere(query: AdminUserQuery): AdminUserWhere {
  return {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.role ? { role: query.role } : {}),
  };
}

export function serializeAdminUser(user: AdminUserResponse): AdminUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listAdminUsers(
  database: AdminUserDatabase,
  query: AdminUserQuery,
): Promise<AdminUserResponse[]> {
  const users = await database.user.findMany({
    where: buildAdminUserWhere(query),
    select: ADMIN_USER_SELECT,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return users.map(serializeAdminUser);
}
