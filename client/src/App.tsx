import { useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth, type AuthUserRole } from './auth-context';
import { ChangePasswordPage } from './ChangePasswordPage';
import { CreateTicketPage } from './CreateTicketPage';
import { LoginPage } from './LoginPage';
import { MyTicketsPage } from './MyTicketsPage';
import { TicketDetailPage } from './TicketDetailPage';

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
      <p className="mt-4"><Link to="/login">Sign in to the service desk</Link></p>
    </main>
  );
}

function ApplicationShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const isRequester = user.role === 'REQUESTER';
  const roleLabel: Record<AuthUserRole, string> = {
    REQUESTER: 'Requester',
    IT_STAFF: 'IT Staff',
    ADMINISTRATOR: 'Administrator',
  };
  const signOut = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Unable to sign out. Try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link';

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link to={isRequester ? '/tickets' : '/home'} className="shell-brand" onClick={() => setMenuOpen(false)}>
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
            {isRequester && (
              <>
                <NavLink to="/tickets" className={navLinkClass} onClick={() => setMenuOpen(false)}>My Tickets</NavLink>
                <NavLink to="/tickets/new" className={navLinkClass} onClick={() => setMenuOpen(false)}>Create Ticket</NavLink>
              </>
            )}
          </nav>
          <div className="shell-user">
            <span className="shell-user-label">Signed in as</span>
            <strong>{user.name}</strong>
            <span className="role-badge">{roleLabel[user.role]}</span>
            <button type="button" className="shell-logout" onClick={() => void signOut()} disabled={isLoggingOut}>
              {isLoggingOut ? 'Signing out...' : 'Log out'}
            </button>
          </div>
        </div>
      </header>
      {logoutError && <div role="alert" className="shell-alert">{logoutError}</div>}
      <main className="shell-content"><Outlet /></main>
    </div>
  );
}

function ProtectedRoutes() {
  const { loadState, user } = useAuth();
  if (loadState === 'loading') {
    return <p role="status" className="page-status">Checking your session...</p>;
  }
  if (!user || loadState === 'unauthenticated' || loadState === 'error') {
    return <Navigate to="/login" replace />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return <ApplicationShell />;
}

function RequesterOnly() {
  const { user } = useAuth();
  if (!user || user.role !== 'REQUESTER') {
    return (
      <section className="placeholder-page" aria-labelledby="access-title">
        <p className="eyebrow">TokTickIT / Access</p>
        <h1 id="access-title">Requester access is required</h1>
        <p>This destination is available only to Requester accounts.</p>
      </section>
    );
  }
  return <Outlet />;
}

function RoleHomePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <section className="placeholder-page" aria-labelledby="role-home-title">
      <p className="eyebrow">TokTickIT / Workspace</p>
      <h1 id="role-home-title">Welcome, {user.name}</h1>
      <p>Your {user.role === 'IT_STAFF' ? 'IT Staff' : 'Administrator'} workspace is ready for the next authorized Lab 3 increment.</p>
    </section>
  );
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/home" element={<RoleHomePage />} />
        <Route element={<RequesterOnly />}>
          <Route path="/tickets" element={<MyTicketsPage />} />
          <Route path="/tickets/new" element={<CreateTicketPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <RoutedApplication />
    </AuthProvider>
  );
}
