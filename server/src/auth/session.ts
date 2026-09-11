import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { AuthDatabase, AuthDatabaseLike, AuthSessionRecord, AuthUserRecord } from './types.js';

export const SESSION_COOKIE_NAME = 'toktickit_session';
export const CSRF_COOKIE_NAME = 'toktickit_csrf';
export const SESSION_INACTIVITY_MS = 8 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000;

export type AuthContext = {
  user: AuthUserRecord;
  session: AuthSessionRecord;
  sessionToken: string;
};

export function hasAuthDatabase(database: AuthDatabaseLike): database is AuthDatabase {
  return Boolean(database.user && database.session);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function isExpired(session: AuthSessionRecord, now: Date): boolean {
  return session.revokedAt !== null ||
    now.getTime() >= session.expiresAt.getTime() ||
    now.getTime() >= session.absoluteExpiresAt.getTime();
}

export async function loadSession(
  database: AuthDatabase,
  sessionToken: string,
  now = new Date(),
): Promise<AuthContext | null> {
  const session = await database.session.findUnique({
    where: { tokenHash: hashToken(sessionToken) },
    include: { user: true },
  });
  if (!session || isExpired(session, now)) {
    return null;
  }

  const user = session.user ?? await database.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user || !user.isActive) {
    return null;
  }

  return {
    user,
    session,
    sessionToken,
  };
}

export async function createSession(
  database: AuthDatabase,
  userId: number,
  now = new Date(),
): Promise<{ session: AuthSessionRecord; sessionToken: string; csrfToken: string }> {
  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const createdAt = new Date(now);
  const expiresAt = new Date(now.getTime() + SESSION_INACTIVITY_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  const session = await database.session.create({
    data: {
      tokenHash: hashToken(sessionToken),
      csrfTokenHash: hashToken(csrfToken),
      userId,
      createdAt,
      lastUsedAt: new Date(now),
      expiresAt,
      absoluteExpiresAt,
      revokedAt: null,
    },
  });

  return { session, sessionToken, csrfToken };
}

export async function touchSession(
  database: AuthDatabase,
  context: AuthContext,
  now = new Date(),
): Promise<void> {
  if (isExpired(context.session, now)) {
    return;
  }
  const slidingDeadline = new Date(now.getTime() + SESSION_INACTIVITY_MS);
  const absoluteDeadline = context.session.absoluteExpiresAt;
  const expiresAt = slidingDeadline.getTime() < absoluteDeadline.getTime()
    ? slidingDeadline
    : new Date(absoluteDeadline);
  await database.session.update({
    where: { id: context.session.id },
    data: {
      lastUsedAt: new Date(now),
      expiresAt,
    },
  });
}

function serializeCookie(name: string, value: string, options: { httpOnly: boolean; maxAge?: number; secure: boolean }): string {
  const secure = options.secure ? '; Secure' : '';
  const maxAge = options.maxAge === undefined ? '' : `; Max-Age=${options.maxAge}`;
  const httpOnly = options.httpOnly ? '; HttpOnly' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${httpOnly}${secure}${maxAge}`;
}

export function setAuthCookies(
  response: Response,
  sessionToken: string,
  csrfToken: string,
  options: { secure?: boolean } = {},
): void {
  response.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    maxAge: SESSION_ABSOLUTE_MS / 1000,
    secure: options.secure ?? false,
  }));
  response.append('Set-Cookie', serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    maxAge: SESSION_ABSOLUTE_MS / 1000,
    secure: options.secure ?? false,
  }));
}

export function clearAuthCookies(response: Response, options: { secure?: boolean } = {}): void {
  const secure = options.secure ? '; Secure' : '';
  const expires = '; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
  response.append('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; SameSite=Lax; HttpOnly${secure}${expires}`);
  response.append('Set-Cookie', `${CSRF_COOKIE_NAME}=; Path=/; SameSite=Lax${secure}${expires}`);
}

export function verifyCsrfToken(
  cookieToken: string | null,
  headerToken: string | undefined,
  storedHash: string,
): boolean {
  if (!cookieToken || !headerToken || !constantTimeStringEqual(cookieToken, headerToken)) {
    return false;
  }
  return constantTimeStringEqual(hashToken(headerToken), storedHash);
}
