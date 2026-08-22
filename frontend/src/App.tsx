import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, logout, refreshSession } from './features/auth/auth.api';
import { useAuthStore } from './features/auth/auth.store';
import { RestrictedState } from './components/ui';
import { AppLayout } from './layouts/AppLayout';
import { AuthRoutes } from './routes/AuthRoutes';
import { AppRoutes } from './routes/AppRoutes';
import { routeFromPath, routePaths, type RouteId } from './lib/navigation';
import { useAppStore } from './store/app-store';
import { AdminRoutes } from './pages/admin/AdminRoutes';

export function App() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const setAnonymous = useAuthStore((state) => state.clearSession);
  const isNavigationOpen = useAppStore((state) => state.isNavigationOpen);
  const toggleNavigation = useAppStore((state) => state.toggleNavigation);
  const setActiveSection = useAppStore((state) => state.setActiveSection);
  const [route, setRoute] = useState<RouteId>(() => routeFromPath(window.location.pathname));
  const currentUser = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    enabled: authStatus === 'authenticated',
    retry: false,
  });

  useEffect(() => {
    if (authStatus !== 'unknown') return;
    void refreshSession().catch(() => setAnonymous());
  }, [authStatus, setAnonymous]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const initialRoute = routeFromPath(window.location.pathname);
    setRoute(initialRoute);
    setActiveSection(initialRoute);
    const dynamicProfilePath = /^\/users\/[^/]+\/profile$/.test(window.location.pathname);
    const dynamicAdminPath = /^\/admin\/users\/[^/]+$|^\/admin\/reports\/[^/]+$/.test(window.location.pathname);
    if (
      !dynamicProfilePath &&
      !dynamicAdminPath &&
      routePaths[initialRoute] &&
      window.location.pathname !== routePaths[initialRoute]
    )
      window.history.replaceState({}, '', routePaths[initialRoute]);
    const handlePopState = () => {
      const nextRoute = routeFromPath(window.location.pathname);
      setRoute(nextRoute);
      setActiveSection(nextRoute);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authStatus, setActiveSection]);

  if (authStatus === 'unknown')
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <span className="h-3 w-3 animate-pulse rounded-full bg-brand-500" />
          Restoring your session...
        </div>
      </main>
    );
  if (authStatus === 'anonymous' || !user) return <AuthRoutes />;

  const resolvedUser = currentUser.data ?? user;
  const navigate = (target: string) => {
    const targetPath = target.startsWith('/')
      ? target
      : (routePaths[target as RouteId] ?? routePaths.home ?? '/home');
    const nextRoute = routeFromPath(targetPath);
    setRoute(nextRoute);
    setActiveSection(nextRoute);
    if (window.location.pathname !== targetPath) window.history.pushState({}, '', targetPath);
    if (isNavigationOpen) toggleNavigation();
  };

  if (route.toString().startsWith('admin'))
    return <AdminRoutes user={resolvedUser} onNavigate={navigate} onSignOut={() => void logout()} />;

  return (
    <AppLayout user={resolvedUser} onNavigate={navigate}>
      {resolvedUser.accountState !== 'ACTIVE' ? (
        <RestrictedState
          title="Account access is limited"
          message="Your account is signed in, but this account currently has limited access. Contact a campus administrator if this is unexpected."
        />
      ) : null}
      <AppRoutes
        route={route}
        user={resolvedUser}
        onNavigate={navigate}
        onSignOut={() => void logout()}
      />
    </AppLayout>
  );
}
