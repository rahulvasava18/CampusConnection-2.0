import { useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileView, SocialPostView } from '@campusconnection/shared';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Edit3,
  FolderKanban,
  GraduationCap,
  Heart,
  MessageCircle,
  Save,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  RestrictedState,
  TextareaField,
  cn,
} from '../../components/ui';
import {
  apiErrorMessage,
  collectionItems,
  isRestrictedApiError,
  ApiRequestError,
} from '../../lib/api-state';
import type { useAuthStore } from '../../features/auth/auth.store';
import { updateProfile, type ProfileUpdateInput } from '../../features/auth/auth.api';
import { getProfile } from '../../features/profile/profile.api';
import { createDirectConversation } from '../../features/communication/communication.api';
import {
  cancelConnection,
  getConnectionRequests,
  getConnections,
  requestConnection,
  respondConnection,
} from '../../features/social/social.api';
import { PostCard } from '../../features/social/components/PostCard';

type ProfileTab = 'overview' | 'posts' | 'projects' | 'teams' | 'communities' | 'events';
const tabs: Array<{ id: ProfileTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'posts', label: 'Posts' },
  { id: 'projects', label: 'Projects' },
  { id: 'teams', label: 'Teams' },
  { id: 'communities', label: 'Communities' },
  { id: 'events', label: 'Events' },
];

function splitList(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
function SectionTitle({
  eyebrow,
  title,
  count,
}: {
  eyebrow: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="type-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
          {eyebrow}
        </p>
        <h2 className="type-display mt-1 text-xl font-bold text-ink">{title}</h2>
      </div>
      {count !== undefined ? (
        <span className="text-xs font-semibold text-muted">{count} total</span>
      ) : null}
    </div>
  );
}
function Stat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'rounded-xl px-3 py-3 text-left transition',
        onClick && 'hover:bg-brand-50',
        active && 'bg-brand-50',
      )}
    >
      <span className="block text-2xl font-bold text-ink">{value}</span>
      <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
    </button>
  );
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: ProfileView['projects'][number];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-cyan/70">
        {project.coverImageUrl ? (
          <img src={project.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FolderKanban className="absolute bottom-4 right-4 h-12 w-12 text-white/30" />
        )}
        <Badge tone={project.status === 'ACTIVE' ? 'success' : 'neutral'}>{project.status}</Badge>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-ink">{project.name}</h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-500" />
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">{project.description}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>
            {project.role} · {project.progressPercent}% complete
          </span>
          <span>{project.technologies.slice(0, 2).join(' · ') || 'Campus project'}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span
            className="block h-full rounded-full bg-brand-600"
            style={{ width: `${project.progressPercent}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function ProfileEdit({ profile, onSaved }: { profile: ProfileView; onSaved: () => void }) {
  const [values, setValues] = useState({
    displayName: profile.user.displayName,
    bio: profile.user.bio ?? '',
    college: profile.user.college ?? '',
    department: profile.user.department ?? '',
    course: profile.user.course ?? '',
    graduationYear: profile.user.graduationYear ? String(profile.user.graduationYear) : '',
    skills: profile.user.skills.join(', '),
    interests: profile.user.interests.join(', '),
    goals: profile.user.goals.join(', '),
    avatarUrl: profile.user.avatarUrl ?? '',
  });
  const save = useMutation({
    mutationFn: (): Promise<unknown> => {
      const input: ProfileUpdateInput = {
        displayName: values.displayName.trim(),
        bio: values.bio.trim(),
        college: values.college.trim(),
        department: values.department.trim(),
        course: values.course.trim(),
        skills: splitList(values.skills),
        interests: splitList(values.interests),
        goals: splitList(values.goals),
        ...(values.graduationYear.trim() ? { graduationYear: Number(values.graduationYear) } : {}),
        ...(values.avatarUrl.trim() ? { avatarUrl: values.avatarUrl.trim() } : {}),
      };
      return updateProfile(input);
    },
    onSuccess: onSaved,
  });
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
          <Edit3 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Edit profile</h2>
          <p className="mt-1 text-sm text-muted">
            Make your campus identity clearer to the people you want to meet.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Display name"
          value={values.displayName}
          onChange={(event) => set('displayName', event.target.value)}
          maxLength={100}
        />
        <Field
          label="Username"
          value={`@${profile.user.username}`}
          readOnly
          hint="Username changes are managed by authentication."
        />
        <Field
          label="College"
          value={values.college}
          onChange={(event) => set('college', event.target.value)}
        />
        <Field
          label="Department"
          value={values.department}
          onChange={(event) => set('department', event.target.value)}
        />
        <Field
          label="Course"
          value={values.course}
          onChange={(event) => set('course', event.target.value)}
        />
        <Field
          label="Graduation year"
          value={values.graduationYear}
          onChange={(event) => set('graduationYear', event.target.value)}
          inputMode="numeric"
        />
        <Field
          label="Avatar image URL"
          value={values.avatarUrl}
          onChange={(event) => set('avatarUrl', event.target.value)}
          hint="Uses the existing avatar URL field; profile upload is not configured."
          className="sm:col-span-2"
        />
        <TextareaField
          label="Bio"
          value={values.bio}
          onChange={(event) => set('bio', event.target.value)}
          maxLength={500}
          className="sm:col-span-2"
        />
        <Field
          label="Skills"
          value={values.skills}
          onChange={(event) => set('skills', event.target.value)}
          hint="Comma-separated"
        />
        <Field
          label="Interests"
          value={values.interests}
          onChange={(event) => set('interests', event.target.value)}
          hint="Comma-separated"
        />
        <Field
          label="Goals"
          value={values.goals}
          onChange={(event) => set('goals', event.target.value)}
          hint="Comma-separated"
        />
      </div>
      {save.error ? (
        <p className="mt-3 text-sm text-red-600">
          {apiErrorMessage(save.error, 'Profile could not be saved.')}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={!values.displayName.trim() || save.isPending}
        >
          <Save className="h-4 w-4" />
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </Card>
  );
}

export function Profile({
  user,
  onNavigate,
  profileId,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  onNavigate: (target: string) => void;
  profileId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const targetUserId = profileId ?? user.id;
  const ownProfile = targetUserId === user.id;
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [editing, setEditing] = useState(false);
  const [postFilter, setPostFilter] = useState('ALL');
  const profileQuery = useInfiniteQuery({
    queryKey: ['profile', targetUserId],
    queryFn: ({ pageParam }) => getProfile(targetUserId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.posts.pagination.nextCursor ?? undefined,
  });
  const connections = useQuery({
    queryKey: ['connections'],
    queryFn: () => getConnections(),
    enabled: !ownProfile,
  });
  const incomingRequests = useQuery({
    queryKey: ['connection-requests', 'incoming'],
    queryFn: () => getConnectionRequests('incoming'),
    enabled: !ownProfile,
  });
  const outgoingRequests = useQuery({
    queryKey: ['connection-requests', 'outgoing'],
    queryFn: () => getConnectionRequests('outgoing'),
    enabled: !ownProfile,
  });
  const relationshipRequestInFlight = useRef(false);
  const invalidateRelationships = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['connections'] }),
      queryClient.invalidateQueries({ queryKey: ['connection-requests', 'incoming'] }),
      queryClient.invalidateQueries({ queryKey: ['connection-requests', 'outgoing'] }),
    ]).then(() => undefined);
  const connect = useMutation({
    mutationFn: () => requestConnection(targetUserId),
    onMutate: () => {
      relationshipRequestInFlight.current = true;
    },
    onSuccess: () => invalidateRelationships(),
    onError: async (error) => {
      if (error instanceof ApiRequestError && error.status === 409) await invalidateRelationships();
    },
    onSettled: () => {
      relationshipRequestInFlight.current = false;
    },
  });
  const respond = useMutation({
    mutationFn: ({ requestId, accepted }: { requestId: string; accepted: boolean }) =>
      respondConnection(requestId, accepted),
    onSuccess: () => invalidateRelationships(),
  });
  const cancel = useMutation({
    mutationFn: () => cancelConnection(targetUserId),
    onSuccess: () => invalidateRelationships(),
  });
  const message = useMutation({
    mutationFn: () => createDirectConversation(targetUserId),
    onSuccess: () => onNavigate('/messages'),
  });
  const pages = profileQuery.data?.pages ?? [];
  const profile = pages[0];
  const posts = pages.flatMap((page) => page.posts.data);
  const acceptedConnection = collectionItems(connections.data).find(
    (item) => item.userId === targetUserId,
  );
  const outgoingConnection = collectionItems(outgoingRequests.data).find(
    (item) => item.userId === targetUserId,
  );
  const incomingConnection = collectionItems(incomingRequests.data).find(
    (item) => item.userId === targetUserId,
  );
  const relationship = acceptedConnection
    ? { state: 'CONNECTED' as const, requestId: acceptedConnection.id }
    : outgoingConnection
      ? { state: 'PENDING_OUTGOING' as const, requestId: outgoingConnection.id }
      : incomingConnection
        ? { state: 'PENDING_INCOMING' as const, requestId: incomingConnection.id }
        : { state: 'NOT_CONNECTED' as const, requestId: undefined };
  const relationshipLoading =
    connections.isLoading || incomingRequests.isLoading || outgoingRequests.isLoading;
  const relationshipUnavailable =
    connections.error || incomingRequests.error || outgoingRequests.error;
  const relationshipActionPending = connect.isPending || respond.isPending || cancel.isPending;
  const submitConnectionRequest = () => {
    if (relationshipRequestInFlight.current || relationship.state !== 'NOT_CONNECTED') return;
    connect.mutate();
  };
  const filteredPosts =
    postFilter === 'ALL' ? posts : posts.filter((post) => post.type === postFilter);
  const goTab = (next: ProfileTab) => {
    setTab(next);
    document
      .getElementById(`profile-${next}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (profileQuery.isLoading) return <LoadingState label="Opening profile" />;
  if (isRestrictedApiError(profileQuery.error))
    return <RestrictedState message="Verify your email to view this profile." />;
  if (profileQuery.error || !profile)
    return (
      <ErrorState
        message={apiErrorMessage(profileQuery.error, 'This profile is unavailable or private.')}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  const identity = profile.user;
  const completeness = Math.min(
    100,
    Math.round(
      ([
        identity.bio,
        identity.college,
        identity.course,
        identity.avatarUrl,
        identity.skills.length ? 'skills' : '',
        identity.interests.length ? 'interests' : '',
      ].filter(Boolean).length /
        6) *
        100,
    ),
  );
  return (
    <section className="page-theme page-theme-profile profile-page mx-auto w-full max-w-6xl space-y-6">
      <Card className="overflow-hidden">
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-orange-800 sm:h-56">
          <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-yellow-300/40 blur-3xl" />
          <div className="absolute bottom-[-5rem] left-1/3 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />

          {ownProfile ? (
            <div className="absolute right-5 top-5 z-10">
              <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
                <Edit3 className="h-4 w-4" />
                {editing ? 'Close editor' : 'Edit profile'}
              </Button>
            </div>
          ) : null}

          <span className="absolute bottom-5 right-5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            Campus identity
          </span>
        </div>
        <div className="px-5 pb-5 sm:px-8">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <Avatar
                name={identity.displayName}
                src={identity.avatarUrl}
                size="xl"
                className="h-24 w-24 border-4 border-white sm:h-32 sm:w-32"
              />
              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="type-display truncate text-2xl font-bold text-ink sm:text-3xl">
                    {identity.displayName}
                  </h1>
                  {ownProfile ? <Badge tone="success">You</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">@{identity.username}</p>
                <p className="mt-2 text-sm font-semibold text-brand-700">
                  {identity.course ?? 'Campus learner'}
                  {identity.college ? ` · ${identity.college}` : ''}
                  {identity.graduationYear ? ` · Class of ${identity.graduationYear}` : ''}
                </p>
              </div>
            </div>
            {!ownProfile ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={submitConnectionRequest}
                  disabled={
                    relationshipLoading ||
                    Boolean(relationshipUnavailable) ||
                    relationshipActionPending ||
                    relationship.state !== 'NOT_CONNECTED'
                  }
                >
                  {relationshipLoading ? (
                    'Checking…'
                  ) : relationshipUnavailable ? (
                    'Unavailable'
                  ) : relationship.state === 'CONNECTED' ? (
                    <>
                      <Check className="h-4 w-4" />
                      Connected
                    </>
                  ) : relationship.state === 'PENDING_OUTGOING' ? (
                    'Request sent'
                  ) : relationship.state === 'PENDING_INCOMING' ? (
                    'Incoming request'
                  ) : connect.isPending ? (
                    'Connecting…'
                  ) : (
                    'Connect'
                  )}
                </Button>
                {relationship.state === 'PENDING_INCOMING' ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        relationship.requestId &&
                        respond.mutate({ requestId: relationship.requestId, accepted: true })
                      }
                      disabled={Boolean(relationshipUnavailable) || relationshipActionPending}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        relationship.requestId &&
                        respond.mutate({ requestId: relationship.requestId, accepted: false })
                      }
                      disabled={Boolean(relationshipUnavailable) || relationshipActionPending}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {relationship.state === 'PENDING_OUTGOING' ? (
                  <Button
                    variant="ghost"
                    onClick={() => cancel.mutate()}
                    disabled={Boolean(relationshipUnavailable) || relationshipActionPending}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() => message.mutate()}
                  disabled={message.isPending}
                >
                  {message.isPending ? (
                    'Opening…'
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 border-y border-line py-3 sm:grid-cols-5">
            <Stat
              label="Posts"
              value={profile.stats.posts}
              active={tab === 'posts'}
              onClick={() => goTab('posts')}
            />
            <Stat
              label="Projects"
              value={profile.stats.projects}
              active={tab === 'projects'}
              onClick={() => goTab('projects')}
            />
            <Stat
              label="Teams"
              value={profile.stats.teams}
              active={tab === 'teams'}
              onClick={() => goTab('teams')}
            />
            <Stat
              label="Communities"
              value={profile.stats.communities}
              active={tab === 'communities'}
              onClick={() => goTab('communities')}
            />
            <Stat
              label="Events"
              value={profile.stats.events}
              active={tab === 'events'}
              onClick={() => goTab('events')}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Joined {formatDate(identity.joinedAt)}</span>
            {identity.department ? (
              <>
                <span>·</span>
                <span>{identity.department}</span>
              </>
            ) : null}
          </div>
        </div>
      </Card>
      {editing && ownProfile ? (
        <ProfileEdit
          profile={profile}
          onSaved={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
          }}
        />
      ) : null}
      <div className="sticky top-2 z-10 -mx-1 overflow-x-auto rounded-2xl border border-line bg-white/95 p-1 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Profile sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => goTab(item.id)}
              className={cn(
                'rounded-xl px-4 py-2.5 text-xs font-bold transition',
                tab === item.id
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-muted hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' ? (
        <div id="profile-overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
            <Card className="p-5 sm:p-6">
              <SectionTitle eyebrow="About" title="The person behind the work" />
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {identity.bio || 'This student has not added a bio yet.'}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <GraduationCap className="h-5 w-5 text-brand-600" />
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Academic focus
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {identity.course ?? 'Not specified'}
                    {identity.college ? ` at ${identity.college}` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <Sparkles className="h-5 w-5 text-brand-600" />
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Interests
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {identity.interests.length
                      ? identity.interests.slice(0, 3).join(' · ')
                      : 'Not specified'}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-5 sm:p-6">
              <SectionTitle eyebrow="Profile strength" title="A clearer campus identity" />
              <div className="mt-5 flex items-end gap-3">
                <strong className="text-4xl font-bold text-brand-700">{completeness}%</strong>
                <span className="pb-1 text-sm text-muted">complete</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Complete more of your profile to make recommendations and campus conversations more
                relevant.
              </p>
            </Card>
          </div>
          <Card className="p-5 sm:p-6">
            <SectionTitle
              eyebrow="Work"
              title="Currently building"
              count={profile.projects.length}
            />
            {profile.projects.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {profile.projects.slice(0, 4).map((item) => (
                  <ProjectCard
                    key={item.id}
                    project={item}
                    onOpen={() => onNavigate(`/projects/${item.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No projects yet"
                  description="Projects and collaboration make your campus identity tangible."
                />
              </div>
            )}
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <SectionTitle eyebrow="Campus" title="Teams and communities" />
              <div className="mt-5 grid gap-3">
                {profile.teams.slice(0, 3).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onNavigate(`/teams/${item.id}`)}
                    className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-brand-200"
                  >
                    <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
                      <BriefcaseBusiness className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-ink">{item.name}</strong>
                      <small className="text-xs text-muted">
                        {item.role} · {item.memberCount ?? 0} members
                      </small>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-brand-500" />
                  </button>
                ))}
                {profile.communities.slice(0, 3).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onNavigate(`/communities/${item.id}`)}
                    className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-brand-200"
                  >
                    <span className="rounded-lg bg-cyan/10 p-2 text-cyan">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-ink">{item.name}</strong>
                      <small className="text-xs text-muted">
                        {item.role} · {item.memberCount ?? 0} members
                      </small>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-brand-500" />
                  </button>
                ))}
                {!profile.teams.length && !profile.communities.length ? (
                  <p className="text-sm text-muted">No teams or communities to show yet.</p>
                ) : null}
              </div>
            </Card>
            <Card className="p-5 sm:p-6">
              <SectionTitle eyebrow="Activity" title="Recent posts" count={profile.stats.posts} />
              <div className="mt-5 grid gap-3">
                {posts.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Heart className="h-3.5 w-3.5 text-brand-500" />
                      {item.reactionCount} reactions · {formatDate(item.createdAt)}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">
                      {item.content}
                    </p>
                  </div>
                ))}
                {!posts.length ? <p className="text-sm text-muted">Nothing here yet.</p> : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      {tab === 'posts' ? (
        <section id="profile-posts" className="scroll-mt-20 space-y-4">
          <SectionTitle eyebrow="Activity" title="Posts" count={profile.stats.posts} />
          <div className="flex flex-wrap gap-2">
            {[
              'ALL',
              'GENERAL',
              'DISCUSSION',
              'QUESTION',
              'IDEA',
              'OPPORTUNITY',
              'ANNOUNCEMENT',
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPostFilter(item)}
                className={cn(
                  'rounded-full px-3 py-2 text-xs font-bold',
                  postFilter === item
                    ? 'bg-brand-700 text-white'
                    : 'bg-white text-muted ring-1 ring-line',
                )}
              >
                {item === 'ALL' ? 'All' : item.toLowerCase()}
              </button>
            ))}
          </div>
          {filteredPosts.length ? (
            <div className="grid gap-4">
              {filteredPosts.map((item: SocialPostView) => (
                <PostCard key={item.id} post={item} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing here yet"
              description="Posts authored by this student will appear here when they are available."
            />
          )}
          {profileQuery.hasNextPage ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void profileQuery.fetchNextPage()}
              disabled={profileQuery.isFetchingNextPage}
            >
              {profileQuery.isFetchingNextPage ? 'Loading…' : 'Load more posts'}
            </Button>
          ) : null}
        </section>
      ) : null}
      {tab === 'projects' ? (
        <section id="profile-projects" className="scroll-mt-20 space-y-4">
          <SectionTitle eyebrow="Work" title="Projects" count={profile.stats.projects} />
          {profile.projects.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {profile.projects.map((item) => (
                <ProjectCard
                  key={item.id}
                  project={item}
                  onOpen={() => onNavigate(`/projects/${item.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No projects yet"
              description="Projects and collaboration make campus work visible."
            />
          )}
        </section>
      ) : null}
      {tab === 'teams' ? (
        <section id="profile-teams" className="scroll-mt-20 space-y-4">
          <SectionTitle eyebrow="Campus" title="Teams" count={profile.stats.teams} />
          {profile.teams.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {profile.teams.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNavigate(`/teams/${item.id}`)}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left hover:border-brand-200 hover:shadow-sm"
                >
                  <span className="rounded-xl bg-brand-50 p-3 text-brand-600">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-base text-ink">{item.name}</strong>
                    <span className="mt-1 block text-sm text-muted">{item.description}</span>
                    <small className="mt-3 block text-xs font-semibold text-brand-700">
                      {item.role} · {item.memberCount ?? 0} members · {item.status}
                    </small>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-brand-500" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No teams yet"
              description="Join a team to start building with other students."
            />
          )}
        </section>
      ) : null}
      {tab === 'communities' ? (
        <section id="profile-communities" className="scroll-mt-20 space-y-4">
          <SectionTitle eyebrow="Campus" title="Communities" count={profile.stats.communities} />
          {profile.communities.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {profile.communities.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNavigate(`/communities/${item.id}`)}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left hover:border-brand-200 hover:shadow-sm"
                >
                  <span className="rounded-xl bg-cyan/10 p-3 text-cyan">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-base text-ink">{item.name}</strong>
                    <span className="mt-1 block text-sm text-muted">
                      {item.category} · {item.description}
                    </span>
                    <small className="mt-3 block text-xs font-semibold text-brand-700">
                      {item.role} · {item.memberCount ?? 0} members
                    </small>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-brand-500" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No communities yet"
              description="Community spaces will appear here when this student joins them."
            />
          )}
        </section>
      ) : null}
      {tab === 'events' ? (
        <section id="profile-events" className="scroll-mt-20 space-y-4">
          <SectionTitle eyebrow="Campus" title="Events" count={profile.stats.events} />
          {profile.events.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {profile.events.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNavigate(`/events/${item.id}`)}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left hover:border-brand-200 hover:shadow-sm"
                >
                  <span className="rounded-xl bg-yellow-light p-3 text-yellow-dark">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-base text-ink">{item.title}</strong>
                    <span className="mt-1 block text-sm text-muted">
                      {item.category} · {new Date(item.startAt).toLocaleDateString()}
                    </span>
                    <small className="mt-3 block text-xs font-semibold text-brand-700">
                      {item.participation} · {item.status}
                    </small>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-brand-500" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No events yet"
              description="Registered and organized events will appear here."
            />
          )}
        </section>
      ) : null}
    </section>
  );
}
