import type { DeliveryRequest, DeliveryResult, MessagingChannel, MessagingProvider, ProviderContext } from "./messaging.types.js";

export interface ProviderAdapter {
  readonly provider: MessagingProvider;
  supports(channel: MessagingChannel): boolean;
  send(request: DeliveryRequest, context?: ProviderContext): Promise<DeliveryResult>;
}

