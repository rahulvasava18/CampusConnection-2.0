import { Card, SectionHeading } from '../../components/ui';

export function AdminSettings() {
  return <section className="space-y-6"><SectionHeading eyebrow="System" title="Admin settings" description="Operational guardrails for the control center." /><div className="grid gap-4 lg:grid-cols-2"><Card className="p-6"><h2 className="font-bold text-ink">Access control</h2><p className="mt-2 text-sm leading-6 text-muted">Administrative actions require a platform-admin role, CSRF protection, validated input, and an append-only audit record.</p></Card><Card className="p-6"><h2 className="font-bold text-ink">Data handling</h2><p className="mt-2 text-sm leading-6 text-muted">Analytics are generated from MongoDB aggregates. Suspicious activity is a review aid and never an automatic punishment engine.</p></Card></div></section>;
}
