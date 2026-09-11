import type { Request } from 'express';
import { Router } from 'express';
import { hashPassword, validatePassword, verifyPassword } from './password.js';
import {
  clearAuthCookies,
  createSession,
  CSRF_COOKIE_NAME,
  readCookie,
  SESSION_INACTIVITY_MS,
  setAuthCookies,
  verifyCsrfToken,
  hasAuthDatabase,
} from './session.js';
import {
  requireAuthenticated,
  requireCsrf,
  sameOrigin,
  sendAuthenticationRequired,
  sendCsrfValidationFailed,
} from './middleware.js';
import type { AuthDatabase, AuthDatabaseLike } from './types.js';
import { serializeSafeUser } from './types.js';

const LOGIN_FAILURE = {
  error: 'Email or password is incorrect.',
  code: 'AUTHENTICATION_FAILED',
};

const LOGIN_THROTTLED = {
  error: 'Too many login attempts. Try again later.',
  code: 'AUTHENTICATION_THROTTLED',
};

const DUMMY_PASSWORD = 'TokTickIT-invalid-password1!';
const DUMMY_PASSWORD_HASH = hashPassword(DUMMY_PASSWORD);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;

type LoginAttempt = {
  failures: number;
  firstFailureAt: number;
  throttledUntil: number | null;
};

class LoginThrottle {
  private readonly attempts = new Map<string, LoginAttempt>();

  isThrottled(key: string, now: number): boolean {
    const attempt = this.attempts.get(key);
    if (!attempt) {
      return false;
    }
    if (attempt.throttledUntil !== null && attempt.throttledUntil > now) {
      return true;
    }
    if (now - attempt.firstFailureAt >= LOGIN_WINDOW_MS) {
      this.attempts.delete(key);
    }
    return false;
  }

  recordFailure(key: string, now: number): void {
    const current = this.attempts.get(key);
    const attempt = current && now - current.firstFailureAt < LOGIN_WINDOW_MS
      ? current
      : { failures: 0, firstFailureAt: now, throttledUntil: null };
    attempt.failures += 1;
    if (attempt.failures >= LOGIN_FAILURE_LIMIT) {
      attempt.throttledUntil = now + LOGIN_WINDOW_MS;
    }
    this.attempts.set(key, attempt);
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

type LoginValidationResult =
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; fieldErrors: Record<string, string> };

function validateLoginPayload(payload: unknown): LoginValidationResult {
  const fieldErrors: Record<string, string> = {};
  const body = isRecord(payload) ? payload : {};
  const email = normalizeEmail(body.email);
  if (!email) {
    fieldErrors.email = 'A valid email address is required.';
  }
  if (typeof body.password !== 'string' || body.password.length === 0) {
    fieldErrors.password = 'Password is required.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: { email: email as string, password: body.password as string },
  };
}

function validationResponse(response: import('express').Response, fieldErrors: Record<string, string>): void {
  response.status(400).json({
    error: 'Please correct the highlighted fields.',
    code: 'VALIDATION_FAILED',
    fieldErrors,
  });
}

function requestSourceIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function secureCookiesForRequest(request: Request): boolean {
  const environment = process.env.NODE_ENV;
  return request.secure || (environment !== undefined && environment !== 'development' && environment !== 'test');
}

function throttleKey(request: Request, email: string): string {
  return `${requestSourceIp(request)}|${email}`;
}

function loginOriginError(response: import('express').Response): void {
  sendCsrfValidationFailed(response);
}

function loadUser(database: AuthDatabase, email: string) {
  return database.user.findUnique({
    where: { email },
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
}

export function createAuthRouter(database: AuthDatabaseLike) {
  const router = Router();
  const throttle = new LoginThrottle();

  router.post('/login', async (request, response, next) => {
    if (!sameOrigin(request)) {
      loginOriginError(response);
      return;
    }
    if (!hasAuthDatabase(database)) {
      next(new Error('Authentication database access is unavailable.'));
      return;
    }

    const payload = validateLoginPayload(request.body);
    if (!payload.ok) {
      validationResponse(response, payload.fieldErrors);
      return;
    }

    const { email, password } = payload.value;
    const key = throttleKey(request, email);
    const now = Date.now();
    if (throttle.isThrottled(key, now)) {
      response.status(429).json(LOGIN_THROTTLED);
      return;
    }

    try {
      const user = await loadUser(database, email);
      const passwordHash = user?.passwordHash || await DUMMY_PASSWORD_HASH;
      const passwordMatches = await verifyPassword(password, passwordHash);
      if (!user || !user.isActive || !passwordMatches) {
        throttle.recordFailure(key, now);
        response.status(401).json(LOGIN_FAILURE);
        return;
      }

      throttle.clear(key);
      const session = await createSession(database, user.id);
      setAuthCookies(response, session.sessionToken, session.csrfToken, {
        secure: secureCookiesForRequest(request),
      });
      response.status(200).json({
        user: serializeSafeUser(user),
        passwordChangeRequired: user.mustChangePassword,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', (request, response) => {
    if (!request.auth) {
      sendAuthenticationRequired(response);
      return;
    }
    response.status(200).json({
      user: serializeSafeUser(request.auth.user),
      passwordChangeRequired: request.auth.user.mustChangePassword,
    });
  });

  router.post('/logout', async (request, response, next) => {
    if (!database.session) {
      clearAuthCookies(response, { secure: secureCookiesForRequest(request) });
      response.status(204).end();
      return;
    }

    if (request.auth) {
      if (!sameOrigin(request) || !verifyCsrfToken(
        readCookie(request.get('cookie'), CSRF_COOKIE_NAME),
        request.get('x-csrf-token'),
        request.auth.session.csrfTokenHash,
      )) {
        sendCsrfValidationFailed(response);
        return;
      }
      try {
        await database.session.update({
          where: { id: request.auth.session.id },
          data: { revokedAt: new Date() },
        });
      } catch (error) {
        next(error);
        return;
      }
    }

    clearAuthCookies(response, { secure: secureCookiesForRequest(request) });
    response.status(204).end();
  });

  router.post('/change-password', requireAuthenticated(database), requireCsrf(), async (request, response, next) => {
    const auth = request.auth;
    if (!hasAuthDatabase(database) || !auth) {
      sendAuthenticationRequired(response);
      return;
    }

    const body = isRecord(request.body) ? request.body : {};
    const fieldErrors: Record<string, string> = {};
    if (typeof body.currentPassword !== 'string' || body.currentPassword.length === 0) {
      fieldErrors.currentPassword = 'Current password is required.';
    }
    if (typeof body.newPassword !== 'string') {
      fieldErrors.newPassword = 'New password is required.';
    } else {
      const passwordError = validatePassword(body.newPassword);
      if (passwordError) {
        fieldErrors.newPassword = passwordError;
      }
    }
    if (typeof body.confirmPassword !== 'string' || body.confirmPassword !== body.newPassword) {
      fieldErrors.confirmPassword = 'Passwords must match.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      validationResponse(response, fieldErrors);
      return;
    }

    try {
      const currentMatches = await verifyPassword(body.currentPassword as string, auth.user.passwordHash);
      if (!currentMatches) {
        response.status(401).json({
          error: 'Current password is incorrect.',
          code: 'PASSWORD_CHANGE_FAILED',
        });
        return;
      }

      const passwordHash = await hashPassword(body.newPassword as string);
      const persistPasswordChange = async (transaction: AuthDatabase) => {
        const updatedUser = await transaction.user.update({
          where: { id: auth.user.id },
          data: {
            passwordHash,
            mustChangePassword: false,
          },
        });
        await transaction.session.updateMany({
          where: {
            userId: auth.user.id,
            id: { not: auth.session.id },
          },
          data: { revokedAt: new Date() },
        });
        await transaction.session.update({
          where: { id: auth.session.id },
          data: {
            lastUsedAt: new Date(),
            expiresAt: new Date(Math.min(
              Date.now() + SESSION_INACTIVITY_MS,
              auth.session.absoluteExpiresAt.getTime(),
            )),
          },
        });
        return updatedUser;
      };
      const updatedUser = database.$transaction
        ? await database.$transaction(persistPasswordChange)
        : await persistPasswordChange(database);

      response.status(200).json({
        user: serializeSafeUser(updatedUser),
        passwordChangeRequired: false,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
