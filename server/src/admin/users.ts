import type { AuthUserRecord, AuthUserRole } from '../auth/types.js';
import { hashPassword, validatePassword } from '../auth/password.js';

export type AdminUserRole = Extract<AuthUserRole, 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'>;

export type AdminUserResponse = Pick<
  AuthUserRecord,
  'id' | 'name' | 'email' | 'role' | 'isActive' | 'mustChangePassword' | 'createdAt' | 'updatedAt'
>;

export type AdminUserQuery = {
  search: string;
  role?: AdminUserRole;
};

export type CreateAdminUserInput = {
  name: string;
  email: string;
  role: AdminUserRole;
  isActive: boolean;
  initialPassword: string;
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
    findUnique?(args: {
      where: { email: string };
    }): Promise<AuthUserRecord | null>;
    create?(args: {
      data: {
        name: string;
        email: string;
        passwordHash: string;
        role: AdminUserRole;
        isActive: boolean;
        mustChangePassword: true;
      };
    }): Promise<AuthUserRecord>;
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

export class AdminUserConflictError extends Error {
  constructor(message: string) {
    super(message);
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

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
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

export function parseCreateAdminUserPayload(payload: unknown): CreateAdminUserInput {
  if (!isRecord(payload)) {
    throw new AdminUserValidationError({ form: 'User details are required.' });
  }

  const fieldErrors: Record<string, string> = {};
  const allowedFields = new Set([
    'name',
    'email',
    'role',
    'isActive',
    'initialPassword',
  ]);
  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      fieldErrors[key] = 'This field is not accepted.';
    }
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (name.length < 1 || name.length > 120) {
    fieldErrors.name = 'Name must be between 1 and 120 characters after trimming.';
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    fieldErrors.email = 'A valid email address is required.';
  }

  const role = payload.role;
  if (typeof role !== 'string' || !ADMIN_USER_ROLES.has(role as AdminUserRole)) {
    fieldErrors.role = 'Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR.';
  }

  if (typeof payload.isActive !== 'boolean') {
    fieldErrors.isActive = 'Active state must be a boolean.';
  }

  if (typeof payload.initialPassword !== 'string' || payload.initialPassword.length === 0) {
    fieldErrors.initialPassword = 'Initial password is required.';
  } else {
    const passwordError = validatePassword(payload.initialPassword);
    if (passwordError) {
      fieldErrors.initialPassword = passwordError;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AdminUserValidationError(fieldErrors);
  }

  return {
    name,
    email: email as string,
    role: role as AdminUserRole,
    isActive: payload.isActive as boolean,
    initialPassword: payload.initialPassword as string,
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

export async function createAdminUser(
  database: AdminUserDatabase,
  input: CreateAdminUserInput,
): Promise<AdminUserResponse> {
  if (!database.user.findUnique || !database.user.create) {
    throw new Error('Administrator User database access is unavailable.');
  }

  const existingUser = await database.user.findUnique({
    where: { email: input.email },
  });
  if (existingUser) {
    throw new AdminUserConflictError('A User with that email already exists.');
  }

  const passwordHash = await hashPassword(input.initialPassword);
  const user = await database.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: input.isActive,
      mustChangePassword: true,
    },
  });
  return serializeAdminUser(user);
}
