import { useEffect, useState, type ReactNode } from 'react';
import { LoaderCircle, RefreshCcw, ShieldAlert, Sparkles } from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const buttonVariants = {
  primary:
    'button-primary bg-brand-500 text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,.08)] hover:-translate-y-px hover:bg-brand-600 hover:shadow-[0_10px_24px_rgba(15,23,42,.12)] active:translate-y-0 active:scale-[.98]',
  secondary:
    'border border-line-strong bg-brand-100 text-slate-800 shadow-sm hover:-translate-y-px hover:border-brand-400 hover:bg-brand-200 active:translate-y-0 active:scale-[.98]',
  ghost: 'text-slate-600 hover:bg-brand-50 hover:text-brand-700 active:scale-[.98]',
  danger:
    'border border-red-200 bg-red-light text-red-dark hover:-translate-y-px hover:bg-red-100 active:scale-[.98]',
  success:
    'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:-translate-y-px hover:bg-emerald-100 active:scale-[.98]',
} as const;

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      className={cn(
        'type-ui inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50',
        buttonVariants[variant],
        size === 'sm' && 'px-3 py-2 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-[var(--surface-elevated)] shadow-[0_12px_28px_rgba(15,23,42,.07)] transition-colors duration-200',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string;
  src?: string | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = (name ?? 'CC')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return src && !imageFailed ? (
    <img
      src={src}
      alt={name ?? 'Profile'}
      onError={() => setImageFailed(true)}
      className={cn(
        'shrink-0 rounded-full object-cover ring-2 ring-brand-100 transition duration-200',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
        size === 'xl' && 'h-20 w-20',
        className,
      )}
    />
  ) : (
    <span
      aria-label={name ?? 'Profile'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white ring-2 ring-brand-100 transition duration-200',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
        size === 'xl' && 'h-20 w-20 text-lg',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span
      className={cn(
        'type-ui inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        tone === 'neutral' && 'bg-slate-100 text-slate-700',
        tone === 'brand' && 'bg-brand-100 text-brand-800',
        tone === 'success' && 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
        tone === 'warning' && 'bg-yellow-light text-yellow-dark',
        tone === 'danger' && 'bg-red-light text-red-dark',
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <label className={cn('grid gap-1.5 text-sm font-semibold text-slate-700', className)}>
      {label}
      <input
        className="type-body w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/20"
        {...props}
      />
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
      {hint && !error ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function TextareaField({
  label,
  error,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | undefined;
}) {
  return (
    <label className={cn('grid gap-1.5 text-sm font-semibold text-slate-700', className)}>
      {label}
      <textarea
        className="type-body min-h-28 w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none placeholder:text-slate-500 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/20"
        {...props}
      />
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="type-ui mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="type-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted" role="status">
      <LoaderCircle className="h-4 w-4 animate-spin text-brand-400" />
      {label}…
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 px-6 py-12 text-center shadow-[0_12px_30px_rgba(43,87,145,.1)]">
      <span className="mb-3 rounded-2xl bg-white p-3 text-[#00887a] shadow-sm">
        <Sparkles className="h-5 w-5" />
      </span>
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      {onRetry ? (
        <Button size="sm" variant="danger" onClick={onRetry}>
          <RefreshCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function RestrictedState({
  title = 'Verification required',
  message = 'Verify your email to unlock this part of CampusConnection.',
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
      <span className="rounded-xl bg-white/70 p-2 text-amber-600">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-amber-800">{message}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn('block animate-pulse rounded-xl bg-slate-200', className)}
      aria-hidden="true"
    />
  );
}
