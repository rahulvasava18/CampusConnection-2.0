import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createClub } from '../../features/club/club.api';
import { Badge, Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
import { CompactPageHeader } from '../../components/PageHeader';
import { apiErrorMessage } from '../../lib/api-state';

type ClubForm = {
  name: string;
  slug: string;
  category: string;
  description: string;
  shortDescription: string;
  contactEmail: string;
  collegeId: string;
  privacy: 'PUBLIC' | 'PRIVATE';
};

const initialForm: ClubForm = {
  name: '',
  slug: '',
  category: 'Technical',
  description: '',
  shortDescription: '',
  contactEmail: '',
  collegeId: '',
  privacy: 'PUBLIC',
};

export function CreateClub({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const update = <K extends keyof ClubForm>(key: K, value: ClubForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: () => createClub(form),
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <div className="space-y-6">
        <CompactPageHeader
          eyebrow="Clubs / Verification"
          title="Your application is in review."
          description="An administrator will review the organization details before it becomes an official CampusConnection club."
        />
        <Card className="max-w-3xl p-5 sm:p-7">
          <Badge tone="warning">Pending admin approval</Badge>
          <h2 className="type-display mt-4 text-2xl font-bold text-ink">Thanks for starting something official.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">You can return to the club directory while your application is reviewed. The club will not be able to publish official events until it is approved.</p>
          <Button className="mt-5" onClick={() => onNavigate('/clubs')}>Back to clubs</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CompactPageHeader
        eyebrow="Clubs / Verification"
        title="Create a club."
        description="Submit a campus organization for review. Admin approval is required before it can represent your campus or publish official events."
      />
      <Card className="max-w-3xl p-5 sm:p-7">
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Club name" required value={form.name} onChange={(event) => update('name', event.target.value)} />
            <Field label="Slug" required value={form.slug} onChange={(event) => update('slug', event.target.value)} placeholder="nirma-coding-club" />
            <Field label="Category" required value={form.category} onChange={(event) => update('category', event.target.value)} />
            <Field label="Contact email" required type="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} />
            <Field label="College / institution" required value={form.collegeId} onChange={(event) => update('collegeId', event.target.value)} />
            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              Privacy
              <select aria-label="Privacy" required value={form.privacy} onChange={(event) => update('privacy', event.target.value as ClubForm['privacy'])} className="min-h-11 rounded-xl border border-line bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400">
                <option value="PUBLIC">Public club</option>
                <option value="PRIVATE">Private club</option>
              </select>
            </label>
          </div>
          <Field label="Short description" required value={form.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} />
          <TextareaField label="Full description" required value={form.description} onChange={(event) => update('description', event.target.value)} />
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-800">Applications are reviewed by CampusConnection administrators. Pending or rejected clubs cannot create events.</p>
          {mutation.error ? <ErrorState message={apiErrorMessage(mutation.error, 'Club application could not be submitted.')} /> : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => onNavigate('/clubs')}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Submitting...' : 'Submit for verification'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
