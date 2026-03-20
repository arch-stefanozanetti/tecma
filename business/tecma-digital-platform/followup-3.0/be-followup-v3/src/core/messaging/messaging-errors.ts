import type { MessagingErrorCode, ProviderError } from "./messaging.types.js";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function normalizeProviderError(err: unknown): { code: MessagingErrorCode; message: string } {
  const error = err as ProviderError | undefined;
  const status = toNumber(error?.status);
  const code = toNumber(error?.code);
  const message = error?.message || "Messaging provider error";

  if (status === 401 || status === 403) return { code: "AuthenticationFailed", message };
  if (status === 429 || code === 429 || code === 63038) return { code: "RateLimited", message };
  if (status === 400 || status === 404) return { code: "InvalidDestination", message };
  if (status !== undefined && status >= 500) return { code: "ProviderUnavailable", message };
  return { code: "UnknownFailure", message };
}

