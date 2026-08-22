import { useQuery } from '@tanstack/react-query';
import type { ProjectView, TeamView } from '@campusconnection/shared';
import { getProjects, getTeams } from '../../features/collaboration/collaboration.api';
import { useAuthStore } from '../../features/auth/auth.store';
import { collectionItems } from '../../lib/api-state';
import {
  ResourceDiscoveryPage,
  resourceIcons,
  type ResourceDiscoveryItem,
} from './ResourceDiscoveryPage';

function teamItem(team: TeamView): ResourceDiscoveryItem {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    ownerId: team.ownerId,
    status: team.status,
    metadata: `${team.visibility.toLowerCase()} · max ${team.maxMembers ?? 'open'} members`,
  };
}

function projectItem(project: ProjectView): ResourceDiscoveryItem {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    status: project.status,
    metadata: project.technologies.length ? project.technologies.join(' · ') : 'Campus project',
  };
}

export function TeamsPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });
  const userId = useAuthStore((state) => state.user?.id);
  const items = collectionItems(teams.data).map(teamItem);
  return (
    <ResourceDiscoveryPage
      resourceLabel="Team"
      resourcePlural="Teams"
      searchPlaceholder="Search teams..."
      heading="Discover teams"
      filters={['All', 'Recruiting', 'Active', 'Completed']}
      items={items}
      myItems={items.filter((item) => item.ownerId === userId)}
      isLoading={teams.isLoading}
      error={teams.error}
      onRetry={() => void teams.refetch()}
      onNavigate={onNavigate}
      icon={resourceIcons.team}
      createTitle="Build your team."
      createLabel="team"
      createDescription="Find people to collaborate with and create something together."
      activityTitle="Active team activity"
      activityDescription="Team activity will appear here as teams start building together."
      createTarget="/teams/create"
    />
  );
}

export function ProjectsPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });
  const userId = useAuthStore((state) => state.user?.id);
  const items = collectionItems(projects.data).map(projectItem);
  return (
    <ResourceDiscoveryPage
      resourceLabel="Project"
      resourcePlural="Projects"
      searchPlaceholder="Search projects..."
      heading="Discover projects"
      filters={['All', 'Planning', 'Active', 'Completed']}
      items={items}
      myItems={items.filter((item) => item.ownerId === userId)}
      isLoading={projects.isLoading}
      error={projects.error}
      onRetry={() => void projects.refetch()}
      onNavigate={onNavigate}
      icon={resourceIcons.project}
      createTitle="Give your project a home."
      createLabel="project"
      createDescription="Organize the work, people, and ideas behind what you are building."
      activityTitle="Recent project activity"
      activityDescription="Recent project activity will appear here as campus work moves forward."
      createTarget="/projects/create"
    />
  );
}

export function EventsPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <ResourceDiscoveryPage
      resourceLabel="Event"
      resourcePlural="Events"
      searchPlaceholder="Search events..."
      heading="Discover events"
      filters={['All']}
      items={[]}
      myItems={[]}
      isLoading={false}
      error={undefined}
      onNavigate={onNavigate}
      icon={resourceIcons.event}
      createTitle="Bring your campus together."
      createLabel="event"
      createDescription="Create an event, workshop, competition, or hackathon."
      activityTitle="Upcoming / recent event activity"
      activityDescription="Events will appear here when event discovery is available."
      showCreateCard={false}
    />
  );
}
