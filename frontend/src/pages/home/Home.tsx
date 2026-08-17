import { SocialHome } from '../../features/social/SocialHome';
import { HomeRightRail } from './components/HomeRightRail';

export function Home({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <section className="page-theme page-theme-home space-y-6">
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <SocialHome onNavigate={onNavigate} />
        <HomeRightRail onNavigate={onNavigate} />
      </div>
    </section>
  );
}
