import { useCallback, useMemo, useState } from 'react';

import { LoginPage } from './features/auth/LoginPage';
import { ProjectAccessPage } from './features/projects/ProjectAccessPage';
import { PageTemplate } from './shell/PageTemplate';

type AppStage = 'login' | 'project-access' | 'app';

export type LoginBootstrapProfile = { id: string; email: string; systemRole: string };

const readInitialToken = (): string | null => {
  const token = sessionStorage.getItem('followup.auth.accessToken');
  return token == null || token.trim() == '' ? null : token;
};

export const App = () => {
  const initialToken = useMemo(readInitialToken, []);
  const [accessToken, setAccessToken] = useState<string | null>(initialToken);
  const [stage, setStage] = useState<AppStage>(initialToken != null ? 'project-access' : 'login');
  const [loginBootstrap, setLoginBootstrap] = useState<LoginBootstrapProfile | null>(null);

  const handleSessionInvalid = useCallback(() => {
    sessionStorage.removeItem('followup.auth.accessToken');
    sessionStorage.removeItem('followup.auth.refreshToken');
    setAccessToken(null);
    setLoginBootstrap(null);
    setStage('login');
  }, []);

  if (stage == 'login') {
    return (
      <LoginPage
        onSuccess={(token: string, profile: LoginBootstrapProfile) => {
          setAccessToken(token);
          setLoginBootstrap(profile);
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
        onSuccess={(token: string, profile: LoginBootstrapProfile) => {
          setAccessToken(token);
          setLoginBootstrap(profile);
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
