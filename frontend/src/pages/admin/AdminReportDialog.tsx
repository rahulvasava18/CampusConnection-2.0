import { useEffect, useState } from 'react';
import { Button, Card, TextareaField } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-state';
import { createAdminReport, type AdminReportReason, type AdminReportTargetType } from '../../features/admin/admin.api';
import { useMutation } from '@tanstack/react-query';

const reasons: Array<{ value: AdminReportReason; label: string }> = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'ABUSE', label: 'Abuse' },
  { value: 'MISLEADING_INFORMATION', label: 'Misleading information' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Other' },
];

export function AdminReportDialog({ open, targetType, targetId, onClose }: { open: boolean; targetType: AdminReportTargetType; targetId: string; onClose: () => void }) {
  const [reason, setReason] = useState<AdminReportReason>('SPAM');
  const [description, setDescription] = useState('');
  const mutation = useMutation({ mutationFn: () => createAdminReport({ targetType, targetId, reason, ...(description.trim() ? { description: description.trim() } : {}) }), onSuccess: onClose });
  const resetMutation = mutation.reset;
  useEffect(() => { if (open) { setReason('SPAM'); setDescription(''); resetMutation(); } }, [open, resetMutation]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
      <Card className="relative w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="report-content-title">
        <h2 id="report-content-title" className="text-xl font-bold text-ink">Report content</h2>
        <p className="mt-1 text-sm text-muted">Reports help the CampusConnection team review content. They do not automatically punish anyone.</p>
        <div className="mt-5 grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-ink">Why are you reporting this?</legend>
            {reasons.map((item) => <label key={item.value} className="flex items-center gap-2 text-sm text-muted"><input type="radio" name="report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />{item.label}</label>)}
          </fieldset>
          <TextareaField label="Additional details" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Add helpful context (optional)" />
          {mutation.error ? <p className="text-sm font-semibold text-red-600" role="alert">{apiErrorMessage(mutation.error, 'The report could not be submitted.')}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? 'Submitting…' : 'Submit report'}</Button></div>
        </div>
      </Card>
    </div>
  );
}
