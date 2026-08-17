import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { cn } from './ui';
import { primaryNav, workspaceNav, type RouteId } from '../lib/navigation';

export function Sidebar({ onNavigate }: { onNavigate: (target: string) => void }) {
  const activeSection = useAppStore((state) => state.activeSection);
  const renderItem = (
    item: { id: RouteId; label: string; icon: LucideIcon },
    showChevron = false,
  ) => {
    const Icon = item.icon;
    const active = activeSection === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.id)}
        className={cn(
          'type-ui relative flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left text-sm font-semibold transition duration-150',
          active
            ? 'bg-brand-100 text-brand-800 shadow-[0_0_20px_rgba(119,166,247,.12)] before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand-500'
            : 'text-slate-600 hover:bg-brand-50 hover:text-slate-800',
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {item.label}
        {showChevron && active ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
      </button>
    );
  };
  return (
    <aside className="sticky top-[4.5rem] hidden h-[calc(100vh-4.5rem)] w-64 shrink-0 border-r border-brand-200 bg-white px-4 py-7 backdrop-blur lg:block">
      <nav aria-label="Primary navigation" className="flex h-full flex-col">
        <div className="space-y-1">{primaryNav.map((item) => renderItem(item, true))}</div>
        <div className="my-6 border-t border-line" />
        <p className="type-ui px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </p>
        <div className="mt-2 space-y-1">{workspaceNav.map((item) => renderItem(item))}</div>
      </nav>
    </aside>
  );
}
