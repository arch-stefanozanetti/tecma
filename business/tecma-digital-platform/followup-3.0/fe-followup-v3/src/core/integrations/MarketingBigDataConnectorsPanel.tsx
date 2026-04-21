/**
 * Connettori Big Data workspace: OAuth guidato Google / Meta + sezione Avanzato (incolla manuale).
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import { trackProductEvent } from "../../telemetry/trackProductEvent";
import { INTEGRATION_LABELS } from "./integrationUiLabels";

type Props = {
  workspaceId: string;
  readOnly: boolean;
  /** Sostituisce il margine superiore predefinito (es. inline in Big Data). */
  className?: string;
  /** Incrementare dopo redirect OAuth da Integrazioni per ricaricare lo stato. */
  refreshKey?: number;
  /** Superficie UI per `integr.marketing.oauth_click`. */
  oauthTelemetrySurface?: "integrations" | "project_detail" | "bigdata";
};

export const MarketingBigDataConnectorsPanel = ({
  workspaceId,
  readOnly,
  className,
  refreshKey = 0,
  oauthTelemetrySurface = "integrations",
}: Props) => {
  const { toastError, toastSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<"google" | "meta" | null>(null);
  const [metaToken, setMetaToken] = useState("");
  const [ga4Json, setGa4Json] = useState("");
  const [gAdsRefresh, setGAdsRefresh] = useState("");
  const [gAdsClientId, setGAdsClientId] = useState("");
  const [gAdsClientSecret, setGAdsClientSecret] = useState("");
  const [metaMasked, setMetaMasked] = useState<string | undefined>();
  const [ga4Masked, setGa4Masked] = useState<string | undefined>();
  const [gAdsMasked, setGAdsMasked] = useState<string | undefined>();
  const [hasGAdsClient, setHasGAdsClient] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [m, g, a] = await Promise.all([
        followupApi.getMarketingMetaAdsConnectorConfig(workspaceId).catch(() => ({ config: null })),
        followupApi.getMarketingGa4ConnectorConfig(workspaceId).catch(() => ({ config: null })),
        followupApi.getMarketingGoogleAdsConnectorConfig(workspaceId).catch(() => ({ config: null })),
      ]);
      setMetaMasked(m.config?.accessTokenMasked);
      setGa4Masked(g.config?.serviceAccountJsonMasked);
      setGAdsMasked(a.config?.refreshTokenMasked);
      setHasGAdsClient(Boolean(a.config?.hasClientId && a.config?.hasClientSecret));
    } catch {
      setMetaMasked(undefined);
      setGa4Masked(undefined);
      setGAdsMasked(undefined);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const startGoogleOAuth = async () => {
    setConnecting("google");
    try {
      trackProductEvent("integr.marketing.oauth_click", {
        surface: oauthTelemetrySurface,
        provider: "google",
        workspace_id: workspaceId,
        section: "integrations",
      });
      const { url } = await followupApi.getMarketingGoogleOAuthUrl(workspaceId);
      const popup = window.open(url, "marketing-google-oauth", "width=540,height=760,scrollbars=yes");
      if (!popup) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      toastSuccess("Finestra Google aperta. Completa il login e poi torna qui.");
      setConnecting(null);
    } catch (e) {
      const base = e instanceof Error ? e.message : "Impossibile avviare OAuth Google";
      const hint = e instanceof HttpApiError && e.hint ? ` ${e.hint}` : "";
      toastError(`${base}${hint}`.trim());
      setConnecting(null);
    }
  };

  const startMetaOAuth = async () => {
    setConnecting("meta");
    try {
      trackProductEvent("integr.marketing.oauth_click", {
        surface: oauthTelemetrySurface,
        provider: "meta",
        workspace_id: workspaceId,
        section: "integrations",
      });
      const { url } = await followupApi.getMarketingMetaOAuthUrl(workspaceId);
      const popup = window.open(url, "marketing-meta-oauth", "width=540,height=760,scrollbars=yes");
      if (!popup) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      toastSuccess("Finestra Meta aperta. Completa il login e poi torna qui.");
      setConnecting(null);
    } catch (e) {
      const base = e instanceof Error ? e.message : "Impossibile avviare OAuth Meta";
      const hint = e instanceof HttpApiError && e.hint ? ` ${e.hint}` : "";
      toastError(`${base}${hint}`.trim());
      setConnecting(null);
    }
  };

  const saveMeta = async () => {
    if (!metaToken.trim()) return;
    try {
      await followupApi.saveMarketingMetaAdsConnectorConfig(workspaceId, { accessToken: metaToken.trim() });
      setMetaToken("");
      toastSuccess("Token Meta salvato.");
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio Meta");
    }
  };

  const saveGa4 = async () => {
    if (!ga4Json.trim()) return;
    try {
      await followupApi.saveMarketingGa4ConnectorConfig(workspaceId, { serviceAccountJson: ga4Json.trim() });
      setGa4Json("");
      toastSuccess("Service account GA4 salvato.");
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio GA4");
    }
  };

  const saveGAds = async () => {
    if (!gAdsRefresh.trim()) return;
    try {
      await followupApi.saveMarketingGoogleAdsConnectorConfig(workspaceId, {
        refreshToken: gAdsRefresh.trim(),
        clientId: gAdsClientId.trim() || undefined,
        clientSecret: gAdsClientSecret.trim() || undefined,
      });
      setGAdsRefresh("");
      setGAdsClientId("");
      setGAdsClientSecret("");
      toastSuccess("OAuth Google Ads salvato.");
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio Google Ads");
    }
  };

  if (!workspaceId) return null;

  const googleLinked = Boolean(gAdsMasked);
  const metaLinked = Boolean(metaMasked);

  return (
    <div className={cn("mt-10 rounded-xl border border-border bg-card/40 p-5", className)}>
      <h2 className="text-lg font-semibold text-foreground">Big Data — accesso alle API (workspace)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Collega <span className="font-medium text-foreground">Google</span> (Ads + Analytics) e{" "}
        <span className="font-medium text-foreground">Meta</span> con un login. Il developer token Google Ads resta configurato
        dall&apos;amministratore sul server.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Gli <span className="font-medium text-foreground">ID per progetto</span> (customer, property GA4, act_) si scelgono in
        Progetti → <span className="font-medium text-foreground">Marketing / Big Data</span> usando le tendine quando il workspace
        è collegato.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Caricamento stato…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Google (Ads + GA4)</h3>
                <p className="text-xs text-muted-foreground">
                  {googleLinked ? `Collegato (${gAdsMasked})` : "Non collegato"}
                </p>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  {!googleLinked ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={connecting !== null}
                      onClick={() => void startGoogleOAuth()}
                    >
                      {connecting === "google" ? "Apertura…" : INTEGRATION_LABELS.connectNow}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void followupApi
                          .deleteMarketingGoogleAdsConnectorConfig(workspaceId)
                          .then(() => {
                            toastSuccess("Collegamento Google rimosso.");
                            void load();
                          })
                          .catch((e) => toastError(e instanceof Error ? e.message : "Errore"))
                      }
                    >
                      {INTEGRATION_LABELS.disconnectGoogle}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Meta Marketing API</h3>
                <p className="text-xs text-muted-foreground">
                  {metaLinked ? `Collegato (${metaMasked})` : "Non collegato"}
                </p>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  {!metaLinked ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={connecting !== null}
                      onClick={() => void startMetaOAuth()}
                    >
                      {connecting === "meta" ? "Apertura…" : INTEGRATION_LABELS.connectNow}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void followupApi
                          .deleteMarketingMetaAdsConnectorConfig(workspaceId)
                          .then(() => {
                            toastSuccess("Collegamento Meta rimosso.");
                            void load();
                          })
                          .catch((e) => toastError(e instanceof Error ? e.message : "Errore"))
                      }
                    >
                      {INTEGRATION_LABELS.disconnectMeta}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <details className="rounded-lg border border-border bg-muted/20 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Avanzato — incolla manualmente token / JSON / refresh
            </summary>
            <div className="mt-6 space-y-8 border-t border-border pt-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Meta — access token (manuale)</h3>
                {metaMasked && <p className="text-xs text-muted-foreground">Configurato: {metaMasked}</p>}
                {!readOnly && (
                  <>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="Nuovo access token (long-lived)"
                      value={metaToken}
                      onChange={(e) => setMetaToken(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!metaToken.trim()} onClick={() => void saveMeta()}>
                        Salva Meta
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!metaMasked}
                        onClick={() =>
                          void followupApi
                            .deleteMarketingMetaAdsConnectorConfig(workspaceId)
                            .then(() => {
                              toastSuccess("Rimosso.");
                              void load();
                            })
                            .catch((e) => toastError(e instanceof Error ? e.message : "Errore"))
                        }
                      >
                        {INTEGRATION_LABELS.removeSavedConfig}
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">GA4 — service account JSON</h3>
                {ga4Masked && <p className="text-xs text-muted-foreground">Configurato: {ga4Masked}</p>}
                {!readOnly && (
                  <>
                    <Textarea
                      placeholder="Incolla JSON service account (intero file)"
                      value={ga4Json}
                      onChange={(e) => setGa4Json(e.target.value)}
                      rows={4}
                      className="font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!ga4Json.trim()} onClick={() => void saveGa4()}>
                        Salva GA4
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!ga4Masked}
                        onClick={() =>
                          void followupApi
                            .deleteMarketingGa4ConnectorConfig(workspaceId)
                            .then(() => {
                              toastSuccess("Rimosso.");
                              void load();
                            })
                            .catch((e) => toastError(e instanceof Error ? e.message : "Errore"))
                        }
                      >
                        {INTEGRATION_LABELS.removeSavedConfig}
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Google Ads — refresh token (manuale)</h3>
                <p className="text-xs text-muted-foreground">
                  Alternativa a &quot;Collega Google&quot;. Opzionale client id/secret se diversi da env server.
                </p>
                {gAdsMasked && (
                  <p className="text-xs text-muted-foreground">
                    Configurato: {gAdsMasked}
                    {hasGAdsClient ? " — con client OAuth workspace" : ""}
                  </p>
                )}
                {!readOnly && (
                  <>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="Refresh token OAuth"
                      value={gAdsRefresh}
                      onChange={(e) => setGAdsRefresh(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Client ID (opz.)"
                        value={gAdsClientId}
                        onChange={(e) => setGAdsClientId(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <Input
                        type="password"
                        placeholder="Client secret (opz.)"
                        value={gAdsClientSecret}
                        onChange={(e) => setGAdsClientSecret(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!gAdsRefresh.trim()} onClick={() => void saveGAds()}>
                        Salva Google Ads
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!gAdsMasked}
                        onClick={() =>
                          void followupApi
                            .deleteMarketingGoogleAdsConnectorConfig(workspaceId)
                            .then(() => {
                              toastSuccess("Rimosso.");
                              void load();
                            })
                            .catch((e) => toastError(e instanceof Error ? e.message : "Errore"))
                        }
                      >
                        {INTEGRATION_LABELS.removeSavedConfig}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};
