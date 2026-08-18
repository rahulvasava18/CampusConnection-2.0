import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { continueWithGoogle } from './auth.api';

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      role="img"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.15c1.85-1.7 2.9-4.2 2.9-7.22Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.59 0 4.76-.86 6.35-2.33l-3.15-2.45c-.87.58-1.98.92-3.2.92-2.45 0-4.52-1.66-5.26-3.89H3.48v2.53A9.59 9.59 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.74 13.75A5.76 5.76 0 0 1 6.44 12c0-.61.1-1.2.3-1.75V7.72H3.48A9.5 9.5 0 0 0 2.5 12c0 1.54.37 2.99.98 4.28l3.26-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.36c1.41 0 2.68.49 3.68 1.45l2.76-2.76C16.76 3.5 14.59 2.5 12 2.5a9.59 9.59 0 0 0-8.52 5.22l3.26 2.53C7.48 8.02 9.55 6.36 12 6.36Z"
      />
    </svg>
  );
}

export function GoogleAuthButton() {
  const [redirecting, setRedirecting] = useState(false);

  function startGoogleSignIn() {
    if (redirecting) return;
    setRedirecting(true);
    continueWithGoogle();
  }

  return (
    <div className="grid gap-2.5">
      <button
        type="button"
        className="relative flex min-h-[48px] w-full items-center justify-center rounded-[4px] border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] shadow-sm transition hover:border-[#c7cacf] hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        onClick={startGoogleSignIn}
        disabled={redirecting}
        aria-busy={redirecting}
        aria-label="Sign in with Google"
      >
        <span className="absolute left-4 flex items-center">
          {redirecting ? <LoaderCircle className="h-5 w-5 animate-spin text-[#5f6368]" /> : <GoogleMark />}
        </span>
        <span>{redirecting ? 'Opening Google…' : 'Sign in with Google'}</span>
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">
        Secured by Google OAuth, powered by Google.
      </p>
    </div>
  );
}
