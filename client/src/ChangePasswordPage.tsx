import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthRequestError, useAuth } from './auth-context';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  if (value.length > PASSWORD_MAX_LENGTH) return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters long.`;
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one number.';
  if (!/[^\p{L}\p{N}\s-]/u.test(value)) return 'Password must contain at least one symbol.';
  return null;
}

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, loadState, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loadState === 'unauthenticated') {
      navigate('/login', { replace: true });
    } else if (loadState === 'authenticated' && user && !user.mustChangePassword && !isSubmitting) {
      navigate(user.role === 'REQUESTER' ? '/tickets' : '/home', { replace: true });
    }
  }, [isSubmitting, loadState, navigate, user]);

  if (loadState === 'loading') {
    return <p role="status" className="page-status">Checking your session...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.mustChangePassword && !isSubmitting) {
    return <Navigate to={user.role === 'REQUESTER' ? '/tickets' : '/home'} replace />;
  }

  const updateField = (field: string, value: string, setter: (next: string) => void) => {
    setter(value);
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setFormAlert(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = 'Current password is required.';
    if (!newPassword) {
      nextErrors.newPassword = 'New password is required.';
    } else {
      const passwordError = validatePassword(newPassword);
      if (passwordError) nextErrors.newPassword = passwordError;
    }
    if (!confirmPassword || confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Passwords must match.';
    }
    setFieldErrors(nextErrors);
    setFormAlert(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      navigate(updatedUser.role === 'REQUESTER' ? '/tickets' : '/home', { replace: true });
    } catch (error) {
      if (error instanceof AuthRequestError && error.body?.fieldErrors) {
        setFieldErrors(error.body.fieldErrors);
      }
      setFormAlert(error instanceof Error ? error.message : 'Unable to change your password. Try again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page" aria-labelledby="change-password-title">
      <section className="auth-card">
        <p className="eyebrow">TokTickIT / Account security</p>
        <h1 id="change-password-title">Change your password</h1>
        <p className="text-secondary">Set a new password before continuing to the service desk.</p>
        <div className="password-rules" aria-label="Password rules">
          <strong>Password rules</strong>
          <p>Use 12 to 128 characters with an uppercase letter, a lowercase letter, a number, and a symbol.</p>
        </div>
        <form className="auth-form" onSubmit={submit} noValidate aria-busy={isSubmitting}>
          {formAlert && <div role="alert" className="state-message state-message-error">{formAlert}</div>}
          <div className="field-group">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => updateField('currentPassword', event.target.value, setCurrentPassword)}
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              aria-describedby={fieldErrors.currentPassword ? 'current-password-error' : undefined}
            />
            {fieldErrors.currentPassword && <p id="current-password-error" role="alert" className="field-error">{fieldErrors.currentPassword}</p>}
          </div>
          <div className="field-group">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => updateField('newPassword', event.target.value, setNewPassword)}
              aria-invalid={Boolean(fieldErrors.newPassword)}
              aria-describedby={fieldErrors.newPassword ? 'new-password-error' : undefined}
            />
            {fieldErrors.newPassword && <p id="new-password-error" role="alert" className="field-error">{fieldErrors.newPassword}</p>}
          </div>
          <div className="field-group">
            <label htmlFor="confirm-new-password">Confirm new password</label>
            <input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value, setConfirmPassword)}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={fieldErrors.confirmPassword ? 'confirm-new-password-error' : undefined}
            />
            {fieldErrors.confirmPassword && <p id="confirm-new-password-error" role="alert" className="field-error">{fieldErrors.confirmPassword}</p>}
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
            {isSubmitting ? 'Saving password...' : 'Save password'}
          </button>
        </form>
      </section>
    </main>
  );
}
