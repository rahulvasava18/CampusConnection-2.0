import type { useAuthStore } from '../features/auth/auth.store';
import { Home } from '../pages/home/Home';
import { Search } from '../pages/search/Search';
import { Communities as Community } from '../pages/community/Community';
import { CommunityDetail } from '../pages/community/CommunityDetail';
import { CreateCommunity } from '../pages/community/CreateCommunity';
import { CreateTeam } from '../pages/team/CreateTeam';
import { TeamDetail } from '../pages/team/TeamDetail';
import { Teams } from '../pages/teams/Teams';
import { CreateProject } from '../pages/project/CreateProject';
import { Projects } from '../pages/project/Projects';
import { ProjectDetail } from '../pages/project/ProjectDetail';
import { CreateEvent } from '../pages/event/CreateEvent';
import { Events } from '../pages/event/Events';
import { EventDetail } from '../pages/event/EventDetail';
import { CreateDiscussion } from '../pages/community/CreateDiscussion';
import { DiscussionDetail } from '../pages/community/DiscussionDetail';
import { Messages } from '../pages/messages/Messages';
import { ForYou } from '../pages/for-you/ForYou';
import { Resources } from '../pages/resources/Resources';
import { Profile } from '../pages/profile/Profile';
import { Settings } from '../pages/settings/Settings';
import { Post } from '../pages/post/Post';
import { Notifications } from '../pages/notifications/Notifications';
import type { RouteId } from '../lib/navigation';

type AppUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;

export function AppRoutes({
  route,
  user,
  onNavigate,
  onSignOut,
}: {
  route: RouteId;
  user: AppUser;
  onNavigate: (target: string) => void;
  onSignOut: () => void;
}) {
  switch (route) {
    case 'search':
      return <Search onNavigate={onNavigate} />;
    case 'communities':
      return <Community onNavigate={onNavigate} />;
    case 'communityCreate':
      return <CreateCommunity onNavigate={onNavigate} />;
    case 'teamCreate':
      return <CreateTeam onNavigate={onNavigate} />;
    case 'teamDetail':
      return (
        <TeamDetail
          teamId={window.location.pathname.split('/')[2] ?? ''}
          invitationPreview={
            new URLSearchParams(window.location.search).get('from') === 'invitation'
          }
          onNavigate={onNavigate}
        />
      );
    case 'projectCreate':
      return <CreateProject onNavigate={onNavigate} />;
    case 'projectDetail':
      return (
        <ProjectDetail
          projectId={window.location.pathname.split('/')[2] ?? ''}
          onNavigate={onNavigate}
        />
      );
    case 'eventCreate':
      return <CreateEvent onNavigate={onNavigate} />;
    case 'eventDetail':
      return (
        <EventDetail
          eventId={window.location.pathname.split('/')[2] ?? ''}
          onNavigate={onNavigate}
        />
      );
    case 'communityDetail':
      return (
        <CommunityDetail
          communityId={window.location.pathname.split('/')[2] ?? ''}
          onNavigate={onNavigate}
        />
      );
    case 'discussionCreate':
      return (
        <CreateDiscussion
          communityId={window.location.pathname.split('/')[2] ?? ''}
          onNavigate={onNavigate}
        />
      );
    case 'discussionDetail':
      return (
        <DiscussionDetail
          discussionId={window.location.pathname.split('/')[2] ?? ''}
          onNavigate={onNavigate}
        />
      );
    case 'messages':
      return <Messages onNavigate={onNavigate} />;
    case 'notifications':
      return <Notifications onNavigate={onNavigate} />;
    case 'recommendations':
      return <ForYou onNavigate={onNavigate} />;
    case 'post':
      return <Post onNavigate={onNavigate} />;
    case 'teams':
      return <Teams onNavigate={onNavigate} />;
    case 'projects':
      return <Projects onNavigate={onNavigate} />;
    case 'events':
      return <Events onNavigate={onNavigate} />;
    case 'profile':
      return (
        <Profile
          user={user}
          onNavigate={onNavigate}
          profileId={window.location.pathname.match(/^\/users\/([^/]+)\/profile$/)?.[1]}
        />
      );
    case 'settings':
      return <Settings onSignOut={onSignOut} />;
    case 'resources':
      return <Resources onNavigate={onNavigate} />;
    case 'home':
    default:
      return <Home onNavigate={onNavigate} />;
  }
}
