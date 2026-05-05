import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

type FeatureRow = {
  workspaceId: string;
  feature: string;
  status: 'enabled' | 'disabled';
  metadata?: unknown;
  updatedAt?: string | null;
};

type AiConfig = {
  provider?: 'claude' | 'openai' | 'gemini';
  apiKey?: string | null;
  model?: string | null;
  temperature?: number | null;
  enabled?: boolean | null;
} | null;

type AdditionalInfo = {
  _id: string;
  workspaceId: string;
  label: string;
  value: string;
  sortOrder: number;
};

type Branding = {
  logoUrl?: string;
  emailHeaderUrl?: string;
  primaryColor?: string;
  footerText?: string;
} | null;

type Asset = {
  _id: string;
  workspaceId: string;
  fileName: string;
  contentType: string;
  kind: string;
  status: string;
  createdAt?: string;
  inlineData?: string;
  storageKey?: string;
};

export interface WorkspaceAdvancedPanelProps {
  accessToken: string;
  workspaceId: string;
  canManage: boolean;
}

export type AdvancedTabKey = 'branding' | 'ai' | 'infos' | 'entitlements' | 'assets';

const TAB_LABELS: Record<AdvancedTabKey, string> = {
  branding: 'Branding',
  ai: 'AI Config',
  infos: 'Additional infos',
  entitlements: 'Entitlements',
  assets: 'Asset',
};

export const WorkspaceAdvancedPanel = ({
  accessToken,
  workspaceId,
  canManage,
}: WorkspaceAdvancedPanelProps) => {
  const [tab, setTab] = useState<AdvancedTabKey>('branding');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [aiConfig, setAiConfig] = useState<AiConfig>(null);
  const [aiDraft, setAiDraft] = useState<{
    provider: 'claude' | 'openai' | 'gemini';
    apiKey: string;
    model: string;
    temperature: number;
    enabled: boolean;
  }>({ provider: 'openai', apiKey: '', model: '', temperature: 0.3, enabled: true });
  const [additionalInfos, setAdditionalInfos] = useState<AdditionalInfo[]>([]);
  const [newInfoLabel, setNewInfoLabel] = useState('');
  const [newInfoValue, setNewInfoValue] = useState('');
  const [branding, setBranding] = useState<Branding>(null);
  const [brandingDraft, setBrandingDraft] = useState<{
    logoUrl: string;
    emailHeaderUrl: string;
    primaryColor: string;
    footerText: string;
  }>({ logoUrl: '', emailHeaderUrl: '', primaryColor: '', footerText: '' });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetInline, setNewAssetInline] = useState('');

  const reload = async (): Promise<void> => {
    setBusy(true);
    try {
      const [feat, ai, infos, br, ass] = await Promise.all([
        http<{ data: FeatureRow[] }>(`/workspaces/${workspaceId}/entitlements`, {
          method: 'GET',
          accessToken,
        }),
        http<{ data: AiConfig }>(`/workspaces/${workspaceId}/ai-config`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: null as AiConfig })),
        http<{ data: AdditionalInfo[] }>(`/workspaces/${workspaceId}/additional-infos`, {
          method: 'GET',
          accessToken,
        }),
        http<{ data: Branding }>(`/workspaces/${workspaceId}/branding`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: null as Branding })),
        http<{ data: Asset[] }>(`/workspaces/${workspaceId}/assets`, {
          method: 'GET',
          accessToken,
        }).catch(() => ({ data: [] as Asset[] })),
      ]);
      setFeatures(Array.isArray(feat.data) ? feat.data : []);
      setAiConfig(ai.data ?? null);
      if (ai.data?.provider != null) {
        setAiDraft({
          provider: ai.data.provider,
          apiKey: '',
          model: ai.data.model ?? '',
          temperature: ai.data.temperature ?? 0.3,
          enabled: ai.data.enabled ?? true,
        });
      }
      setAdditionalInfos(Array.isArray(infos.data) ? infos.data : []);
      setBranding(br.data ?? null);
      setBrandingDraft({
        logoUrl: br.data?.logoUrl ?? '',
        emailHeaderUrl: br.data?.emailHeaderUrl ?? '',
        primaryColor: br.data?.primaryColor ?? '',
        footerText: br.data?.footerText ?? '',
      });
      setAssets(Array.isArray(ass.data) ? ass.data : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Caricamento sezioni avanzate fallito.',
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [accessToken, workspaceId]);

  const onToggleFeature = async (feature: string, status: 'enabled' | 'disabled'): Promise<void> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(
        `/workspaces/${workspaceId}/entitlements/${encodeURIComponent(feature)}`,
        {
          method: 'PATCH',
          accessToken,
          body: { status },
        },
      );
      setSuccess(`Feature "${feature}" ${status === 'enabled' ? 'abilitata' : 'disabilitata'}.`);
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Aggiornamento entitlement fallito.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSaveAi = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {
        provider: aiDraft.provider,
        model: aiDraft.model.trim() === '' ? undefined : aiDraft.model,
        temperature: aiDraft.temperature,
        enabled: aiDraft.enabled,
      };
      if (aiDraft.apiKey.trim() !== '') body.apiKey = aiDraft.apiKey;
      await http(`/workspaces/${workspaceId}/ai-config`, {
        method: 'PUT',
        accessToken,
        body,
      });
      setSuccess('Configurazione AI salvata.');
      setAiDraft((current) => ({ ...current, apiKey: '' }));
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Salvataggio AI fallito.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onCreateInfo = async (): Promise<void> => {
    if (newInfoLabel.trim() === '') {
      setError('Label additional info obbligatoria.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/workspaces/${workspaceId}/additional-infos`, {
        method: 'POST',
        accessToken,
        body: {
          label: newInfoLabel.trim(),
          value: newInfoValue,
          sortOrder: additionalInfos.length,
        },
      });
      setNewInfoLabel('');
      setNewInfoValue('');
      setSuccess('Additional info creata.');
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Creazione additional info fallita.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onDeleteInfo = async (infoId: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/workspaces/${workspaceId}/additional-infos/${encodeURIComponent(infoId)}`, {
        method: 'DELETE',
        accessToken,
      });
      setSuccess('Additional info eliminata.');
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Eliminazione additional info fallita.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSaveBranding = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {};
      if (brandingDraft.logoUrl.trim() !== '') body.logoUrl = brandingDraft.logoUrl;
      if (brandingDraft.emailHeaderUrl.trim() !== '') body.emailHeaderUrl = brandingDraft.emailHeaderUrl;
      if (brandingDraft.primaryColor.trim() !== '') body.primaryColor = brandingDraft.primaryColor;
      if (brandingDraft.footerText.trim() !== '') body.footerText = brandingDraft.footerText;
      await http(`/workspaces/${workspaceId}/branding`, {
        method: 'PATCH',
        accessToken,
        body,
      });
      setSuccess('Branding aggiornato.');
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Salvataggio branding fallito.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onCreateAsset = async (): Promise<void> => {
    if (newAssetName.trim() === '' || newAssetInline.trim() === '') {
      setError('Inserire nome file e contenuto base64 (modalita inline).');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/workspaces/${workspaceId}/assets`, {
        method: 'POST',
        accessToken,
        body: {
          fileName: newAssetName.trim(),
          contentType: 'image/png',
          kind: 'workspace.logo',
          inlineData: newAssetInline.trim(),
        },
      });
      setNewAssetName('');
      setNewAssetInline('');
      setSuccess('Asset registrato.');
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Caricamento asset fallito.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onDeleteAsset = async (assetId: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await http(`/workspaces/${workspaceId}/assets/${encodeURIComponent(assetId)}`, {
        method: 'DELETE',
        accessToken,
      });
      setSuccess('Asset eliminato.');
      await reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Eliminazione asset fallita.',
      );
    } finally {
      setBusy(false);
    }
  };

  const tabs = useMemo(
    () => Object.entries(TAB_LABELS) as Array<[AdvancedTabKey, string]>,
    [],
  );

  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-panel"
      data-testid="workspace-advanced-panel"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Sezioni avanzate workspace</h3>
          <p className="text-xs text-muted-foreground">
            Branding, configurazione AI, additional infos, entitlements e asset condivisi.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={tab === key ? 'default' : 'ghost'}
              onClick={() => setTab(key)}
              data-testid={`workspace-advanced-tab-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>
      </header>

      {error != null ? <p className="text-sm text-destructive">{error}</p> : null}
      {success != null ? <p className="text-sm text-emerald-600">{success}</p> : null}

      {tab === 'entitlements' ? (
        <div className="space-y-2">
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">Caricamento entitlement...</p>
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature.feature}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{feature.feature}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">
                    Stato: {feature.status}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={feature.status === 'enabled' ? 'destructive' : 'default'}
                    disabled={busy}
                    onClick={() =>
                      void onToggleFeature(
                        feature.feature,
                        feature.status === 'enabled' ? 'disabled' : 'enabled',
                      )
                    }
                    data-testid={`feature-toggle-${feature.feature}`}
                  >
                    {feature.status === 'enabled' ? 'Disabilita' : 'Abilita'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'ai' ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-foreground">
              Provider
              <select
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={aiDraft.provider}
                onChange={(event) =>
                  setAiDraft((current) => ({
                    ...current,
                    provider: event.target.value as typeof current.provider,
                  }))
                }
                data-testid="ai-provider-select"
              >
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="text-xs font-medium text-foreground">
              Modello
              <Input
                value={aiDraft.model}
                onChange={(event) =>
                  setAiDraft((current) => ({ ...current, model: event.target.value }))
                }
                placeholder="es. gpt-4o, claude-3-opus, gemini-1.5-pro"
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              Temperatura
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={aiDraft.temperature}
                onChange={(event) =>
                  setAiDraft((current) => ({
                    ...current,
                    temperature: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              API key (mascherata in lettura)
              <Input
                type="password"
                value={aiDraft.apiKey}
                onChange={(event) =>
                  setAiDraft((current) => ({ ...current, apiKey: event.target.value }))
                }
                placeholder={
                  aiConfig?.apiKey != null && aiConfig.apiKey !== ''
                    ? String(aiConfig.apiKey)
                    : 'sk-...'
                }
                data-testid="ai-apikey-input"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={aiDraft.enabled}
              onChange={(event) =>
                setAiDraft((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
            Abilita assistant AI per il workspace
          </label>
          {canManage ? (
            <Button
              type="button"
              onClick={onSaveAi}
              disabled={busy}
              data-testid="ai-save-button"
            >
              {busy ? 'Salvataggio...' : 'Salva configurazione AI'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === 'infos' ? (
        <div className="space-y-3">
          {canManage ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={newInfoLabel}
                onChange={(event) => setNewInfoLabel(event.target.value)}
                placeholder="Label (es. Codice ATECO)"
                data-testid="info-new-label"
              />
              <Input
                value={newInfoValue}
                onChange={(event) => setNewInfoValue(event.target.value)}
                placeholder="Valore"
              />
              <Button
                type="button"
                onClick={onCreateInfo}
                disabled={busy}
                data-testid="info-create-button"
              >
                Aggiungi
              </Button>
            </div>
          ) : null}
          <ul className="space-y-2">
            {additionalInfos.map((info) => (
              <li
                key={info._id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{info.label}</p>
                  <p className="text-xs text-muted-foreground">{info.value}</p>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteInfo(info._id)}
                    disabled={busy}
                    data-testid={`info-delete-${info._id}`}
                  >
                    Elimina
                  </Button>
                ) : null}
              </li>
            ))}
            {additionalInfos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna additional info presente.</p>
            ) : null}
          </ul>
        </div>
      ) : null}

      {tab === 'branding' ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-foreground">
              Logo URL
              <Input
                value={brandingDraft.logoUrl}
                onChange={(event) =>
                  setBrandingDraft((current) => ({ ...current, logoUrl: event.target.value }))
                }
                placeholder="https://cdn.tecma.test/logo.png"
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              Email header URL
              <Input
                value={brandingDraft.emailHeaderUrl}
                onChange={(event) =>
                  setBrandingDraft((current) => ({
                    ...current,
                    emailHeaderUrl: event.target.value,
                  }))
                }
                placeholder="https://cdn.tecma.test/email-header.png"
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              Primary color (#RRGGBB)
              <Input
                value={brandingDraft.primaryColor}
                onChange={(event) =>
                  setBrandingDraft((current) => ({
                    ...current,
                    primaryColor: event.target.value,
                  }))
                }
                placeholder="#1A2B3C"
                data-testid="branding-color-input"
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              Footer text
              <Input
                value={brandingDraft.footerText}
                onChange={(event) =>
                  setBrandingDraft((current) => ({ ...current, footerText: event.target.value }))
                }
                placeholder="Powered by Tecma"
              />
            </label>
          </div>
          {canManage ? (
            <Button
              type="button"
              onClick={onSaveBranding}
              disabled={busy}
              data-testid="branding-save-button"
            >
              {busy ? 'Salvataggio...' : 'Salva branding'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === 'assets' ? (
        <div className="space-y-3">
          {canManage ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={newAssetName}
                onChange={(event) => setNewAssetName(event.target.value)}
                placeholder="logo.png"
              />
              <Input
                value={newAssetInline}
                onChange={(event) => setNewAssetInline(event.target.value)}
                placeholder="base64 (fallback inline)"
                data-testid="asset-inline-input"
              />
              <Button
                type="button"
                onClick={onCreateAsset}
                disabled={busy}
                data-testid="asset-create-button"
              >
                Carica
              </Button>
            </div>
          ) : null}
          <ul className="space-y-2">
            {assets.map((asset) => (
              <li
                key={asset._id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{asset.fileName}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {asset.kind} · {asset.contentType}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteAsset(asset._id)}
                    disabled={busy}
                    data-testid={`asset-delete-${asset._id}`}
                  >
                    Elimina
                  </Button>
                ) : null}
              </li>
            ))}
            {assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun asset caricato.</p>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
