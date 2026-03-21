import { logger } from "../../observability/logger.js";
import { getRequestContext } from "../../observability/request-context.js";
import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";
import { normalizeProviderError } from "./messaging-errors.js";
import type { ProviderAdapter } from "./provider-adapter.js";
import { getRoutingDecision } from "./routing-policy-engine.js";
import type { DeliveryRequest, DeliveryResult, MessagingProvider } from "./messaging.types.js";
import { resolveWhatsAppRoute } from "./whatsapp-route-resolver.js";
import { AwsSmsProvider } from "./providers/aws-sms.provider.js";
import { MetaWhatsAppProvider } from "./providers/meta-whatsapp.provider.js";
import { TwilioProvider } from "./providers/twilio.provider.js";

const providers: Record<MessagingProvider, ProviderAdapter> = {
  aws_sms: new AwsSmsProvider(),
  meta_whatsapp: new MetaWhatsAppProvider(),
  twilio: new TwilioProvider(),
};

function providerFor(name: MessagingProvider): ProviderAdapter {
  return providers[name];
}

async function resolveRouteForRequest(request: DeliveryRequest): Promise<{ primary: MessagingProvider; fallback?: MessagingProvider }> {
  if (request.channel === "whatsapp") {
    const wa = await resolveWhatsAppRoute(request.workspaceId);
    return { primary: wa.primary };
  }
  return getRoutingDecision(request.channel);
}

export async function sendWithMessagingGateway(request: DeliveryRequest): Promise<DeliveryResult> {
  const start = Date.now();
  const context = getRequestContext();
  const route = await resolveRouteForRequest(request);
  const usesTwilio = route.primary === "twilio" || route.fallback === "twilio";
  if (usesTwilio) {
    const entitled = await isWorkspaceEntitledToFeature(request.workspaceId, "twilio");
    if (!entitled) {
      return {
        ok: false,
        provider: "twilio",
        channel: request.channel,
        status: "failed",
        errorCode: "NotEntitled",
        errorMessage: "Twilio non abilitato per questo workspace (entitlement).",
      };
    }
  }
  const primary = providerFor(route.primary);

  try {
    const result = await primary.send(request, {
      requestId: context?.requestId,
      tenantId: request.workspaceId,
    });
    logger.info(
      {
        requestId: context?.requestId,
        workspaceId: request.workspaceId,
        channel: request.channel,
        provider: result.provider,
        status: result.status,
        latencyMs: Date.now() - start,
      },
      "[messaging] delivered via primary provider"
    );
    return result;
  } catch (err) {
    const normalized = normalizeProviderError(err);
    logger.warn(
      {
        requestId: context?.requestId,
        workspaceId: request.workspaceId,
        channel: request.channel,
        provider: primary.provider,
        normalizedCode: normalized.code,
        err,
      },
      "[messaging] primary provider failed"
    );

    if (!route.fallback) {
      return {
        ok: false,
        provider: primary.provider,
        channel: request.channel,
        status: "failed",
        errorCode: normalized.code,
        errorMessage: normalized.message,
      };
    }

    const fallback = providerFor(route.fallback);
    try {
      const fallbackResult = await fallback.send(request, {
        requestId: context?.requestId,
        tenantId: request.workspaceId,
      });
      logger.info(
        {
          requestId: context?.requestId,
          workspaceId: request.workspaceId,
          channel: request.channel,
          provider: fallbackResult.provider,
          status: fallbackResult.status,
          latencyMs: Date.now() - start,
        },
        "[messaging] delivered via fallback provider"
      );
      return fallbackResult;
    } catch (fallbackErr) {
      const fallbackNormalized = normalizeProviderError(fallbackErr);
      logger.error(
        {
          requestId: context?.requestId,
          workspaceId: request.workspaceId,
          channel: request.channel,
          primaryProvider: primary.provider,
          fallbackProvider: fallback.provider,
          normalizedCode: fallbackNormalized.code,
          err: fallbackErr,
        },
        "[messaging] fallback provider failed"
      );
      return {
        ok: false,
        provider: fallback.provider,
        channel: request.channel,
        status: "failed",
        errorCode: fallbackNormalized.code,
        errorMessage: fallbackNormalized.message,
      };
    }
  }
}

