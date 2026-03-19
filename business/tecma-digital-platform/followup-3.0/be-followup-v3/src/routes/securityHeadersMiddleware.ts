import type { Request, Response, NextFunction } from "express";

const ONE_YEAR_SECONDS = 31536000;

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
  );

  const forwardedProto = req.header("x-forwarded-proto");
  const isSecure = req.secure || (typeof forwardedProto === "string" && forwardedProto.includes("https"));
  if (isSecure) {
    res.setHeader("Strict-Transport-Security", `max-age=${ONE_YEAR_SECONDS}; includeSubDomains`);
  }

  next();
}
