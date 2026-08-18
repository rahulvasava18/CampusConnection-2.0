import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { ApiRequestError } from '../../lib/api-state';
import { Button, ErrorState, Field } from '../../components/ui';
import {
  checkGoogleUsernameAvailability,
  completeGoogleOnboarding,
} from './auth.api';
import { useAuthStore } from './auth.store';
import { AuthLayout, navigateAuth } from './AuthLayout';

export function GoogleOnboardingPage() {
  const token = useAuthStore((state) => state.googleOnboardingToken);
  const clearToken = useAuthStore((state) => state.clearGoogleOnboardingToken);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token) navigateAuth('/login');
  }, [token]);

  async function checkUsername() {
    if (!token || !/^[a-zA-Z0-9_]{3,32}$/.test(username.trim())) {
      setAvailability(null);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      setAvailability((await checkGoogleUsernameAvailability({ onboardingToken: token, username })).available);
    } catch (requestError) {
      setAvailability(null);
      setError(requestError instanceof ApiRequestError ? requestError.message : 'Username availability is unavailable.');
    } finally {
      setChecking(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || availability !== true) return;
    setLoading(true);
    setError(null);
    try {
      await completeGoogleOnboarding({ onboardingToken: token, displayName, username });
      clearToken();
      window.history.replaceState({}, '', '/home');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : 'Unable to create your account.');
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Complete your account"
      title="Create your CampusConnection username."
      description="Your Google account is verified. Choose the identity your campus community will see."
      footer={
        <button type="button" className="font-bold text-brand-600 hover:text-brand-700" onClick={() => navigateAuth('/login')}>
          Start Google sign-in again
        </button>
      }
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Display name" aria-label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we greet you?" autoComplete="name" required />
        <Field label="Username" aria-label="Username" value={username} onChange={(event) => { setUsername(event.target.value); setAvailability(null); }} onBlur={() => void checkUsername()} placeholder="Choose a unique username" autoComplete="username" required />
        {checking ? <p className="text-xs font-semibold text-muted">Checking username availability…</p> : null}
        {availability === true ? <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Username is available.</p> : null}
        {availability === false ? <p className="text-xs font-semibold text-red-600">Username is already taken.</p> : null}
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" size="lg" disabled={loading || checking || availability !== true} className="mt-2 w-full">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
