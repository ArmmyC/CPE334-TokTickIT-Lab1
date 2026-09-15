import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthRequestError, useAuth, type AuthUser } from './auth-context';

function destinationFor(user: AuthUser): string {
  return user.role === 'REQUESTER' ? '/tickets' : '/home';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginPage() {
  const navigate = useNavigate();
  const { user, loadState, errorMessage, retrySessionCheck, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loadState === 'authenticated' && user && !isSubmitting) {
      navigate(user.mustChangePassword ? '/change-password' : destinationFor(user), { replace: true });
    }
  }, [isSubmitting, loadState, navigate, user]);

  if (loadState === 'loading') {
    return <p role="status" className="page-status">Checking your session...</p>;
  }

  if (loadState === 'authenticated' && user && !isSubmitting) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : destinationFor(user)} replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!isValidEmail(email)) {
      nextErrors.email = 'A valid email address is required.';
    }
    if (!password) {
      nextErrors.password = 'Password is required.';
    }
    setFieldErrors(nextErrors);
    setFormAlert(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const authenticatedUser = await login(email.trim(), password);
      setPassword('');
      navigate(authenticatedUser.mustChangePassword ? '/change-password' : destinationFor(authenticatedUser), { replace: true });
    } catch (error) {
      if (error instanceof AuthRequestError && error.body?.fieldErrors) {
        setFieldErrors(error.body.fieldErrors);
      }
      setFormAlert(error instanceof Error ? error.message : 'Unable to sign in. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page" aria-labelledby="login-title">
      <section className="auth-card">
        <p className="eyebrow">TokTickIT / Secure access</p>
        <h1 id="login-title">Sign in to TokTickIT</h1>
        <p className="text-secondary">Use your TokTickIT account to access the service desk.</p>
        {loadState === 'error' && (
          <div role="alert" className="state-message state-message-error">
            <p>{errorMessage ?? 'Unable to check your session. Try again.'}</p>
            <button type="button" className="btn btn-secondary" onClick={retrySessionCheck} disabled={isSubmitting}>
              Retry session check
            </button>
          </div>
        )}
        <form className="auth-form" onSubmit={submit} noValidate aria-busy={isSubmitting}>
          {formAlert && <div role="alert" className="state-message state-message-error">{formAlert}</div>}
          <div className="field-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: '' }));
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            />
            {fieldErrors.email && <p id="login-email-error" role="alert" className="field-error">{fieldErrors.email}</p>}
          </div>
          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: '' }));
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            />
            {fieldErrors.password && <p id="login-password-error" role="alert" className="field-error">{fieldErrors.password}</p>}
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Log in'}
          </button>
        </form>
      </section>
    </main>
  );
}
