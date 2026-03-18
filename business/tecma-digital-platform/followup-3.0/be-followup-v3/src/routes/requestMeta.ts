import type { Request } from "express";

export function getClientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0]?.trim() ?? null;
  }
  return req.socket.remoteAddress ?? null;
}
