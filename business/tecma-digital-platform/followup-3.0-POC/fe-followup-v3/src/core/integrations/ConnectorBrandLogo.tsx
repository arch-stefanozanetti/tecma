import type { FC } from "react";
import type { SimpleIcon } from "simple-icons";
import {
  siGmail,
  siTwilio,
  siMeta,
  siMailchimp,
  siN8n,
  siSalesforce,
  siWebflow,
  siLooker,
  siSlack,
  siTypeform,
  siCalendly,
  siSendgrid,
  siStripe,
  siPaypal,
  siZendesk,
  siSnowflake,
  siGooglebigquery,
  siMetabase,
  siGrafana,
  siDatabricks,
  siGoogleanalytics,
  siGooglesheets,
  siApacheairflow,
  siDbt,
  siAnthropic,
  siOpenai,
} from "simple-icons";
import { Plug } from "lucide-react";
import { cn } from "../../lib/utils";

type LogoProps = { className?: string };

/**
 * Loghi da [Simple Icons](https://simpleicons.org/) (path + colore ufficiali del progetto).
 * Eccezioni: Microsoft Outlook (marchi MS non inclusi in Simple Icons) e DocuSign (assente dal set).
 */
function SimpleIconLogo({ icon, className }: LogoProps & { icon: SimpleIcon }) {
  return (
    <svg
      className={cn("h-8 w-8 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill={`#${icon.hex}`} d={icon.path} />
    </svg>
  );
}

/** Outlook: marchio Microsoft non presente in `simple-icons`; geometria compatibile con l’icona app Office (vedi Wikimedia / linee guida Office). */
function OutlookLogo({ className }: LogoProps) {
  return (
    <svg
      className={cn("h-8 w-8 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#0078D4" d="M7.5 21H2V9l5.5 3 5.5-3v12h-5.5z" />
      <path fill="#0364B8" d="M16.5 9v12H22V9l-5.5-3-5.5 3z" />
      <path fill="#28A8EA" d="M16.5 9 11 12l5.5 3V9z" />
      <path fill="#0078D4" d="M11 12 5.5 9v6l5.5 3V12z" />
    </svg>
  );
}

/** Fallback marchio non mappato (Google Ads, Zapier, HubSpot, portali…). */
function PlugBrandLogo({ className }: LogoProps) {
  return <Plug className={cn("h-8 w-8 shrink-0 text-muted-foreground", className)} aria-hidden />;
}

/** DocuSign non è in Simple Icons; tratto stilizzato per la card (il titolo fornisce il nome). */
function DocuSignLogo({ className }: LogoProps) {
  return (
    <svg
      className={cn("h-8 w-8 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4C00FF"
        d="M4 6h10v2H4V6zm0 4h16v2H4v-2zm0 4h12v2H4v-2zm0 4h8v2H4v-2z"
      />
    </svg>
  );
}

/** Marchi con logo dedicato; qualsiasi altra chiave `brandId` usa il fallback Plug. */
const BRAND_MAP: Record<string, FC<LogoProps>> = {
  gmail: (p) => <SimpleIconLogo icon={siGmail} {...p} />,
  outlook: OutlookLogo,
  twilio: (p) => <SimpleIconLogo icon={siTwilio} {...p} />,
  meta: (p) => <SimpleIconLogo icon={siMeta} {...p} />,
  mailchimp: (p) => <SimpleIconLogo icon={siMailchimp} {...p} />,
  n8n: (p) => <SimpleIconLogo icon={siN8n} {...p} />,
  salesforce: (p) => <SimpleIconLogo icon={siSalesforce} {...p} />,
  webflow: (p) => <SimpleIconLogo icon={siWebflow} {...p} />,
  looker_studio: (p) => <SimpleIconLogo icon={siLooker} {...p} />,
  docusign: DocuSignLogo,
  slack: (p) => <SimpleIconLogo icon={siSlack} {...p} />,
  google_ads: PlugBrandLogo,
  zapier: PlugBrandLogo,
  hubspot: PlugBrandLogo,
  portali_immobiliari: PlugBrandLogo,
  teams: PlugBrandLogo,
  pipedrive: PlugBrandLogo,
  typeform: (p) => <SimpleIconLogo icon={siTypeform} {...p} />,
  calendly: (p) => <SimpleIconLogo icon={siCalendly} {...p} />,
  sendgrid: (p) => <SimpleIconLogo icon={siSendgrid} {...p} />,
  stripe: (p) => <SimpleIconLogo icon={siStripe} {...p} />,
  paypal: (p) => <SimpleIconLogo icon={siPaypal} {...p} />,
  zendesk: (p) => <SimpleIconLogo icon={siZendesk} {...p} />,
  linkedin: PlugBrandLogo,
  power_bi: PlugBrandLogo,
  tableau: PlugBrandLogo,
  snowflake: (p) => <SimpleIconLogo icon={siSnowflake} {...p} />,
  bigquery: (p) => <SimpleIconLogo icon={siGooglebigquery} {...p} />,
  metabase: (p) => <SimpleIconLogo icon={siMetabase} {...p} />,
  grafana: (p) => <SimpleIconLogo icon={siGrafana} {...p} />,
  databricks: (p) => <SimpleIconLogo icon={siDatabricks} {...p} />,
  google_analytics: (p) => <SimpleIconLogo icon={siGoogleanalytics} {...p} />,
  google_sheets_export: (p) => <SimpleIconLogo icon={siGooglesheets} {...p} />,
  airflow: (p) => <SimpleIconLogo icon={siApacheairflow} {...p} />,
  dbt: (p) => <SimpleIconLogo icon={siDbt} {...p} />,
  teamsystem: PlugBrandLogo,
  adobe_sign: PlugBrandLogo,
  dropbox_sign: PlugBrandLogo,
  pandadoc: PlugBrandLogo,
  yousign: PlugBrandLogo,
  flywire: PlugBrandLogo,
  anthropic: (p) => <SimpleIconLogo icon={siAnthropic} {...p} />,
  openai: (p) => <SimpleIconLogo icon={siOpenai} {...p} />,
  /** Azure OpenAI: nessun marchio dedicato stabile in Simple Icons per il servizio; fallback. */
  azure_openai: PlugBrandLogo,
  /** MCP: protocollo, non singolo vendor. */
  mcp: PlugBrandLogo,
  gemini: PlugBrandLogo,
  mistral: PlugBrandLogo,
};

export function ConnectorBrandLogo({
  brandId,
  className,
}: {
  brandId?: string;
  className?: string;
}) {
  if (!brandId) {
    return <Plug className={cn("h-8 w-8 shrink-0 text-muted-foreground", className)} aria-hidden />;
  }
  const Cmp = BRAND_MAP[brandId] ?? PlugBrandLogo;
  return <Cmp className={className} />;
}
