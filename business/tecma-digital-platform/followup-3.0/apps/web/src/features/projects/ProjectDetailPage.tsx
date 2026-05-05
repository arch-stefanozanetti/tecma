import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';
import { AUTH_ACCESS_TOKEN_KEY, isTokenExpired } from '../../lib/authSession';

type SectionKey =
  | 'identity'
  | 'contacts'
  | 'branding'
  | 'policies'
  | 'marketing'
  | 'workflow'
  | 'email-config'
  | 'email-templates'
  | 'pdf-templates'
  | 'legacy-overrides'
  | 'connectors';

const SECTION_LABELS: Record<SectionKey, string> = {
  identity: 'Identity',
  contacts: 'Contacts',
  branding: 'Branding',
  policies: 'Policies',
  marketing: 'Marketing',
  workflow: 'Workflow',
  'email-config': 'Email config',
  'email-templates': 'Email templates',
  'pdf-templates': 'PDF templates',
  'legacy-overrides': 'Legacy overrides',
  connectors: 'Connectors',
};

const SECTION_ORDER: SectionKey[] = [
  'identity',
  'contacts',
  'branding',
  'policies',
  'marketing',
  'workflow',
  'email-config',
  'email-templates',
  'pdf-templates',
  'legacy-overrides',
  'connectors',
];

type ProjectDoc = Record<string, unknown> & { _id?: string };

const readAccessToken = (): string | null => {
  const token = sessionStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
  if (token == null || token.trim() === '') return null;
  return isTokenExpired(token) ? null : token;
};

interface PutSectionFormProps {
  title: string;
  fields: Array<{ key: string; label: string; placeholder?: string; type?: 'text' | 'number' | 'boolean' }>;
  data: Record<string, unknown> | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  testIdPrefix: string;
}

const PutSectionForm = ({
  title,
  fields,
  data,
  onSave,
  busy,
  testIdPrefix,
}: PutSectionFormProps) => {
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setDraft(data ?? {});
  }, [data]);

  const handleSubmit = async (): Promise<void> => {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = draft[field.key];
      if (field.type === 'boolean') {
        payload[field.key] = Boolean(value);
        continue;
      }
      if (field.type === 'number') {
        if (value === '' || value == null) continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) payload[field.key] = parsed;
        continue;
      }
      if (typeof value === 'string' && value.trim() !== '') payload[field.key] = value.trim();
    }
    await onSave(payload);
  };

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-form`}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          if (field.type === 'boolean') {
            return (
              <label key={field.key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(draft[field.key])}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.checked }))
                  }
                />
                {field.label}
              </label>
            );
          }
          return (
            <label key={field.key} className="text-xs font-medium text-foreground">
              {field.label}
              <Input
                type={field.type === 'number' ? 'number' : 'text'}
                value={String(draft[field.key] ?? '')}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                placeholder={field.placeholder}
                data-testid={`${testIdPrefix}-${field.key}`}
              />
            </label>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        data-testid={`${testIdPrefix}-save`}
      >
        {busy ? 'Salvataggio...' : 'Salva'}
      </Button>
    </div>
  );
};

export const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [accessToken, setAccessToken] = useState<string | null>(() => readAccessToken());
  const [section, setSection] = useState<SectionKey>('identity');
  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [branding, setBranding] = useState<Record<string, unknown> | null>(null);
  const [policies, setPolicies] = useState<Record<string, unknown> | null>(null);
  const [marketing, setMarketing] = useState<Record<string, unknown> | null>(null);
  const [workflow, setWorkflow] = useState<Record<string, unknown> | null>(null);
  const [emailConfig, setEmailConfig] = useState<Record<string, unknown> | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [pdfTemplates, setPdfTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [legacy, setLegacy] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setAccessToken(readAccessToken());
  }, [projectId]);

  const reload = async (): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    try {
      const [
        projectResponse,
        brandingResponse,
        policiesResponse,
        marketingResponse,
        workflowResponse,
        emailConfigResponse,
        emailTemplatesResponse,
        pdfTemplatesResponse,
        legacyResponse,
      ] = await Promise.all([
        http<{ data: ProjectDoc }>(`/projects/${projectId}`, { method: 'GET', accessToken }).catch(
          () => ({ data: null as unknown as ProjectDoc }),
        ),
        http<{ data: Record<string, unknown> | null }>(`/projects/${projectId}/branding`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: null })),
        http<{ data: Record<string, unknown> | null }>(`/projects/${projectId}/policies`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: null })),
        http<{ data: Record<string, unknown> | null }>(
          `/projects/${projectId}/marketing-settings`,
          {
            method: 'GET',
            accessToken,
          },
        ).catch(() => ({ data: null })),
        http<{ data: Record<string, unknown> | null }>(
          `/projects/${projectId}/workflow-settings`,
          {
            method: 'GET',
            accessToken,
          },
        ).catch(() => ({ data: null })),
        http<{ data: Record<string, unknown> | null }>(`/projects/${projectId}/email-config`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: null })),
        http<{ data: Array<Record<string, unknown>> }>(
          `/projects/${projectId}/email-templates`,
          {
            method: 'GET',
            accessToken,
          },
        ).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
        http<{ data: Array<Record<string, unknown>> }>(`/projects/${projectId}/pdf-templates`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
        http<{ data: Record<string, unknown> | null }>(
          `/projects/${projectId}/legacy-overrides`,
          {
            method: 'GET',
            accessToken,
          },
        ).catch(() => ({ data: null })),
      ]);
      setProject(projectResponse.data ?? null);
      setBranding(brandingResponse.data);
      setPolicies(policiesResponse.data);
      setMarketing(marketingResponse.data);
      setWorkflow(workflowResponse.data);
      setEmailConfig(emailConfigResponse.data);
      setEmailTemplates(Array.isArray(emailTemplatesResponse.data) ? emailTemplatesResponse.data : []);
      setPdfTemplates(Array.isArray(pdfTemplatesResponse.data) ? pdfTemplatesResponse.data : []);
      setLegacy(legacyResponse.data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Caricamento progetto fallito.',
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [accessToken, projectId]);

  const sectionTabs = useMemo(
    () => SECTION_ORDER.map((key) => ({ key, label: SECTION_LABELS[key] })),
    [],
  );

  const handlePatchProject = async (payload: Record<string, unknown>): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/projects/${projectId}`, { method: 'PATCH', accessToken, body: payload });
      setSuccess('Progetto aggiornato.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Errore aggiornamento.');
    } finally {
      setBusy(false);
    }
  };

  const handlePutSection = async (
    pathSegment: string,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/projects/${projectId}/${pathSegment}`, {
        method: 'PUT',
        accessToken,
        body: payload,
      });
      setSuccess(`${pathSegment} aggiornato.`);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Errore salvataggio.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEmailTemplate = async (
    name: string,
    subject: string,
    htmlBody: string,
  ): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/projects/${projectId}/email-templates`, {
        method: 'POST',
        accessToken,
        body: { name, subject, htmlBody },
      });
      setSuccess('Email template creato.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Errore creazione template.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEmailTemplate = async (templateId: string): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/projects/${projectId}/email-templates/${templateId}`, {
        method: 'DELETE',
        accessToken,
      });
      setSuccess('Email template eliminato.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Errore eliminazione template.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePdfTemplate = async (
    templateKey: string,
    name: string,
    htmlBody: string,
  ): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/projects/${projectId}/pdf-templates`, {
        method: 'POST',
        accessToken,
        body: { templateKey, name, htmlBody },
      });
      setSuccess('PDF template creato.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Errore creazione PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePdfTemplate = async (templateId: string): Promise<void> => {
    if (accessToken == null || projectId == null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/projects/${projectId}/pdf-templates/${templateId}`, {
        method: 'DELETE',
        accessToken,
      });
      setSuccess('PDF template eliminato.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Errore eliminazione PDF.');
    } finally {
      setBusy(false);
    }
  };

  if (accessToken == null) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Project Detail</h1>
        <p className="text-sm text-muted-foreground">
          Sessione non disponibile. Effettua il login per accedere al progetto.
        </p>
      </main>
    );
  }

  if (projectId == null) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-destructive">projectId mancante in rotta.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6" data-testid="project-detail-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {(project?.name as string | undefined) ?? 'Project Detail'}
          </h1>
          <p className="text-xs text-muted-foreground">
            ID: {projectId} · code:{' '}
            {(project?.code as string | undefined) ??
              (project as { code?: string } | null)?.code ??
              '—'}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={reload} disabled={busy}>
          Ricarica
        </Button>
      </header>

      <nav
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-2"
        data-testid="project-detail-tabs"
      >
        {sectionTabs.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={section === key ? 'default' : 'ghost'}
            onClick={() => setSection(key)}
            data-testid={`project-detail-tab-${key}`}
          >
            {label}
          </Button>
        ))}
      </nav>

      {error != null ? <p className="text-sm text-destructive">{error}</p> : null}
      {success != null ? <p className="text-sm text-emerald-600">{success}</p> : null}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-panel">
        {section === 'identity' ? (
          <PutSectionForm
            title="Identity"
            fields={[
              { key: 'displayName', label: 'Display name', placeholder: 'Es. Residenze Tecma' },
              { key: 'mode', label: 'Mode (rent|sell)', placeholder: 'sell' },
              { key: 'defaultLang', label: 'Default lang', placeholder: 'it' },
              { key: 'hostKey', label: 'Host key' },
              { key: 'assetKey', label: 'Asset key' },
              { key: 'feVendorKey', label: 'FE vendor key' },
              { key: 'automaticQuoteEnabled', label: 'Automatic quote enabled', type: 'boolean' },
              { key: 'accountManagerEnabled', label: 'Account manager enabled', type: 'boolean' },
              { key: 'hasDAS', label: 'Has DAS', type: 'boolean' },
            ]}
            data={project}
            onSave={handlePatchProject}
            busy={busy}
            testIdPrefix="project-identity"
          />
        ) : null}

        {section === 'contacts' ? (
          <PutSectionForm
            title="Contacts"
            fields={[
              { key: 'contactEmail', label: 'Contact email' },
              { key: 'contactPhone', label: 'Contact phone' },
              { key: 'projectUrl', label: 'Project URL' },
              { key: 'customDomain', label: 'Custom domain' },
              { key: 'city', label: 'City' },
              { key: 'payoff', label: 'Payoff' },
            ]}
            data={project}
            onSave={handlePatchProject}
            busy={busy}
            testIdPrefix="project-contacts"
          />
        ) : null}

        {section === 'branding' ? (
          <PutSectionForm
            title="Branding"
            fields={[
              { key: 'logoUrl', label: 'Logo URL' },
              { key: 'emailHeaderUrl', label: 'Email header URL' },
              { key: 'primaryColor', label: 'Primary color (#RRGGBB)' },
              { key: 'secondaryColor', label: 'Secondary color (#RRGGBB)' },
              { key: 'footerText', label: 'Footer text' },
              { key: 'faviconUrl', label: 'Favicon URL' },
            ]}
            data={branding}
            onSave={(payload) => handlePutSection('branding', payload)}
            busy={busy}
            testIdPrefix="project-branding"
          />
        ) : null}

        {section === 'policies' ? (
          <PutSectionForm
            title="Policies"
            fields={[
              { key: 'privacyPolicyUrl', label: 'Privacy URL' },
              { key: 'termsUrl', label: 'Terms URL' },
              { key: 'cookiePolicyUrl', label: 'Cookie URL' },
              { key: 'consentBannerEnabled', label: 'Consent banner', type: 'boolean' },
              { key: 'defaultRetentionDays', label: 'Retention (days)', type: 'number' },
            ]}
            data={policies}
            onSave={(payload) => handlePutSection('policies', payload)}
            busy={busy}
            testIdPrefix="project-policies"
          />
        ) : null}

        {section === 'marketing' ? (
          <PutSectionForm
            title="Marketing"
            fields={[
              { key: 'googleAnalyticsId', label: 'GA UA id' },
              { key: 'ga4PropertyId', label: 'GA4 property id' },
              { key: 'googleAdsCustomerId', label: 'Google Ads customer id' },
              { key: 'metaAdAccountId', label: 'Meta ad account id' },
              { key: 'facebookPixelId', label: 'Facebook pixel id' },
            ]}
            data={marketing}
            onSave={(payload) => handlePutSection('marketing-settings', payload)}
            busy={busy}
            testIdPrefix="project-marketing"
          />
        ) : null}

        {section === 'workflow' ? (
          <PutSectionForm
            title="Workflow"
            fields={[
              { key: 'flowType', label: 'Flow type' },
              { key: 'workflowId', label: 'Workflow id' },
              { key: 'autoAssign', label: 'Auto assign', type: 'boolean' },
              { key: 'reminderDays', label: 'Reminder (days)', type: 'number' },
            ]}
            data={workflow}
            onSave={(payload) => handlePutSection('workflow-settings', payload)}
            busy={busy}
            testIdPrefix="project-workflow"
          />
        ) : null}

        {section === 'email-config' ? (
          <PutSectionForm
            title="Email config (SMTP)"
            fields={[
              { key: 'smtpHost', label: 'SMTP host' },
              { key: 'smtpPort', label: 'SMTP port', type: 'number' },
              { key: 'smtpSecure', label: 'SMTP TLS', type: 'boolean' },
              { key: 'smtpUsername', label: 'SMTP username' },
              { key: 'smtpPassword', label: 'SMTP password' },
              { key: 'fromEmail', label: 'From email' },
              { key: 'fromName', label: 'From name' },
              { key: 'replyToEmail', label: 'Reply-to email' },
            ]}
            data={emailConfig}
            onSave={(payload) => handlePutSection('email-config', payload)}
            busy={busy}
            testIdPrefix="project-email-config"
          />
        ) : null}

        {section === 'email-templates' ? (
          <EmailTemplatesEditor
            templates={emailTemplates}
            onCreate={handleCreateEmailTemplate}
            onDelete={handleDeleteEmailTemplate}
            busy={busy}
          />
        ) : null}

        {section === 'pdf-templates' ? (
          <PdfTemplatesEditor
            templates={pdfTemplates}
            onCreate={handleCreatePdfTemplate}
            onDelete={handleDeletePdfTemplate}
            busy={busy}
          />
        ) : null}

        {section === 'legacy-overrides' ? (
          <LegacyOverridesEditor
            data={legacy}
            onSave={(payload) => handlePutSection('legacy-overrides', payload)}
            busy={busy}
          />
        ) : null}

        {section === 'connectors' ? (
          <ConnectorsViewer accessToken={accessToken} workspaceId={project?.workspaceId as string} />
        ) : null}
      </section>
    </main>
  );
};

interface EmailTemplatesEditorProps {
  templates: Array<Record<string, unknown>>;
  onCreate: (name: string, subject: string, htmlBody: string) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
  busy: boolean;
}

const EmailTemplatesEditor = ({ templates, onCreate, onDelete, busy }: EmailTemplatesEditorProps) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  return (
    <div className="space-y-3" data-testid="project-email-templates">
      <h3 className="text-sm font-semibold text-foreground">Email templates</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome (unique)" />
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
        <Input
          value={htmlBody}
          onChange={(event) => setHtmlBody(event.target.value)}
          placeholder="<p>Hello {{name}}</p>"
        />
      </div>
      <Button
        type="button"
        onClick={() => {
          void onCreate(name.trim(), subject.trim(), htmlBody.trim());
          setName('');
          setSubject('');
          setHtmlBody('');
        }}
        disabled={busy || name.trim() === '' || subject.trim() === '' || htmlBody.trim() === ''}
        data-testid="email-template-create"
      >
        Crea email template
      </Button>
      <ul className="space-y-2">
        {templates.map((template) => (
          <li
            key={String(template._id)}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{String(template.name)}</p>
              <p className="text-xs text-muted-foreground">{String(template.subject ?? '')}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onDelete(String(template._id))}
              disabled={busy}
              data-testid={`email-template-delete-${String(template._id)}`}
            >
              Elimina
            </Button>
          </li>
        ))}
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun email template definito.</p>
        ) : null}
      </ul>
    </div>
  );
};

interface PdfTemplatesEditorProps {
  templates: Array<Record<string, unknown>>;
  onCreate: (templateKey: string, name: string, htmlBody: string) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
  busy: boolean;
}

const PdfTemplatesEditor = ({ templates, onCreate, onDelete, busy }: PdfTemplatesEditorProps) => {
  const [templateKey, setTemplateKey] = useState('');
  const [name, setName] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  return (
    <div className="space-y-3" data-testid="project-pdf-templates">
      <h3 className="text-sm font-semibold text-foreground">PDF templates</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} placeholder="Template key" />
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome leggibile" />
        <Input
          value={htmlBody}
          onChange={(event) => setHtmlBody(event.target.value)}
          placeholder="<html>...</html>"
        />
      </div>
      <Button
        type="button"
        onClick={() => {
          void onCreate(templateKey.trim(), name.trim(), htmlBody.trim());
          setTemplateKey('');
          setName('');
          setHtmlBody('');
        }}
        disabled={busy || templateKey.trim() === '' || name.trim() === '' || htmlBody.trim() === ''}
        data-testid="pdf-template-create"
      >
        Crea PDF template
      </Button>
      <ul className="space-y-2">
        {templates.map((template) => (
          <li
            key={String(template._id)}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{String(template.name)}</p>
              <p className="text-xs text-muted-foreground">{String(template.templateKey ?? '')}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onDelete(String(template._id))}
              disabled={busy}
              data-testid={`pdf-template-delete-${String(template._id)}`}
            >
              Elimina
            </Button>
          </li>
        ))}
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun PDF template definito.</p>
        ) : null}
      </ul>
    </div>
  );
};

interface LegacyOverridesEditorProps {
  data: Record<string, unknown> | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}

const LegacyOverridesEditor = ({ data, onSave, busy }: LegacyOverridesEditorProps) => {
  const [identityFields, setIdentityFields] = useState('');
  const [advancedOverrides, setAdvancedOverrides] = useState('');

  useEffect(() => {
    setIdentityFields(JSON.stringify((data as { identityFields?: unknown } | null)?.identityFields ?? {}, null, 2));
    setAdvancedOverrides(
      JSON.stringify(
        (data as { advancedOverrides?: unknown } | null)?.advancedOverrides ?? [],
        null,
        2,
      ),
    );
  }, [data]);

  const handleSave = async (): Promise<void> => {
    let identity: unknown;
    let advanced: unknown;
    try {
      identity = JSON.parse(identityFields);
      advanced = JSON.parse(advancedOverrides);
    } catch (parseError) {
      throw parseError;
    }
    await onSave({ identityFields: identity, advancedOverrides: advanced });
  };

  return (
    <div className="space-y-3" data-testid="project-legacy-overrides">
      <h3 className="text-sm font-semibold text-foreground">Legacy overrides</h3>
      <p className="text-xs text-muted-foreground">
        Editor JSON: <code>identityFields</code> (object) e <code>advancedOverrides</code> (array di
        path/valueType/value).
      </p>
      <label className="text-xs font-medium text-foreground">
        identityFields
        <textarea
          className="mt-1 h-32 w-full rounded-lg border border-input bg-background p-2 font-mono text-xs"
          value={identityFields}
          onChange={(event) => setIdentityFields(event.target.value)}
        />
      </label>
      <label className="text-xs font-medium text-foreground">
        advancedOverrides
        <textarea
          className="mt-1 h-40 w-full rounded-lg border border-input bg-background p-2 font-mono text-xs"
          value={advancedOverrides}
          onChange={(event) => setAdvancedOverrides(event.target.value)}
          data-testid="legacy-overrides-advanced"
        />
      </label>
      <Button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy}
        data-testid="legacy-overrides-save"
      >
        Salva legacy overrides
      </Button>
    </div>
  );
};

interface ConnectorsViewerProps {
  accessToken: string;
  workspaceId?: string;
}

const ConnectorsViewer = ({ accessToken, workspaceId }: ConnectorsViewerProps) => {
  const [adsCustomers, setAdsCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [ga4Properties, setGa4Properties] = useState<Array<Record<string, unknown>>>([]);
  const [metaAccounts, setMetaAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [workflows, setWorkflows] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceId == null) return;
    setBusy(true);
    setError(null);
    Promise.all([
      http<{ data: Array<Record<string, unknown>> }>(
        `/workspaces/${workspaceId}/connectors/marketing-google/ads-customers`,
        { method: 'GET', accessToken },
      ).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
      http<{ data: Array<Record<string, unknown>> }>(
        `/workspaces/${workspaceId}/connectors/marketing-google/ga4-properties`,
        { method: 'GET', accessToken },
      ).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
      http<{ data: Array<Record<string, unknown>> }>(
        `/workspaces/${workspaceId}/connectors/marketing-meta/ad-accounts`,
        { method: 'GET', accessToken },
      ).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
      http<{ data: Array<Record<string, unknown>> }>(`/workspaces/${workspaceId}/workflows`, {
        method: 'GET',
        accessToken,
      }).catch(() => ({ data: [] as Array<Record<string, unknown>> })),
    ])
      .then(([ads, ga4, meta, wf]) => {
        setAdsCustomers(ads.data ?? []);
        setGa4Properties(ga4.data ?? []);
        setMetaAccounts(meta.data ?? []);
        setWorkflows(wf.data ?? []);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Caricamento connectors fallito.',
        );
      })
      .finally(() => setBusy(false));
  }, [accessToken, workspaceId]);

  if (workspaceId == null) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="project-connectors-empty">
        Workspace id non disponibile per il progetto.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="project-connectors">
      <h3 className="text-sm font-semibold text-foreground">Connectors discovery (stub)</h3>
      {error != null ? <p className="text-sm text-destructive">{error}</p> : null}
      {busy ? <p className="text-xs text-muted-foreground">Caricamento connectors...</p> : null}
      <ConnectorList title="Google Ads customers" rows={adsCustomers} />
      <ConnectorList title="GA4 properties" rows={ga4Properties} />
      <ConnectorList title="Meta ad accounts" rows={metaAccounts} />
      <ConnectorList title="Workflows workspace" rows={workflows} />
    </div>
  );
};

const ConnectorList = ({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
}) => (
  <div className="rounded-lg border border-border p-3">
    <p className="text-xs font-semibold text-foreground">{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">Nessun elemento (feature flag / token mancante).</p>
    ) : (
      <ul className="space-y-1">
        {rows.map((row, index) => (
          <li key={index} className="text-xs text-muted-foreground">
            {JSON.stringify(row)}
          </li>
        ))}
      </ul>
    )}
  </div>
);
