import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, MailCheck } from 'lucide-react';
import { ApiRequestError } from '../../lib/api-state';
import { Button, ErrorState, Field } from '../../components/ui';
import { login, resendVerification } from './auth.api';
import { AuthLayout, navigateAuth } from './AuthLayout';

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setVerificationRequired(false);
    setNotice(null);
    setLoading(true);
    try {
      await login({ identifier, password });
      window.history.replaceState({}, '', '/home');
    } catch (requestError) {
      const authError = requestError instanceof ApiRequestError ? requestError : undefined;
      setError(authError?.message ?? 'Unable to sign in right now. Please try again.');
      setVerificationRequired(authError?.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await resendVerification({ identifier });
      setNotice(`A new verification email was sent to ${result.email}.`);
    } catch (requestError) {
      const authError = requestError instanceof ApiRequestError ? requestError : undefined;
      setError(authError?.message ?? 'Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Continue where you left off."
      description="Sign in with the email or username you use for CampusConnection."
      footer={
        <span>
          Don't have an account?{' '}
          <button
            type="button"
            className="font-bold text-brand-600 hover:text-brand-700"
            onClick={() => navigateAuth('/signup')}
          >
            Create one
          </button>
        </span>
      }
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Field
          label="Email or username"
          aria-label="Email or username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="username or email@example.com"
          autoComplete="username"
          required
        />
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Password
          <span className="relative">
            <input
              aria-label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="type-body w-full rounded-[10px] border border-line bg-white px-3.5 py-3 pr-12 text-sm font-normal text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        {error ? <ErrorState message={error} /> : null}
        {notice ? (
          <p
            className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Signing in...' : 'Log in'}
        </Button>
        {verificationRequired ? (
          <Button
            type="button"
            variant="secondary"
            disabled={resending || !identifier.trim()}
            onClick={() => void resend()}
          >
            {resending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <MailCheck className="h-4 w-4" />
            )}
            {resending ? 'Sending...' : 'Resend verification'}
          </Button>
        ) : null}
      </form>
    </AuthLayout>
  );
}
