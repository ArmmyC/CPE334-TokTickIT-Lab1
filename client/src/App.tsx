import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'offline';
type CategoryState = 'loading' | 'loaded' | 'error';

type Category = {
  id: number;
  name: string;
};

const unavailableMessage =
  'Unable to reach the TokTickIT API. Make sure the backend is running, then refresh the page.';
const categoriesUnavailableMessage =
  'Unable to load request categories. Make sure PostgreSQL is running, then refresh the page.';

function isCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Category>;
  return typeof candidate.id === 'number' && typeof candidate.name === 'string';
}

export function App() {
  const [healthState, setHealthState] = useState<HealthState>('checking');
  const [healthMessage, setHealthMessage] = useState('Checking backend connection...');
  const [categoryState, setCategoryState] = useState<CategoryState>('loading');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMessage, setCategoryMessage] = useState('Loading request categories...');

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const body = (await response.json()) as { status?: string; service?: string };

        if (!response.ok || body.status !== 'ok' || body.service !== 'TokTickIT API') {
          throw new Error('Unexpected health response');
        }

        if (active) {
          setHealthState('online');
          setHealthMessage('The backend is responding normally.');
        }
      } catch {
        if (active) {
          setHealthState('offline');
          setHealthMessage(unavailableMessage);
        }
      }
    };

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const body = (await response.json()) as unknown;

        if (!response.ok || !Array.isArray(body) || !body.every(isCategory)) {
          throw new Error('Unexpected categories response');
        }

        if (active) {
          setCategories(body);
          setCategoryState('loaded');
          setCategoryMessage('Categories loaded from the API.');
        }
      } catch {
        if (active) {
          setCategoryState('error');
          setCategoryMessage(categoriesUnavailableMessage);
        }
      }
    };

    void checkHealth();
    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  const statusLabel =
    healthState === 'checking' ? 'Checking...' : healthState === 'online' ? 'Online' : 'Offline';

  return (
    <main className="container py-5" aria-labelledby="app-title">
      <p className="text-uppercase text-secondary small fw-semibold">CPE334 / Lab 01</p>
      <h1 id="app-title" className="display-4 fw-bold">TokTickIT</h1>
      <p className="lead">IT service-desk foundation is ready.</p>
      <section className="mt-4" aria-labelledby="system-status-title" aria-live="polite" aria-busy={healthState === 'checking'}>
        <h2 id="system-status-title" className="h5">System status</h2>
        <p role="status" className={healthState === 'online' ? 'text-success fw-semibold' : healthState === 'offline' ? 'text-danger fw-semibold' : 'text-secondary'}>
          System Status: {statusLabel}
        </p>
        <p>{healthMessage}</p>
      </section>
      <section className="mt-4" aria-labelledby="categories-title" aria-busy={categoryState === 'loading'}>
        <h2 id="categories-title" className="h5">Request categories</h2>
        {categoryState === 'loading' && (
          <p role="status" className="text-secondary">Loading request categories...</p>
        )}
        {categoryState === 'error' && (
          <p role="alert" className="text-danger fw-semibold">{categoryMessage}</p>
        )}
        {categoryState === 'loaded' && (
          <>
            <p>{categoryMessage}</p>
            {categories.length === 0 ? (
              <p>No request categories were found.</p>
            ) : (
              <ol aria-label="Request categories" className="mb-0">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
    </main>
  );
}
