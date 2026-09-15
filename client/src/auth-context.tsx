import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiErrorMessage, apiFetch, isApiErrorBody, readJson, type ApiErrorBody } from './api';

export type AuthUserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AuthUserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type AuthLoadState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type AuthResponse = {
  user: AuthUser;
  passwordChangeRequired: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loadState: AuthLoadState;
  errorMessage: string | null;
  retrySessionCheck: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

export class AuthRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<AuthUser>;
  return Number.isSafeInteger(candidate.id) && (candidate.id ?? 0) > 0
    && typeof candidate.name === 'string'
    && typeof candidate.email === 'string'
    && (candidate.role === 'REQUESTER' || candidate.role === 'IT_STAFF' || candidate.role === 'ADMINISTRATOR')
    && typeof candidate.isActive === 'boolean'
    && typeof candidate.mustChangePassword === 'boolean';
}

function parseAuthResponse(value: unknown): AuthResponse | null {
  if (!isApiErrorBody(value)) {
    return null;
  }
  const candidate = value as ApiErrorBody & { user?: unknown; passwordChangeRequired?: boolean };
  if (!isAuthUser(candidate.user)) {
    return null;
  }
  return {
    user: candidate.user,
    passwordChangeRequired: candidate.passwordChangeRequired === true,
  };
}

async function requestAuthResponse(path: string, init: RequestInit): Promise<AuthResponse> {
  const response = await apiFetch(path, init);
  const rawBody = await readJson(response);
  const body = isApiErrorBody(rawBody) ? rawBody : null;
  if (!response.ok) {
    throw new AuthRequestError(
      apiErrorMessage(body, 'The request could not be completed.'),
      response.status,
      body,
    );
  }
  const parsed = parseAuthResponse(rawBody);
  if (!parsed) {
    throw new AuthRequestError('The server returned an unexpected response.', response.status, body);
  }
  return parsed;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadState, setLoadState] = useState<AuthLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionCheckKey, setSessionCheckKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage(null);
    void apiFetch('/api/auth/me')
      .then(async (response) => {
        const rawBody = await readJson(response);
        if (response.status === 401) {
          return { kind: 'unauthenticated' as const };
        }
        if (!response.ok) {
          return { kind: 'error' as const };
        }
        const parsed = parseAuthResponse(rawBody);
        return parsed
          ? { kind: 'authenticated' as const, user: parsed.user }
          : { kind: 'error' as const };
      })
      .catch(() => ({ kind: 'error' as const }))
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.kind === 'authenticated') {
          setUser(result.user);
          setLoadState('authenticated');
          setErrorMessage(null);
        } else if (result.kind === 'unauthenticated') {
          setUser(null);
          setLoadState('unauthenticated');
          setErrorMessage(null);
        } else {
          setUser(null);
          setLoadState('error');
          setErrorMessage('Unable to check your session. Try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionCheckKey]);

  const retrySessionCheck = useCallback(() => {
    setUser(null);
    setLoadState('loading');
    setErrorMessage(null);
    setSessionCheckKey((key) => key + 1);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await requestAuthResponse('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setUser(result.user);
    setLoadState('authenticated');
    setErrorMessage(null);
    return result.user;
  }, []);

  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    const result = await requestAuthResponse('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    setUser(result.user);
    setLoadState('authenticated');
    setErrorMessage(null);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const response = await apiFetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      const rawBody = await readJson(response);
      const body = isApiErrorBody(rawBody) ? rawBody : null;
      throw new AuthRequestError(
        apiErrorMessage(body, 'Unable to sign out. Try again.'),
        response.status,
        body,
      );
    }
    setUser(null);
    setLoadState('unauthenticated');
    setErrorMessage(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loadState,
    errorMessage,
    retrySessionCheck,
    login,
    changePassword,
    logout,
  }), [user, loadState, errorMessage, retrySessionCheck, login, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return value;
}
