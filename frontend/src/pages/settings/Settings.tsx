import { useEffect, useState } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Eye,
  FolderKanban,
  KeyRound,
  LogOut,
  MessageCircle,
  Monitor,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Tablet,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserPreferences } from '@campusconnection/shared';
import { PageHeader } from '../../components/PageHeader';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  RestrictedState,
} from '../../components/ui';
import { apiErrorMessage, isRestrictedApiError } from '../../lib/api-state';
import { useAuthStore } from '../../features/auth/auth.store';
import { updateProfile } from '../../features/auth/auth.api';
import type { SessionDeviceType } from '../../features/settings/session.utils';
import { parseUserAgent } from '../../features/settings/session.utils';
import {
  getSessions,
  getSettings,
  revokeOtherSessions,
  revokeSession,
  setPassword,
  updateSettings,
} from '../../features/settings/settings.api';

const defaultPreferences: UserPreferences = {
  notifications: {
    messages: true,
    teamActivity: true,
    projectActivity: true,
    communityActivity: true,
    eventUpdates: true,
    socialInteractions: true,
  },
  privacy: {
    profileDiscoverable: true,
    showInRecommendations: true,
  },
};

const settingsNav: Array<{ id: string; label: string; icon: typeof Bell }> = [
  { id: 'account', label: 'Account', icon: Users },
  { id: 'privacy', label: 'Privacy & Discovery', icon: Eye },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

function ToggleRow({
  checked,
  label,
  description,
  icon: Icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  icon: typeof Bell;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition hover:border-brand-200">
      <span className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-brand-600"
      />
    </label>
  );
}

const sessionDeviceIcons: Record<SessionDeviceType, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: MonitorSmartphone,
};

function sessionDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function Settings({ onSignOut }: { onSignOut: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const sessions = useQuery({
    queryKey: ['settings', 'sessions'],
    queryFn: getSessions,
    enabled: !settings.isLoading && !settings.error,
  });

  useEffect(() => {
    if (!settings.data) return;
    setDisplayName(settings.data.displayName);
    setPreferences(settings.data.preferences);
  }, [settings.data]);

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ displayName: displayName.trim() }),
    onSuccess: () => {
      setSavedMessage('Account details saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  const preferencesMutation = useMutation({
    mutationFn: (next: UserPreferences) => updateSettings(next),
    onSuccess: (result) => {
      setPreferences(result.preferences);
      setSavedMessage('Preferences saved.');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => {
      void settings.refetch();
    },
  });
  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings', 'sessions'] }),
  });
  const revokeOthersMutation = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      setSavedMessage('Other active sessions were signed out.');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'sessions'] });
    },
  });
  const passwordMutation = useMutation({
    mutationFn: () =>
      setPassword({
        ...(settings.data?.passwordConfigured ? { currentPassword } : {}),
        newPassword,
        confirmPassword,
      }),
    onSuccess: (data) => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSavedMessage('Password set successfully.');
      queryClient.setQueryData(['settings'], data);
    },
  });

  const updatePreference = <
    Section extends keyof UserPreferences,
    Key extends keyof UserPreferences[Section],
  >(
    section: Section,
    key: Key,
    value: UserPreferences[Section][Key],
  ) => {
    const next = {
      ...preferences,
      [section]: { ...preferences[section], [key]: value },
    } as UserPreferences;
    setPreferences(next);
    setSavedMessage(null);
    preferencesMutation.mutate(next);
  };

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const settingsError = settings.error;
  const mutationError =
    profileMutation.error ??
    preferencesMutation.error ??
    sessions.error ??
    revokeMutation.error ??
    revokeOthersMutation.error ??
    passwordMutation.error;

  if (settings.isLoading) {
    return <LoadingState label="Loading settings" />;
  }
  if (isRestrictedApiError(settingsError)) {
    return <RestrictedState message="Verify your email before changing account settings." />;
  }
  if (settingsError) {
    return (
      <ErrorState
        message={apiErrorMessage(settingsError, 'Settings are temporarily unavailable.')}
        onRetry={() => void settings.refetch()}
      />
    );
  }
  if (!settings.data) return null;

  const sessionItems = sessions.data ?? [];
  const hasOtherSessions = sessionItems.some((session) => !session.isCurrent);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Make CampusConnection yours."
        description="Manage your account, discovery visibility, notifications, and active sessions."
        action={
          savedMessage ? (
            <Badge tone="success">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              {savedMessage}
            </Badge>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav
          className="h-fit rounded-2xl border border-line bg-white p-2 lg:sticky lg:top-6"
          aria-label="Settings sections"
        >
          {settingsNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <Card id="account" className="scroll-mt-6 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Account</h2>
                <p className="mt-1 text-sm text-muted">
                  Keep your public account details up to date.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Display name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setSavedMessage(null);
                }}
                maxLength={100}
              />
              <Field
                label="Username"
                value={settings.data.username}
                readOnly
                hint="Username changes are not supported here."
              />
              <Field
                label="Email"
                value={settings.data.email}
                readOnly
                hint="Email is managed by authentication and cannot be changed here."
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => profileMutation.mutate()}
                disabled={
                  !displayName.trim() ||
                  profileMutation.isPending ||
                  displayName.trim() === settings.data.displayName
                }
              >
                <Save className="h-4 w-4" />
                {profileMutation.isPending ? 'Saving…' : 'Save display name'}
              </Button>
              <Button
                className="border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                variant="ghost"
                onClick={onSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </Card>

          <Card id="privacy" className="scroll-mt-6 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <Eye className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Privacy & Discovery</h2>
                <p className="mt-1 text-sm text-muted">
                  Control whether other people can discover you through supported features.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <ToggleRow
                checked={preferences.privacy.profileDiscoverable}
                label="Allow profile discovery"
                description="Include your profile in people search results when you are otherwise visible."
                icon={Eye}
                onChange={(value) => updatePreference('privacy', 'profileDiscoverable', value)}
              />
              <ToggleRow
                checked={preferences.privacy.showInRecommendations}
                label="Show me in recommendations"
                description="Allow your profile to appear in the For You people recommendations."
                icon={SlidersHorizontal}
                onChange={(value) => updatePreference('privacy', 'showInRecommendations', value)}
              />
            </div>
          </Card>

          <Card id="notifications" className="scroll-mt-6 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Notifications</h2>
                <p className="mt-1 text-sm text-muted">
                  Choose which in-app activity should create notifications for you.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ToggleRow
                checked={preferences.notifications.messages}
                label="Messages"
                description="New direct and group messages."
                icon={MessageCircle}
                onChange={(value) => updatePreference('notifications', 'messages', value)}
              />
              <ToggleRow
                checked={preferences.notifications.teamActivity}
                label="Team activity"
                description="Team invitations, joins, and requirement updates."
                icon={BriefcaseBusiness}
                onChange={(value) => updatePreference('notifications', 'teamActivity', value)}
              />
              <ToggleRow
                checked={preferences.notifications.projectActivity}
                label="Project activity"
                description="Project invitations, tasks, and collaboration updates."
                icon={FolderKanban}
                onChange={(value) => updatePreference('notifications', 'projectActivity', value)}
              />
              <ToggleRow
                checked={preferences.notifications.communityActivity}
                label="Community activity"
                description="Community membership and discussion activity."
                icon={Users}
                onChange={(value) => updatePreference('notifications', 'communityActivity', value)}
              />
              <ToggleRow
                checked={preferences.notifications.eventUpdates}
                label="Event updates"
                description="Event registration and schedule updates."
                icon={CalendarDays}
                onChange={(value) => updatePreference('notifications', 'eventUpdates', value)}
              />
              <ToggleRow
                checked={preferences.notifications.socialInteractions}
                label="Social interactions"
                description="Connections, reactions, comments, and follows."
                icon={Bell}
                onChange={(value) => updatePreference('notifications', 'socialInteractions', value)}
              />
            </div>
          </Card>

          <Card id="security" className="scroll-mt-6 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Security</h2>
                <p className="mt-1 text-sm text-muted">
                  Review active sessions and revoke access from devices you no longer use.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-slate-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">Password</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {settings.data.passwordConfigured
                      ? 'Password is configured. Set a new one whenever you need to change it.'
                      : 'Password has not been set. You signed in with Google.'}
                  </p>
                </div>
              </div>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  passwordMutation.mutate();
                }}
              >
                {settings.data.passwordConfigured ? (
                  <Field
                    label="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                ) : null}
                <Field
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <Field
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <div className="flex items-end sm:col-span-2">
                  <Button type="submit" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending
                      ? 'Saving…'
                      : settings.data.passwordConfigured
                        ? 'Change password'
                        : 'Set password'}
                  </Button>
                </div>
              </form>
            </div>
            {sessions.isLoading ? <LoadingState label="Loading active sessions" /> : null}
            {sessions.error ? (
              <ErrorState
                message={apiErrorMessage(sessions.error, 'Active sessions are unavailable.')}
                onRetry={() => void sessions.refetch()}
              />
            ) : null}
            {!sessions.isLoading && !sessions.error ? (
              <>
                <div className="mt-5 grid gap-3">
                  {sessionItems.map((session) => {
                    const deviceInfo = parseUserAgent(session.userAgent ?? '');
                    const DeviceIcon = sessionDeviceIcons[deviceInfo.deviceType];

                    return (
                      <div
                        className="flex min-w-0 w-full flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-start sm:justify-between"
                        key={session.id}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600">
                            <DeviceIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-bold text-ink">
                                  {deviceInfo.device}
                                </p>
                                <p className="mt-1 break-words text-xs font-medium text-muted">
                                  {deviceInfo.browser}
                                </p>
                              </div>
                              {session.isCurrent ? (
                                <Badge tone="success">Current device</Badge>
                              ) : null}
                            </div>
                            <p className="mt-3 break-words text-xs text-muted">
                              Last active {sessionDate(session.lastUsedAt)}
                            </p>
                            <p className="mt-1 break-words text-xs text-slate-400">
                              Added {sessionDate(session.createdAt)}
                            </p>
                          </div>
                        </div>
                        {!session.isCurrent ? (
                          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => revokeMutation.mutate(session.id)}
                              disabled={revokeMutation.isPending}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {!sessionItems.length ? (
                  <p className="mt-5 text-sm text-muted">No active sessions were found.</p>
                ) : null}
                <div className="mt-5 border-t border-line pt-5">
                  <Button
                    variant="secondary"
                    onClick={() => revokeOthersMutation.mutate()}
                    disabled={!hasOtherSessions || revokeOthersMutation.isPending}
                  >
                    {revokeOthersMutation.isPending ? 'Signing out…' : 'Sign out other sessions'}
                  </Button>
                  <p className="mt-2 text-xs text-muted">
                    Your current session will remain active.
                  </p>
                </div>
              </>
            ) : null}
          </Card>

          {mutationError ? (
            <ErrorState
              message={apiErrorMessage(mutationError, 'Your settings could not be saved.')}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
