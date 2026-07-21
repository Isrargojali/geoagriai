import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@geoagri/shared';
import { useAuth } from '@/lib/auth';
import { Alert, Spinner } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({
      ...form,
      phone: form.phone || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form');
      return;
    }

    setBusy(true);
    try {
      await register(parsed.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start your 14-day free trial — no credit card required">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">First name</label>
            <input id="firstName" required className="input" value={form.firstName} onChange={set('firstName')} />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name</label>
            <input id="lastName" required className="input" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" className="input" placeholder="+92 300 1234567" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            className="input"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-slate-500">
            At least 8 characters with uppercase, lowercase and a digit.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Spinner className="h-4 w-4" />} Create account
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
