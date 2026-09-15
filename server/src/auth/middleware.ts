import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthDatabaseLike } from './types.js';
import {
  CSRF_COOKIE_NAME,
  type AuthContext,
  hasAuthDatabase,
  loadSession,
  readCookie,
  SESSION_COOKIE_NAME,
  touchSession,
  verifyCsrfToken,
} from './session.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const AUTHENTICATION_REQUIRED = {
  error: 'Authentication is required.',
  code: 'AUTHENTICATION_REQUIRED',
};

const CSRF_VALIDATION_FAILED = {
  error: 'The request could not be verified.',
  code: 'CSRF_VALIDATION_FAILED',
};

export function sameOrigin(request: Request): boolean {
  const origin = request.get('origin');
  if (!origin) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);
    const expectedProtocol = request.protocol.endsWith(':')
      ? request.protocol
      : `${request.protocol}:`;
    return parsedOrigin.protocol === expectedProtocol && parsedOrigin.host === request.get('host');
  } catch {
    return false;
  }
}

export function createSessionMiddleware(database: AuthDatabaseLike): RequestHandler {
  return async (request: Request, _response: Response, next: NextFunction) => {
    if (!hasAuthDatabase(database)) {
      next();
      return;
    }

    const sessionToken = readCookie(request.get('cookie'), SESSION_COOKIE_NAME);
    if (!sessionToken) {
      next();
      return;
    }

    try {
      request.auth = (await loadSession(database, sessionToken)) ?? undefined;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function enforceSameOrigin(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!sameOrigin(request)) {
      sendCsrfValidationFailed(response);
      return;
    }
    next();
  };
}

export function requireAuthenticated(database: AuthDatabaseLike): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!hasAuthDatabase(database)) {
      next();
      return;
    }
    if (!request.auth) {
      response.status(401).json(AUTHENTICATION_REQUIRED);
      return;
    }

    try {
      await touchSession(database, request.auth);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireNormalAccess(database: AuthDatabaseLike): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!hasAuthDatabase(database)) {
      next();
      return;
    }
    if (!request.auth) {
      response.status(401).json(AUTHENTICATION_REQUIRED);
      return;
    }
    if (request.auth.user.mustChangePassword) {
      response.status(403).json({
        error: 'Change your password before continuing.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
      return;
    }

    try {
      await touchSession(database, request.auth);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCsrf(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!sameOrigin(request) || !request.auth || !verifyCsrfToken(
      readCookie(request.get('cookie'), CSRF_COOKIE_NAME),
      request.get('x-csrf-token'),
      request.auth.session.csrfTokenHash,
    )) {
      response.status(403).json(CSRF_VALIDATION_FAILED);
      return;
    }
    next();
  };
}

export function sendAuthenticationRequired(response: Response): void {
  response.status(401).json(AUTHENTICATION_REQUIRED);
}

export function sendCsrfValidationFailed(response: Response): void {
  response.status(403).json(CSRF_VALIDATION_FAILED);
}
