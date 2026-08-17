import type { ReactNode } from 'react';
import { Network } from 'lucide-react';
import { Badge, Card } from '../../components/ui';

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="surface-page min-h-screen px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="gradient-deep-campus relative hidden min-h-[680px] overflow-hidden rounded-[2rem] p-10 text-white shadow-[0_18px_50px_rgba(32,55,59,.18)] lg:block xl:p-14">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-400/40 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-yellow/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-600 text-white">
                <Network className="h-5 w-5" />
                <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-brand-800 bg-yellow" />
              </span>
              <div>
                <p className="type-display text-base font-bold">CampusConnection</p>
                <p className="type-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-200">
                  Stay connected
                </p>
              </div>
            </div>
            <div className="mt-28 max-w-lg">
              <Badge tone="warning">Built for campus life</Badge>
              <h1 className="type-display mt-6 text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
                Connect. Create. Collaborate.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-8 text-brand-100">
                Your campus ecosystem for finding people, ideas, teams, mentors, and opportunities
                that move you forward.
              </p>
            </div>
            <div className="mt-20 grid grid-cols-3 gap-3">
              {[
                ['01', 'Discover'],
                ['02', 'Build'],
                ['03', 'Grow'],
              ].map(([number, label]) => (
                <div key={number} className="rounded-xl border border-white/15 bg-white/10 p-3">
                  <p className="type-meta text-xs text-yellow">{number}</p>
                  <p className="type-ui mt-2 text-sm font-bold text-white">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-600 text-white">
              <Network className="h-5 w-5" />
            </span>
            <p className="type-display text-base font-bold text-ink">CampusConnection</p>
          </div>
          <div className="mb-8">
            <p className="type-ui text-xs font-bold uppercase tracking-[0.16em] text-brand-600">
              {eyebrow}
            </p>
            <h2 className="type-display mt-2 text-3xl font-bold tracking-tight text-ink">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </div>
          <Card className="p-5 shadow-[0_12px_35px_rgba(32,55,59,.1)] sm:p-7">{children}</Card>
          {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
        </section>
      </div>
    </main>
  );
}

export function navigateAuth(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
