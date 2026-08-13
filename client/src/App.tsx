import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'offline';

const unavailableMessage =
  'Unable to reach the TokTickIT API. Make sure the backend is running, then refresh the page.';

export function App() {
  const [healthState, setHealthState] = useState<HealthState>('checking');
  const [healthMessage, setHealthMessage] = useState('Checking backend connection…');

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

    void checkHealth();

    return () => {
      active = false;
    };
  }, []);

  const statusLabel =
    healthState === 'checking' ? 'Checking…' : healthState === 'online' ? 'Online' : 'Offline';

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
    </main>
  );
}
