import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Alert, Spinner } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/forgot-password', { body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link">
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success">
            If <strong>{email}</strong> is registered, a password reset link is on its way. Check
            your inbox.
          </Alert>
          <Link to="/login" className="btn-secondary w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Spinner className="h-4 w-4" />} Send reset link
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', { body: { token, password } });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        {!token && <Alert kind="error">This reset link is invalid. Request a new one.</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <button type="submit" disabled={busy || !token} className="btn-primary w-full">
          {busy && <Spinner className="h-4 w-4" />} Reset password
        </button>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is invalid.');
      return;
    }
    api<{ message: string }>('/auth/verify-email', { body: { token } })
      .then((res) => {
        setState('success');
        setMessage(res.message);
      })
      .catch((err: Error) => {
        setState('error');
        setMessage(err.message);
      });
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      <div className="space-y-4">
        {state === 'pending' && (
          <div className="flex items-center gap-3 text-slate-500">
            <Spinner /> {message}
          </div>
        )}
        {state === 'success' && <Alert kind="success">{message}</Alert>}
        {state === 'error' && <Alert kind="error">{message}</Alert>}
        <Link to="/dashboard" className="btn-primary w-full">Go to dashboard</Link>
      </div>
    </AuthLayout>
  );
}
