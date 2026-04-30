/**
 * Redirect URI OAuth marketing: esplicito da env, oppure default solo in ambienti non production-like.
 */
import { ENV, isProductionLike } from "../../config/env.js";

export function resolveGoogleMarketingRedirectUri(): string {
  const explicit = ENV.GOOGLE_MARKETING_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (!isProductionLike()) {
    return `http://localhost:${ENV.PORT}/v1/connectors/marketing-google/callback`;
  }
  return "";
}

export function resolveMetaMarketingRedirectUri(): string {
  const explicit = ENV.META_MARKETING_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (!isProductionLike()) {
    return `http://localhost:${ENV.PORT}/v1/connectors/marketing-meta/callback`;
  }
  return "";
}

export function suggestedGoogleMarketingRedirectUriForDocs(): string {
  return (
    ENV.GOOGLE_MARKETING_REDIRECT_URI?.trim() ||
    `http://localhost:${ENV.PORT}/v1/connectors/marketing-google/callback`
  );
}

export function suggestedMetaMarketingRedirectUriForDocs(): string {
  return (
    ENV.META_MARKETING_REDIRECT_URI?.trim() ||
    `http://localhost:${ENV.PORT}/v1/connectors/marketing-meta/callback`
  );
}
