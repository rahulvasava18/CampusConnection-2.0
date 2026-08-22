import { useState } from 'react';
import { ChevronRight, Network, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CommunityCard } from './components/CommunityCard';
import { Button, Card, EmptyState, ErrorState, Field, LoadingState } from '../../components/ui';
import { CompactPageTop } from '../../components/PageHeader';
import { WorkspaceCreateCard } from '../../components/WorkspaceCreateCard';
import { apiErrorMessage, collectionItems } from '../../lib/api-state';
import {
  getActiveDiscussions,
  getCommunities,
  getCommunityInvitations,
  getMyCommunities,
  joinCommunity,
  leaveCommunity,
  respondToCommunityInvitation,
} from '../../features/community/community.api';
import { DiscussionCard } from './components/DiscussionCard';

const categories = [
  'All',
  'Technology',
  'Design',
  'Academic',
  'Sports',
  'Clubs',
  'Entrepreneurship',
];

export function Communities({ onNavigate }: { onNavigate: (path: string) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [tags, setTags] = useState('');
  const communities = useQuery({
    queryKey: ['communities', search, activeCategory, tags],
    queryFn: () => getCommunities({ search, category: activeCategory, tags }),
  });
  const mine = useQuery({ queryKey: ['my-communities'], queryFn: getMyCommunities });
  const activeDiscussions = useQuery({
    queryKey: ['active-discussions'],
    queryFn: getActiveDiscussions,
  });
  const invitations = useQuery({
    queryKey: ['community-invitations'],
    queryFn: getCommunityInvitations,
  });
  const invitationAction = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToCommunityInvitation(id, accept),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });
  const membership = useMutation({
    mutationFn: async ({ id, joined }: { id: string; joined: boolean }) => {
      if (joined) await leaveCommunity(id);
      else await joinCommunity(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
      void queryClient.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });
  const items = collectionItems(communities.data);
  const myItems = collectionItems(mine.data);
  const discussionItems = collectionItems(activeDiscussions.data);

  return (
    <div className="page-theme page-theme-communities space-y-7">
      <CompactPageTop
        control={
          <Card className="min-h-[17rem] space-y-4 p-4 sm:p-5">
            <label className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
              <Search className="h-5 w-5 text-brand-500" />
              <span className="sr-only">Search communities</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search communities..."
                className="min-h-11 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
              />
            </label>
            <Field
              label="Filter by tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="AI, Python, Research"
            />
            <div className="flex flex-wrap gap-2" aria-label="Community categories">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition ${activeCategory === category ? 'bg-brand-600 text-white' : 'bg-white text-muted ring-1 ring-line hover:bg-brand-50 hover:text-brand-700'}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </Card>
        }
        header={
          <WorkspaceCreateCard
            kind="communities"
            onAction={() => onNavigate('/communities/create')}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="type-display text-xl font-bold text-ink">Discover communities</h2>
            <span className="text-xs font-semibold text-muted">{items.length} shown</span>
          </div>
          {communities.isLoading ? <LoadingState label="Finding communities" /> : null}
          {communities.error ? (
            <ErrorState
              message={apiErrorMessage(communities.error, 'Communities could not be loaded.')}
            />
          ) : null}
          {membership.error ? (
            <ErrorState
              message={apiErrorMessage(membership.error, 'Membership could not be updated.')}
            />
          ) : null}
          {!communities.isLoading && !communities.error && items.length === 0 ? (
            <EmptyState
              title="No communities found"
              description="Try another search or create the first space for this interest."
              action={
                <Button onClick={() => onNavigate('/communities/create')}>Create community</Button>
              }
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                onOpen={() => onNavigate(`/communities/${community.id}`)}
                onJoin={() => membership.mutate({ id: community.id, joined: false })}
                onLeave={() => membership.mutate({ id: community.id, joined: true })}
                busy={membership.isPending && membership.variables?.id === community.id}
              />
            ))}
          </div>
        </div>
        <aside className="space-y-5">
          {collectionItems(invitations.data).length ? (
            <Card className="p-5">
              <h2 className="type-display text-lg font-bold text-ink">Community invitations</h2>
              <div className="mt-3 space-y-2">
                {collectionItems(invitations.data).map((invitation) => (
                  <div key={invitation.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-ink">
                      {invitation.community?.name ?? 'Invitation to join a community'}
                    </p>
                    <p className="mt-1 text-xs text-muted">Invited by a CampusConnection member</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => invitationAction.mutate({ id: invitation.id, accept: true })}
                        disabled={invitationAction.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          invitationAction.mutate({ id: invitation.id, accept: false })
                        }
                        disabled={invitationAction.isPending}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">My communities</h2>
            {mine.isLoading ? <LoadingState label="Loading your spaces" /> : null}
            {!mine.isLoading && myItems.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                Join a community and it will appear here.
              </p>
            ) : null}
            <div className="mt-3 grid gap-2">
              {myItems.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => onNavigate(`/communities/${community.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-slate-50 px-3 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Network className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{community.name}</span>
                    <span className="mt-1 block text-xs font-normal text-muted">
                      {community.memberCount ?? 0} members
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="type-display text-lg font-bold text-ink">Active discussions</h2>
              <span className="text-xs font-semibold text-muted">Accessible spaces</span>
            </div>
            {activeDiscussions.isLoading ? <LoadingState label="Loading discussions" /> : null}
            {activeDiscussions.error ? (
              <ErrorState
                message={apiErrorMessage(
                  activeDiscussions.error,
                  'Active discussions could not be loaded.',
                )}
              />
            ) : null}
            {!activeDiscussions.isLoading &&
            !activeDiscussions.error &&
            discussionItems.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                Join a community and start a conversation when you are ready.
              </p>
            ) : null}
            <div className="mt-3 grid gap-3">
              {discussionItems.map((discussion) => (
                <DiscussionCard
                  key={discussion.id}
                  discussion={discussion}
                  onOpen={() => onNavigate(`/discussions/${discussion.id}`)}
                />
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
