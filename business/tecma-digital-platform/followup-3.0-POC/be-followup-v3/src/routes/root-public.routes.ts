import type { Express } from "express";
import { AIKIDO_DOMAIN_VERIFICATION_BODY } from "../config/aikido-domain-verification.js";

/** Route pubbliche sulla root dell'host (non sotto `/v1`). */
export function registerRootPublicRoutes(app: Express): void {
  app.get("/aikido.txt", (_req, res) => {
    res.type("text/plain").send(AIKIDO_DOMAIN_VERIFICATION_BODY);
  });
}
