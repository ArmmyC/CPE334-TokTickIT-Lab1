export type ApiErrorBody = {
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

export function readCsrfToken(): string | null {
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('toktickit_csrf='));
  return cookie ? decodeURIComponent(cookie.slice('toktickit_csrf='.length)) : null;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(init.headers)) {
    for (const [key, value] of init.headers) {
      headers[key] = value;
    }
  } else if (init.headers) {
    Object.assign(headers, init.headers);
  }
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCsrfToken();
    const hasCsrfHeader = Object.keys(headers).some((key) => key.toLowerCase() === 'x-csrf-token');
    if (csrfToken && !hasCsrfHeader) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'same-origin',
    headers,
  });
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function apiErrorMessage(value: unknown, fallback: string): string {
  return isApiErrorBody(value) && typeof value.error === 'string' && value.error.length > 0
    ? value.error
    : fallback;
}
