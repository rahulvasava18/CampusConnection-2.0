import { ArrowUpRight, BriefcaseBusiness, FolderKanban, Network, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card } from '../../components/ui';

type DiscoveryCard = {
  label: string;
  title: string;
  description: string;
  cta: string;
  target: string;
  icon: LucideIcon;
};

const discoveryCards: DiscoveryCard[] = [
  {
    label: 'People',
    title: 'Meet people with shared interests',
    description: 'Discover students, mentors, creators, and people with shared interests.',
    cta: 'Explore people',
    target: 'search',
    icon: Users,
  },
  {
    label: 'Communities',
    title: 'Find your communities',
    description:
      'Find communities built around interests, knowledge, clubs, and campus conversations.',
    cta: 'Explore communities',
    target: 'communities',
    icon: Network,
  },
  {
    label: 'Teams',
    title: 'Build something together',
    description:
      'Discover teams looking for people to build, collaborate, and participate together.',
    cta: 'Explore teams',
    target: 'teams',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Projects',
    title: 'Explore campus projects',
    description: 'Explore projects being built by students and teams across your campus.',
    cta: 'Explore projects',
    target: 'projects',
    icon: FolderKanban,
  },
];

export function DefaultDiscoveryGrid({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <section aria-labelledby="discover-on-campus" className="space-y-4">
      <div>
        <h2 id="discover-on-campus" className="mt-1 font-display text-2xl font-bold text-ink">
          Few suggestions for you
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {discoveryCards.map(({ icon: Icon, ...card }) => (
          <Card
            key={card.label}
            className="theme-discovery-card group flex min-h-[190px] flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <Badge tone="brand">{card.label}</Badge>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-ink">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{card.description}</p>
            <button
              type="button"
              onClick={() => onNavigate(card.target)}
              className="mt-auto inline-flex items-center gap-1.5 pt-5 text-left text-sm font-bold text-brand-700 transition hover:text-brand-800"
            >
              {card.cta}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </Card>
        ))}
      </div>
    </section>
  );
}
