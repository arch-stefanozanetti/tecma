import type { MessagingChannel, MessagingProvider } from "./messaging.types.js";

export interface RoutingDecision {
  primary: MessagingProvider;
  fallback?: MessagingProvider;
}

export function getRoutingDecision(channel: MessagingChannel): RoutingDecision {
  if (channel === "sms") {
    return {
      primary: "aws_sms",
      fallback: process.env.MESSAGE_TWILIO_FALLBACK_ENABLED === "true" ? "twilio" : undefined,
    };
  }
  return {
    primary: "twilio",
  };
}

