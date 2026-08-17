import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { cn } from '../../components/ui';

export function CreateResourceLayout({
  eyebrow,
  title,
  description,
  backLabel,
  onBack,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'page-theme mx-auto w-full max-w-2xl space-y-6',
        eyebrow.includes('Communities') && 'page-theme-communities',
        eyebrow.includes('Teams') && 'page-theme-teams',
        eyebrow.includes('Projects') && 'page-theme-projects',
        eyebrow.includes('Events') && 'page-theme-events',
      )}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-bold text-muted transition hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </button>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </div>
  );
}
