import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
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
  Trash2,
  Tablet,
  Users,
  X,
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
import { deleteAccount, updateProfile } from '../../features/auth/auth.api';
import type { SessionDeviceType } from '../../features/settings/session.utils';
import { parseUserAgent } from '../../features/settings/session.utils';
import {
  getSessions,
  getSettings,
  revokeOtherSessions,
  revokeSession,
  setPassword,
  setPasswordWithRecovery,
  startGooglePasswordRecovery,
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

const passwordRecoveryTimeoutMs = 120_000;
const passwordRecoveryPopupName = 'campusconnection-password-recovery';
const passwordRecoveryPopupFeatures = 'popup,width=520,height=720';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'starting' | 'waiting' | 'verified'>('idle');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryPopup = useRef<Window | null>(null);
  const recoveryTimeout = useRef<number | null>(null);

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
      recoveryStatus === 'verified'
        ? setPasswordWithRecovery({ newPassword, confirmPassword })
        : setPassword({
            ...(settings.data?.passwordConfigured ? { currentPassword } : {}),
            newPassword,
            confirmPassword,
          }),
    onSuccess: (data) => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryStatus('idle');
      setRecoveryError(null);
      setSavedMessage('Password set successfully.');
      queryClient.setQueryData(['settings'], data);
    },
  });

  const beginPasswordRecovery = () => {
    setRecoveryError(null);
    if (recoveryTimeout.current !== null) {
      window.clearTimeout(recoveryTimeout.current);
      recoveryTimeout.current = null;
    }
    const popup = window.open(
      'about:blank',
      passwordRecoveryPopupName,
      passwordRecoveryPopupFeatures,
    );
    if (!popup) {
      setRecoveryError('Your browser blocked the Google verification window. Allow popups and try again.');
      return;
    }
    recoveryPopup.current = popup;
    setRecoveryStatus('starting');
    void startGooglePasswordRecovery()
      .then(({ authorizationUrl }) => {
        const authorizedPopup = window.open(
          authorizationUrl,
          passwordRecoveryPopupName,
          passwordRecoveryPopupFeatures,
        );
        if (!authorizedPopup) {
          recoveryPopup.current = null;
          setRecoveryStatus('idle');
          setRecoveryError('Unable to open the Google verification window. Please try again.');
          return;
        }
        recoveryPopup.current = authorizedPopup;
        setRecoveryStatus('waiting');
      })
      .catch((error) => {
        recoveryPopup.current = null;
        setRecoveryStatus('idle');
        setRecoveryError(apiErrorMessage(error, 'Unable to start Google verification.'));
      });
  };

  useEffect(() => {
    if (recoveryStatus !== 'waiting') return;
    const expectedOrigin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin || event.source !== recoveryPopup.current) return;
      if (event.data?.type !== 'campusconnection-password-recovery') return;
      if (recoveryTimeout.current !== null) {
        window.clearTimeout(recoveryTimeout.current);
        recoveryTimeout.current = null;
      }
      recoveryPopup.current = null;
      if (event.data.status === 'verified') {
        setRecoveryStatus('verified');
        setRecoveryError(null);
        setSavedMessage(null);
      } else {
        setRecoveryStatus('idle');
        setRecoveryError(
          typeof event.data.message === 'string'
            ? event.data.message
            : 'Google verification could not be completed.',
        );
      }
    };
    recoveryTimeout.current = window.setTimeout(() => {
      recoveryTimeout.current = null;
      recoveryPopup.current = null;
      setRecoveryStatus('idle');
      setRecoveryError('Recovery verification timed out. Please try again.');
    }, passwordRecoveryTimeoutMs);
    window.addEventListener('message', onMessage);
    return () => {
      if (recoveryTimeout.current !== null) {
        window.clearTimeout(recoveryTimeout.current);
        recoveryTimeout.current = null;
      }
      window.removeEventListener('message', onMessage);
    };
  }, [recoveryStatus]);
  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
      useAuthStore.getState().clearSession();
      window.location.assign('/login?accountDeleted=1');
    },
  });

  useEffect(() => {
    if (!deleteDialogOpen) return;
    document.getElementById('delete-account-cancel')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteMutation.isPending) setDeleteDialogOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteDialogOpen, deleteMutation.isPending]);

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

          <Card className="border-red-200 bg-red-50/40 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-red-100 p-2.5 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-red-900">Danger zone</h2>
                <p className="mt-1 text-sm leading-6 text-red-800/80">
                  Permanently remove your account and the data you own. Shared spaces with active
                  collaborators must be transferred before deletion.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-red-900">Delete account</h3>
                <p className="mt-1 text-xs leading-5 text-red-800/75">
                  This action is permanent and cannot be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  deleteMutation.reset();
                  setDeleteDialogOpen(true);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete account
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
                  <div className="sm:col-span-2">
                    {recoveryStatus !== 'verified' ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-5">
                        <div className="min-w-0 flex-1">
                          <Field
                            label="Current password"
                            type="password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          className="group mb-2 inline-flex shrink-0 items-center gap-1 self-end text-sm font-semibold text-brand-700 transition hover:text-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={beginPasswordRecovery}
                          disabled={recoveryStatus === 'starting' || recoveryStatus === 'waiting'}
                        >
                          {recoveryStatus === 'starting' || recoveryStatus === 'waiting' ? (
                            'Waiting for Google…'
                          ) : (
                            <>
                              Forgot password?
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-emerald-700" role="status">
                        Identity verified. You can now set a new password.
                      </p>
                    )}
                    {recoveryError ? (
                      <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                        {recoveryError}
                      </p>
                    ) : null}
                  </div>
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
                  <Button
                    type="submit"
                    disabled={
                      passwordMutation.isPending ||
                      (settings.data.passwordConfigured && recoveryStatus !== 'verified' && !currentPassword)
                    }
                  >
                    {passwordMutation.isPending
                      ? 'Saving…'
                      : recoveryStatus === 'verified'
                        ? 'Set new password'
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

      {deleteDialogOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center bg-slate-950/45 p-4"
              role="presentation"
            >
              <div
                className="relative w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-account-title"
                aria-describedby="delete-account-description"
              >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-red-100 p-2.5 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="delete-account-title" className="text-lg font-bold text-red-900">
                    Delete account permanently?
                  </h2>
                  <p
                    id="delete-account-description"
                    className="mt-2 text-sm leading-6 text-slate-600"
                  >
                    Your account, personal content, sessions, and owned resources will be deleted.
                    This cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close delete account dialog"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {deleteMutation.error ? (
              <div className="mt-4">
                <ErrorState
                  message={apiErrorMessage(
                    deleteMutation.error,
                    'Your account could not be deleted. No changes were made.',
                  )}
                />
              </div>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                id="delete-account-cancel"
                type="button"
                variant="secondary"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {deleteMutation.isPending ? 'Deleting account...' : 'Delete account'}
              </Button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
