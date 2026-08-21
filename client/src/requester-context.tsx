import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const REQUESTER_STORAGE_KEY = 'toktickit.developmentRequesterId';

export type DevelopmentRequester = {
  id: number;
  name: string;
  email: string;
};

type RequesterLoadState = 'loading' | 'ready' | 'error';

type RequesterContextValue = {
  requesters: DevelopmentRequester[];
  selectedRequester: DevelopmentRequester | null;
  loadState: RequesterLoadState;
  errorMessage: string | null;
  reloadRequesters: () => void;
  chooseRequester: (requester: DevelopmentRequester) => void;
  clearRequester: () => void;
};

const RequesterContext = createContext<RequesterContextValue | null>(null);

function readStoredRequesterId(): number | null {
  const storedValue = sessionStorage.getItem(REQUESTER_STORAGE_KEY);
  if (!storedValue || !/^\d+$/.test(storedValue)) {
    return null;
  }

  const parsedValue = Number(storedValue);
  return Number.isSafeInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function isDevelopmentRequester(value: unknown): value is DevelopmentRequester {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<DevelopmentRequester>;
  return (
    Number.isSafeInteger(candidate.id) &&
    (candidate.id ?? 0) > 0 &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string'
  );
}

export function RequesterProvider({ children }: { children: React.ReactNode }) {
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [selectedRequester, setSelectedRequester] = useState<DevelopmentRequester | null>(null);
  const [loadState, setLoadState] = useState<RequesterLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadRequesters = useCallback(() => {
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage(null);

    void fetch('/api/development-requesters')
      .then(async (response) => {
        const body = (await response.json()) as unknown;
        if (!response.ok || !Array.isArray(body) || !body.every(isDevelopmentRequester)) {
          throw new Error('Unexpected Development Requesters response.');
        }
        return body;
      })
      .then((activeRequesters) => {
        if (cancelled) {
          return;
        }

        setRequesters(activeRequesters);
        const storedId = readStoredRequesterId();
        const storedRequester = activeRequesters.find(({ id }) => id === storedId) ?? null;
        if (storedRequester) {
          setSelectedRequester(storedRequester);
        } else {
          sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
          setSelectedRequester(null);
        }
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setRequesters([]);
          setSelectedRequester(null);
          setLoadState('error');
          setErrorMessage('Unable to load Development Requesters. Check the API and try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reloadRequesters(), [reloadRequesters]);

  const chooseRequester = useCallback((requester: DevelopmentRequester) => {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
    setSelectedRequester(requester);
  }, []);

  const clearRequester = useCallback(() => {
    sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
    setSelectedRequester(null);
  }, []);

  const value = useMemo(
    () => ({
      requesters,
      selectedRequester,
      loadState,
      errorMessage,
      reloadRequesters,
      chooseRequester,
      clearRequester,
    }),
    [
      requesters,
      selectedRequester,
      loadState,
      errorMessage,
      reloadRequesters,
      chooseRequester,
      clearRequester,
    ],
  );

  return <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>;
}

export function useRequesterContext() {
  const value = useContext(RequesterContext);
  if (!value) {
    throw new Error('useRequesterContext must be used within RequesterProvider.');
  }
  return value;
}
