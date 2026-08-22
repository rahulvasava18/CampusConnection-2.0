import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { login, logout } from './auth.api';
import { useAuthStore } from './auth.store';
import { Button, Card, Field } from '../../components/ui';

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const session = await login({ identifier: email, password });
      if (!session.user.roles.includes('PLATFORM_ADMIN')) {
        await logout().catch(() => undefined);
        useAuthStore.getState().clearSession();
        setError('Administrator access is required.');
        return;
      }
      window.location.assign('/admin');
    } catch {
      setError('Unable to sign in to the administrator workspace.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-page)] p-4">
      <Card className="w-full max-w-md p-7 sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="rounded-2xl bg-brand-500 p-3 text-white"><ShieldCheck className="h-6 w-6" /></span>
          <div><p className="type-ui text-xs font-black uppercase tracking-[0.18em] text-brand-600">CampusConnection</p><h1 className="mt-1 type-display text-2xl font-bold text-ink">Admin control center</h1></div>
        </div>
        <p className="mb-6 text-sm leading-6 text-muted">Protected administrator access using your existing CampusConnection session.</p>
        <form className="grid gap-4" onSubmit={submit}>
          <Field label="Email or username" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          {error ? <p className="text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </Card>
    </main>
  );
}
