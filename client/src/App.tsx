import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { RequesterProvider, useRequesterContext } from './requester-context';
import { CreateTicketPage } from './CreateTicketPage';
import { MyTicketsPage } from './MyTicketsPage';

type HealthState = 'idle' | 'checking' | 'online' | 'offline';
type CategoryState = 'idle' | 'loading' | 'loaded' | 'error';

type Category = {
  id: number;
  name: string;
};

const unavailableMessage =
  'Unable to reach the TokTickIT API. Make sure the backend is running, then try again.';
const categoriesUnavailableMessage =
  'Unable to load request categories. Make sure PostgreSQL is running, then try again.';

function isCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Category>;
  return typeof candidate.id === 'number' && typeof candidate.name === 'string';
}

function LabOneFoundation() {
  const [healthState, setHealthState] = useState<HealthState>('idle');
  const [healthMessage, setHealthMessage] = useState('Click Check System to check the backend.');
  const [categoryState, setCategoryState] = useState<CategoryState>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMessage, setCategoryMessage] = useState('Click Check System to load categories.');

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const body = (await response.json()) as { status?: string; service?: string };

      if (!response.ok || body.status !== 'ok' || body.service !== 'TokTickIT API') {
        throw new Error('Unexpected health response');
      }

      setHealthState('online');
      setHealthMessage('The backend is responding normally.');
    } catch {
      setHealthState('offline');
      setHealthMessage(unavailableMessage);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const body = (await response.json()) as unknown;

      if (!response.ok || !Array.isArray(body) || !body.every(isCategory)) {
        throw new Error('Unexpected categories response');
      }

      setCategories(body);
      setCategoryState('loaded');
      setCategoryMessage('Categories loaded from the API.');
    } catch {
      setCategoryState('error');
      setCategoryMessage(categoriesUnavailableMessage);
    }
  };

  const checkSystem = async () => {
    setHealthState('checking');
    setHealthMessage('Checking backend connection...');
    setCategoryState('loading');
    setCategories([]);
    setCategoryMessage('Loading request categories...');

    await Promise.all([checkHealth(), loadCategories()]);
  };

  const isChecking = healthState === 'checking' || categoryState === 'loading';
  const statusLabel =
    healthState === 'checking' ? 'Checking...' : healthState === 'online' ? 'Online' : 'Offline';

  return (
    <main className="container py-5" aria-labelledby="app-title">
      <p className="text-uppercase text-secondary small fw-semibold">CPE334 / Lab 01</p>
      <h1 id="app-title" className="display-4 fw-bold">TokTickIT IT Service Desk</h1>
      <p className="lead">IT service-desk foundation is ready.</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void checkSystem()}
        disabled={isChecking}
      >
        Check System
      </button>

      {healthState !== 'idle' && (
        <section
          className="mt-4"
          aria-labelledby="system-status-title"
          aria-live="polite"
          aria-busy={healthState === 'checking'}
        >
          <h2 id="system-status-title" className="h5">System status</h2>
          <p
            role="status"
            className={
              healthState === 'online'
                ? 'text-success fw-semibold'
                : healthState === 'offline'
                  ? 'text-danger fw-semibold'
                  : 'text-secondary'
            }
          >
            System Status: {statusLabel}
          </p>
          <p>{healthMessage}</p>
        </section>
      )}

      {categoryState !== 'idle' && (
        <section
          className="mt-4"
          aria-labelledby="categories-title"
          aria-busy={categoryState === 'loading'}
        >
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
      )}
      <p className="mt-4"><Link to="/select-requester">Open the Lab 2 requester selector</Link></p>
    </main>
  );
}

function RequesterSelection() {
  const navigate = useNavigate();
  const {
    requesters,
    selectedRequester,
    loadState,
    errorMessage,
    reloadRequesters,
    chooseRequester,
  } = useRequesterContext();
  const [selection, setSelection] = useState(selectedRequester ? String(selectedRequester.id) : '');
  const [selectionError, setSelectionError] = useState<string | null>(null);

  useEffect(() => {
    setSelection(selectedRequester ? String(selectedRequester.id) : '');
  }, [selectedRequester]);

  const selected = requesters.find(({ id }) => String(id) === selection) ?? null;
  const continueSelection = () => {
    if (!selected) {
      setSelectionError('Select an active Development Requester before continuing.');
      return;
    }

    chooseRequester(selected);
    navigate('/tickets');
  };

  return (
    <main className="requester-page" aria-labelledby="requester-title">
      <section className="requester-card" aria-describedby="requester-explanation">
        <p className="eyebrow">TokTickIT / Lab 2</p>
        <h1 id="requester-title">Select a Development Requester</h1>
        <p id="requester-explanation" className="text-secondary">
          Choose a seeded Development Requester for this testing context. This selector is for Lab 2 testing only,
          not a login or authentication system.
        </p>

        {loadState === 'loading' && (
          <p role="status" aria-live="polite" className="state-message">Loading Development Requesters...</p>
        )}

        {loadState === 'error' && (
          <div role="alert" className="state-message state-message-error">
            <p>{errorMessage}</p>
            <button type="button" className="btn btn-secondary" onClick={reloadRequesters}>Retry</button>
          </div>
        )}

        {loadState === 'ready' && requesters.length === 0 && (
          <div role="alert" className="state-message state-message-warning">
            <p>No active Development Requesters are available.</p>
            <button type="button" className="btn btn-secondary" onClick={reloadRequesters}>Retry</button>
          </div>
        )}

        {loadState === 'ready' && requesters.length > 0 && (
          <>
            <div className="field-group">
              <label htmlFor="development-requester">Development Requester</label>
              <select
                id="development-requester"
                className="form-select"
                value={selection}
                onChange={(event) => {
                  setSelection(event.target.value);
                  setSelectionError(null);
                }}
                aria-describedby={selectionError ? 'requester-selection-error' : undefined}
              >
                <option value="">Select an active requester</option>
                {requesters.map((requester) => (
                  <option key={requester.id} value={requester.id}>
                    {requester.name} ({requester.email})
                  </option>
                ))}
              </select>
              {selectionError && (
                <p id="requester-selection-error" role="alert" className="field-error">{selectionError}</p>
              )}
            </div>
            <button type="button" className="btn btn-primary btn-lg" disabled={!selected} onClick={continueSelection}>
              Continue
            </button>
          </>
        )}
      </section>
    </main>
  );
}

function ApplicationShell() {
  const { selectedRequester, clearRequester } = useRequesterContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!selectedRequester) {
    return <Navigate to="/select-requester" replace />;
  }

  const changeRequester = () => {
    clearRequester();
    setMenuOpen(false);
    navigate('/select-requester');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link';

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link to="/tickets" className="shell-brand" onClick={() => setMenuOpen(false)}>
            <span className="shell-brand-mark" aria-hidden="true">T</span>
            <span>TokTickIT</span>
          </Link>
          <button
            type="button"
            className="shell-menu-button"
            aria-expanded={menuOpen}
            aria-controls="shell-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close navigation' : 'Open navigation'}
          </button>
          <nav id="shell-navigation" className={menuOpen ? 'shell-navigation shell-navigation-open' : 'shell-navigation'} aria-label="Main navigation">
            <NavLink to="/tickets" className={navLinkClass} onClick={() => setMenuOpen(false)}>My Tickets</NavLink>
            <NavLink to="/tickets/new" className={navLinkClass} onClick={() => setMenuOpen(false)}>Create Ticket</NavLink>
          </nav>
          <div className="shell-requester">
            <span className="shell-requester-label">Selected Requester</span>
            <strong>{selectedRequester.name}</strong>
            <button type="button" className="shell-change-button" onClick={changeRequester}>Change Requester</button>
          </div>
        </div>
      </header>
      <div className="testing-notice" role="note">
        Lab 2 testing context only, this is not a login or authentication system.
      </div>
      <main className="shell-content"><Outlet /></main>
    </div>
  );
}

function ProtectedRoutes() {
  const { loadState, selectedRequester } = useRequesterContext();
  if (loadState === 'loading') {
    return <p role="status" className="page-status">Loading requester context...</p>;
  }
  if (!selectedRequester) {
    return <Navigate to="/select-requester" replace />;
  }
  return <ApplicationShell />;
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-page" aria-labelledby="placeholder-title">
      <p className="eyebrow">TokTickIT / Lab 2</p>
      <h1 id="placeholder-title">{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function RoutedApplication() {
  return (
    <Routes>
      <Route path="/" element={<LabOneFoundation />} />
      <Route path="/select-requester" element={<RequesterSelection />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/tickets" element={<MyTicketsPage />} />
        <Route path="/tickets/new" element={<CreateTicketPage />} />
        <Route path="/tickets/:ticketId" element={<PlaceholderPage title="Ticket Detail" description="Ticket detail will be added in the next Lab 2 increment." />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <RequesterProvider>
      <RoutedApplication />
    </RequesterProvider>
  );
}
