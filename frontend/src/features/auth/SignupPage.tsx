import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LoaderCircle, Mail, MailCheck } from 'lucide-react';
import { ApiRequestError } from '../../lib/api-state';
import { Button, ErrorState, Field } from '../../components/ui';
import { resendVerification, signup } from './auth.api';
import { AuthLayout, navigateAuth } from './AuthLayout';

export function SignupPage() {
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [created, setCreated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signup(form);
      setCreated(true);
    } catch (requestError) {
      const authError = requestError instanceof ApiRequestError ? requestError : undefined;
      if (authError?.code === 'USERNAME_ALREADY_EXISTS') setFieldError(authError.message);
      else setError(authError?.message ?? 'Unable to create your account right now.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const result = await resendVerification({ identifier: form.email });
      setNotice(`A new verification email was sent to ${result.email}.`);
    } catch (requestError) {
      const authError = requestError instanceof ApiRequestError ? requestError : undefined;
      setError(authError?.message ?? 'Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  }

  if (created) {
    return (
      <AuthLayout
        eyebrow="Next step"
        title="Check your email."
        description="Your account is created, but it stays locked until you verify your email."
        footer={
          <span>
            Ready to sign in?{' '}
            <button
              type="button"
              className="font-bold text-brand-600 hover:text-brand-700"
              onClick={() => navigateAuth('/login')}
            >
              Go to login
            </button>
          </span>
        }
      >
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Mail className="h-8 w-8" />
          </span>
          <h3 className="type-display mt-6 text-2xl font-bold text-ink">Verify {form.email}</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            We sent a verification link to this address. It expires in 30 minutes and must be used
            before you can log in.
          </p>
          {error ? (
            <div className="mt-5 text-left">
              <ErrorState message={error} />
            </div>
          ) : null}
          {notice ? (
            <p
              className="mt-5 rounded-xl bg-emerald-50 px-3 py-2.5 text-left text-sm font-semibold text-emerald-700"
              role="status"
            >
              {notice}
            </p>
          ) : null}
          <div className="mt-6 grid gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => window.location.assign(`mailto:${form.email}`)}
            >
              <MailCheck className="h-4 w-4" />
              Open email
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={resending}
              onClick={() => void resend()}
            >
              {resending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {resending ? 'Sending…' : 'Resend verification'}
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Create your account"
      title="Start with a verified identity."
      description="Four focused details are all you need to join your campus community."
      footer={
        <span>
          Already have an account?{' '}
          <button
            type="button"
            className="font-bold text-brand-600 hover:text-brand-700"
            onClick={() => navigateAuth('/login')}
          >
            Log in
          </button>
        </span>
      }
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Field
          label="Display name"
          aria-label="Display name"
          value={form.displayName}
          onChange={(event) => update('displayName', event.target.value)}
          placeholder="Enter your full name"
          autoComplete="name"
          required
        />
        <Field
          label="Username"
          aria-label="Username"
          value={form.username}
          onChange={(event) => update('username', event.target.value)}
          placeholder="Choose unique username"
          autoComplete="username"
          error={fieldError ?? undefined}
          required
        />
        <Field
          label="Email"
          aria-label="Email"
          type="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          placeholder="email@example.com"
          autoComplete="email"
          required
        />
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Password
          <span className="relative">
            <input
              aria-label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="At least 8 characters"
              className="type-body w-full rounded-[10px] border border-line bg-white px-3.5 py-3 pr-12 text-sm font-normal text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              autoComplete="new-password"
              minLength={8}
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
        <p className="flex gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-5 text-brand-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          You will verify ownership through a secure email link before your first login.
        </p>
        <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
