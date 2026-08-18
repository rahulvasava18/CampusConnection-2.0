import { useEffect, useState } from 'react';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { GoogleCallbackPage } from '../features/auth/GoogleCallbackPage';
import { GoogleOnboardingPage } from '../features/auth/GoogleOnboardingPage';

export function AuthRoutes() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    if (!['/login', '/signup', '/verify-email', '/auth/google/callback', '/onboarding/username'].includes(window.location.pathname)) {
      window.history.replaceState({}, '', '/login');
      setPath('/login');
    }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  if (path === '/signup') return <SignupPage />;
  if (path === '/verify-email') return <VerifyEmailPage />;
  if (path === '/auth/google/callback') return <GoogleCallbackPage />;
  if (path === '/onboarding/username') return <GoogleOnboardingPage />;
  return <LoginPage />;
}
