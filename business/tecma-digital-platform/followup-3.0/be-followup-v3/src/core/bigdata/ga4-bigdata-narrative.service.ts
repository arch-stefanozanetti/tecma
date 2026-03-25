/**
 * Sintesi testuale GA4 (Big Data) on-demand tramite LLM configurato sul workspace.
 */
import { z } from "zod";
import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";
import { completeJson } from "../ai/llm.client.js";
import { fetchGa4TrafficSummary, type Ga4InsightsResult } from "../marketing/ga4-insights.stub.js";
import { getProjectMarketingSettingsRaw } from "../projects/project-marketing-settings.service.js";
import { getWorkspaceAiConfigInternal } from "../workspaces/workspace-ai-config.service.js";

const BodySchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
});

function compactGa4ForLlm(ga4: Ga4InsightsResult): Record<string, unknown> {
  const r = ga4.report;
  return {
    propertyDisplayName: ga4.propertyDisplayName,
    propertyId: ga4.propertyId,
    summary: ga4.summary,
    report: r
      ? {
          trendHead: r.trend.slice(0, 5),
          trendTail: r.trend.slice(-5),
          channelsTop: r.channels.slice(0, 8),
          firstUserChannelsTop: r.firstUserChannels.slice(0, 8),
          devicesTop: r.devices.slice(0, 8),
          firstUserAcquisitionTop: r.firstUserAcquisition.slice(0, 10),
          landingPagesTop: r.landingPages.slice(0, 10),
          chartInsights: r.chartInsights,
        }
      : undefined,
    recommerceWeb: ga4.recommerceWeb
      ? {
          listingSampleRows: ga4.recommerceWeb.listingSampleRows,
          aptDetailSampleRows: ga4.recommerceWeb.aptDetailSampleRows,
          topFiltersSample: ga4.recommerceWeb.topFilterDimensions.slice(0, 15),
          topAptSample: ga4.recommerceWeb.topAptViewsFromGa4.slice(0, 15),
        }
      : undefined,
  };
}

export async function generateGa4BigDataAiNarrative(raw: unknown): Promise<{
  data: { markdown: string; generatedAt: string };
}> {
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError("Body non valido: workspaceId, projectId, dateFrom, dateTo obbligatori", 400);
  }
  const { workspaceId, projectId, dateFrom, dateTo } = parsed.data;

  if (ENV.AI_LLM_DISABLED) {
    throw new HttpError("LLM disabilitato in questo ambiente", 503, "AI_LLM_DISABLED");
  }

  const ai = await getWorkspaceAiConfigInternal(workspaceId);
  if (!ai) {
    throw new HttpError(
      "Configurazione AI workspace assente. Impostala in Workspaces (provider e API key).",
      400,
      "WORKSPACE_AI_MISSING"
    );
  }

  const settings = await getProjectMarketingSettingsRaw(projectId);
  const ga4PropertyId = settings?.ga4PropertyId?.trim();
  if (!ga4PropertyId) {
    throw new HttpError("Progetto senza proprietà GA4 configurata.", 400);
  }

  const ga4 = await fetchGa4TrafficSummary({
    workspaceId,
    propertyId: ga4PropertyId,
    dateFrom,
    dateTo,
    includeGa4Charts: true,
    includeRecommerceWeb: true,
  });

  if (!ga4.configured) {
    throw new HttpError("GA4 non configurato per questo progetto.", 400);
  }

  const payload = compactGa4ForLlm(ga4);
  const system = `Sei un analista marketing per il settore immobiliare. Ricevi JSON con metriche GA4 aggregate (nessun dato personale identificabile).
Rispondi SOLO con un oggetto JSON valido con questa forma esatta:
{"markdown":"..."}
dove "markdown" è testo in italiano in Markdown (usa ## per titoli di sezione, elenchi puntati) che include:
1) Sintesi del periodo in 2-4 frasi basata solo sui numeri forniti.
2) 2-4 osservazioni su canali, dispositivi, prima acquisizione (source/medium) o landing se presenti.
3) Se nel JSON c'è recommerceWeb con dati, una breve sezione sul listino (filtri/schede).
4) 2-3 suggerimenti operativi prudenti (nessuna promessa di risultati).

Non inventare cifre o percentuali non presenti nel JSON. Massimo circa 1200 caratteri nel campo markdown.`;

  const userContent = `Periodo: ${dateFrom} → ${dateTo}\nDati:\n${JSON.stringify(payload)}`;

  let out: unknown;
  try {
    out = await completeJson({
      provider: ai.provider,
      apiKey: ai.apiKey,
      system,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore chiamata LLM";
    throw new HttpError(`Sintesi IA non disponibile: ${msg}`, 502, "LLM_ERROR");
  }

  const markdown =
    typeof out === "object" &&
    out !== null &&
    "markdown" in out &&
    typeof (out as { markdown: unknown }).markdown === "string"
      ? (out as { markdown: string }).markdown.trim()
      : "";

  if (!markdown) {
    throw new HttpError("Risposta IA vuota o non valida", 502, "LLM_EMPTY");
  }

  return { data: { markdown, generatedAt: new Date().toISOString() } };
}
