import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoginPage } from './features/auth/LoginPage';
import { ProjectAccessPage } from './features/projects/ProjectAccessPage';
import {
  AUTH_ACCESS_TOKEN_KEY,
  clearFollowupAuthSession,
  isTokenExpired,
  mapSessionReasonToNotice,
  readStoredLoginProfile,
  type SessionExpiredNotice,
} from './lib/authSession';
import { PageTemplate } from './shell/PageTemplate';
import { sessionOrchestrator } from './core/session/session-orchestrator';
import { subscribeSessionInvalidatedEvent } from './core/session/session-events';
import { ENABLE_NEW_SESSION_FLOW } from './config/featureFlags';

type AppStage = 'login' | 'project-access' | 'app';

export type LoginBootstrapProfile = { id: string; email: string; systemRole: string };

const readInitialToken = (): string | null => {
  const token = sessionStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
  if (token == null || token.trim() === '') return null;
  return isTokenExpired(token) ? null : token;
};

const readInitialBootstrap = (): LoginBootstrapProfile | null => {
  if (readInitialToken() == null) return null;
  return readStoredLoginProfile();
};

export const App = () => {
  const initialToken = useMemo(readInitialToken, []);
  const initialBootstrap = useMemo(readInitialBootstrap, []);
  const [accessToken, setAccessToken] = useState<string | null>(initialToken);
  const [stage, setStage] = useState<AppStage>(initialToken != null ? 'project-access' : 'login');
  const [loginBootstrap, setLoginBootstrap] = useState<LoginBootstrapProfile | null>(
    initialBootstrap,
  );
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLE_NEW_SESSION_FLOW) return;
    sessionOrchestrator.initMultiTabSync();
    const unsubscribe = subscribeSessionInvalidatedEvent((event) => {
      clearFollowupAuthSession();
      setAccessToken(null);
      setLoginBootstrap(null);
      setStage('login');
      if (event.redirectToLogin) {
        setLoginNotice(mapSessionReasonToNotice(event.reason));
      }
    });
    return unsubscribe;
  }, []);

  const handleSessionInvalid = useCallback((notice?: SessionExpiredNotice) => {
    void sessionOrchestrator.invalidateSession({
      reason: notice?.reason ?? 'session_expired',
      source: 'project_access',
      redirectToLogin: true,
      strategy: 'auth-only',
    });
    setLoginNotice(
      notice?.message ?? mapSessionReasonToNotice(notice?.reason ?? 'session_expired'),
    );
  }, []);

  if (stage == 'login') {
    return (
      <LoginPage
        notice={loginNotice}
        onSuccess={(token: string, profile: LoginBootstrapProfile) => {
          setAccessToken(token);
          setLoginBootstrap(profile);
          setLoginNotice(null);
          setStage('project-access');
        }}
      />
    );
  }

  if (stage == 'project-access' && accessToken != null) {
    return (
      <ProjectAccessPage
        accessToken={accessToken}
        initialProfile={loginBootstrap}
        onContinue={() => {
          setLoginBootstrap(null);
          setStage('app');
        }}
        onSessionInvalid={handleSessionInvalid}
      />
    );
  }

  if (accessToken == null) {
    return (
      <LoginPage
        notice={loginNotice}
        onSuccess={(token: string, profile: LoginBootstrapProfile) => {
          setAccessToken(token);
          setLoginBootstrap(profile);
          setLoginNotice(null);
          setStage('project-access');
        }}
      />
    );
  }

  return (
    <PageTemplate accessToken={accessToken}>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sezione attiva: shell POC (sidebar, header, workspace, progetti, bottom nav mobile).
        </p>
      </section>
    </PageTemplate>
  );
};
