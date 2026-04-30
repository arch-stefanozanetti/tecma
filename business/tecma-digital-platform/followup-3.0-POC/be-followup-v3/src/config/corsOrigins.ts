import { z } from "zod";

const CorsOriginSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  }, "CORS_ORIGINS accepts only https origins and http://localhost|127.0.0.1 origins.");

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => CorsOriginSchema.parse(entry));
}
