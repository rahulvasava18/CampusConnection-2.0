import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, MailWarning } from 'lucide-react';
import { ApiRequestError } from '../../lib/api-state';
import { Button, ErrorState } from '../../components/ui';
import { verifyEmail } from './auth.api';
import { AuthLayout, navigateAuth } from './AuthLayout';

export function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get('token');
  const attemptedTokenRef = useRef<string | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [error, setError] = useState('This verification link is missing its token.');

  useEffect(() => {
    if (!token) return;
    if (attemptedTokenRef.current === token) return;
    attemptedTokenRef.current = token;
    void verifyEmail(token)
      .then(() => setState('success'))
      .catch((requestError: unknown) => {
        const authError = requestError instanceof ApiRequestError ? requestError : undefined;
        setError(authError?.message ?? 'This verification link is invalid or expired.');
        setState('error');
      });
  }, [token]);

  if (state === 'loading') {
    return (
      <AuthLayout
        eyebrow="Email verification"
        title="Confirming your email."
        description="We are checking your secure verification link."
      >
        <div className="flex items-center justify-center gap-3 py-12 text-sm font-semibold text-muted">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" />
          Checking link…
        </div>
      </AuthLayout>
    );
  }
  if (state === 'success') {
    return (
      <AuthLayout
        eyebrow="Email verified"
        title="Your account is ready."
        description="Your email ownership is confirmed. You can now log in without being signed in automatically."
      >
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-success">
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <h3 className="type-display mt-6 text-2xl font-bold text-ink">Email verified</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            Your CampusConnection account is ready. Continue to login when you are ready.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            onClick={() => navigateAuth('/login')}
          >
            Continue to login
          </Button>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      eyebrow="Verification issue"
      title="This link needs attention."
      description="Verification links expire after 30 minutes and can only be used once."
    >
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <MailWarning className="h-8 w-8" />
        </span>
        <div className="mt-6 text-left">
          <ErrorState message={error} />
        </div>
        <div className="mt-6 grid gap-3">
          <Button type="button" size="lg" onClick={() => navigateAuth('/signup')}>
            Create an account
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigateAuth('/login')}>
            Back to login
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
