import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { ApiRequestError } from '../../lib/api-state';
import { ErrorState } from '../../components/ui';
import { exchangeGoogleCode } from './auth.api';
import { useAuthStore } from './auth.store';
import { AuthLayout, navigateAuth } from './AuthLayout';

export function GoogleCallbackPage() {
  const setGoogleOnboardingToken = useAuthStore((state) => state.setGoogleOnboardingToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setError('Google sign-in could not be completed. Please try again.');
      return () => {
        cancelled = true;
      };
    }
    void exchangeGoogleCode(code)
      .then((result) => {
        if (cancelled) return;
        if ('onboardingRequired' in result && result.onboardingRequired === true) {
          setGoogleOnboardingToken(result.onboardingToken);
          navigateAuth('/onboarding/username');
          return;
        }
        window.history.replaceState({}, '', '/home');
        window.dispatchEvent(new PopStateEvent('popstate'));
      })
      .catch((requestError) => {
        if (!cancelled)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Google sign-in could not be completed. Please try again.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [setGoogleOnboardingToken]);

  return (
    <AuthLayout
      eyebrow="Google sign-in"
      title="Finishing your sign-in."
      description="We are securely connecting your verified Google identity to CampusConnection."
    >
      {error ? (
        <div className="grid gap-4">
          <ErrorState message={error} />
          <button
            type="button"
            className="text-sm font-bold text-brand-600 hover:text-brand-700"
            onClick={() => navigateAuth('/login')}
          >
            Return to login
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-muted">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" />
          Verifying with Google…
        </div>
      )}
    </AuthLayout>
  );
}
