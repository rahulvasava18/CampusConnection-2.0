import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { ApiRequestError } from '../../lib/api-state';
import { ErrorState } from '../../components/ui';
import { exchangeGooglePasswordRecoveryCode } from '../settings/settings.api';
import { AuthLayout } from './AuthLayout';

const messageType = 'campusconnection-password-recovery';

function notifyOpener(status: 'verified' | 'error', message?: string) {
  window.opener?.postMessage(
    { type: messageType, status, ...(message ? { message } : {}) },
    window.location.origin,
  );
}

export function GooglePasswordRecoveryCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.search).has('error')) {
      const message = 'Google verification was cancelled or could not be completed.';
      setError(message);
      notifyOpener('error', message);
      return () => {
        cancelled = true;
      };
    }
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      const message = 'Google verification could not be completed. Please try again.';
      setError(message);
      notifyOpener('error', message);
      return () => {
        cancelled = true;
      };
    }
    void exchangeGooglePasswordRecoveryCode(code)
      .then(() => {
        if (cancelled) return;
        notifyOpener('verified');
        window.setTimeout(() => window.close(), 250);
      })
      .catch((requestError) => {
        if (cancelled) return;
        const message =
          requestError instanceof ApiRequestError
            ? requestError.message
            : 'Google verification could not be completed. Please try again.';
        setError(message);
        notifyOpener('error', message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthLayout
      eyebrow="Password recovery"
      title="Verifying your identity."
      description="We are confirming that your Google account belongs to this CampusConnection account."
    >
      {error ? (
        <ErrorState message={error} />
      ) : (
        <div className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-muted">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand-600" />
          Verifying with Google…
        </div>
      )}
    </AuthLayout>
  );
}
