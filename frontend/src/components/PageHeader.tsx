import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="gradient-campus-dawn relative overflow-hidden rounded-[1.5rem] border border-brand-200 px-5 py-6 shadow-[0_16px_34px_rgba(15,23,42,.07)] sm:px-7 sm:py-8">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="type-ui text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
            {eyebrow}
          </p>
          <h1 className="type-display mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function CompactPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="gradient-campus-dawn flex h-full min-h-[9rem] flex-col justify-between overflow-hidden rounded-2xl border border-brand-200 p-5 shadow-[0_14px_30px_rgba(15,23,42,.07)] sm:p-6">
      <div>
        <p className="type-ui text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">
          {eyebrow}
        </p>
        <h1 className="type-display mt-2 text-2xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-700">{description}</p>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function CompactPageTop({
  control,
  header,
}: {
  control: ReactNode;
  header: ReactNode;
}) {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,2.4fr)_minmax(240px,1fr)]">
      <div className="min-w-0 [&>*]:h-full">{control}</div>
      <div className="min-w-0">{header}</div>
    </div>
  );
}
