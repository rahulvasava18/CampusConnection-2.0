import { CompactPageHeader } from '../../components/PageHeader';
import { DiscoveryHome } from '../../features/discovery/DiscoveryHome';

export function Search({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <section className="page-theme page-theme-search mx-auto w-full max-w-6xl space-y-6">
      <DiscoveryHome
        onNavigate={onNavigate}
        compactHeader={
          <CompactPageHeader
            eyebrow="Discovery / Search"
            title="Find what you’re looking for."
            description="Search people, teams, communities, and projects across your campus."
          />
        }
      />
    </section>
  );
}
