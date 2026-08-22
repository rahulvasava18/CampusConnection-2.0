import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button, cn } from '../../components/ui';
import type { SuspensionDuration } from '../../features/admin/admin.api';

export function AdminDangerDialog({
  open,
  title,
  description,
  target,
  reasonLabel = 'Reason',
  confirmationLabel,
  confirmLabel,
  tone = 'danger',
  loading = false,
  error,
  onClose,
  onConfirm,
  duration,
  durationValue,
  onDurationChange,
}: {
  open: boolean;
  title: string;
  description: string;
  target: string;
  reasonLabel?: string;
  confirmationLabel?: string;
  confirmLabel: string;
  tone?: 'warning' | 'danger';
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reason: string, confirmation: string) => void;
  duration?: boolean;
  durationValue?: SuspensionDuration;
  onDurationChange?: (value: SuspensionDuration) => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setConfirmation('');
    reasonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose, open]);

  if (!open) return null;
  const valid = reason.trim().length > 0 && (!confirmationLabel || confirmation === confirmationLabel);
  return (
    <div className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center bg-slate-950/45 p-4" role="presentation">
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-[var(--surface-elevated)] p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
        <button type="button" onClick={onClose} disabled={loading} aria-label="Close dialog" className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-[var(--surface-secondary)] hover:text-ink">
          <X className="h-4 w-4" />
        </button>
        <div className={cn('mb-4 inline-flex rounded-xl p-3', tone === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 id="admin-dialog-title" className="pr-8 text-xl font-bold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        <p className="mt-3 rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-sm font-semibold text-ink">{target}</p>
        {duration && durationValue && onDurationChange ? (
          <label className="mt-4 grid gap-2 text-sm font-semibold text-ink">
            Duration
            <select value={durationValue} onChange={(event) => onDurationChange(event.target.value as SuspensionDuration)} className="rounded-xl border border-line bg-[var(--surface-primary)] px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10">
              <option value="24h">24 hours</option>
              <option value="3d">3 days</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="indefinite">Indefinite</option>
            </select>
          </label>
        ) : null}
        <label className="mt-5 grid gap-2 text-sm font-semibold text-ink">
          {reasonLabel}
          <textarea ref={reasonRef} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-xl border border-line bg-[var(--surface-primary)] px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" placeholder="Add a clear moderation reason" />
        </label>
        {confirmationLabel ? (
          <label className="mt-4 grid gap-2 text-sm font-semibold text-ink">
            Type {confirmationLabel} to confirm
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="rounded-xl border border-line bg-[var(--surface-primary)] px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" />
          </label>
        ) : null}
        {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="button" variant={tone === 'warning' ? 'secondary' : 'danger'} onClick={() => onConfirm(reason.trim(), confirmation)} disabled={!valid || loading}>
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
