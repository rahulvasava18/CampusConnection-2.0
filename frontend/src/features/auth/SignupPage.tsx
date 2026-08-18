import { ShieldCheck } from 'lucide-react';
import { AuthLayout, navigateAuth } from './AuthLayout';
import { GoogleAuthButton } from './GoogleAuthButton';

export function SignupPage() {
  return (
    <AuthLayout
      eyebrow="Create your account"
      title="Start with Google."
      description="Use your verified Google identity to join CampusConnection, then choose the username your campus community will see."
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
      <div className="grid gap-5">
        <GoogleAuthButton />
        <p className="flex gap-2 rounded-xl bg-brand-50 px-3 py-3 text-xs leading-5 text-brand-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          Your Google email is verified before your CampusConnection account is created. No password is required during signup.
        </p>
      </div>
    </AuthLayout>
  );
}
