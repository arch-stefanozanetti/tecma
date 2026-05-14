import { describe, it, expect } from "vitest";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../test/stableHttpServer.js";
import { registerRootPublicRoutes } from "./root-public.routes.js";
import { AIKIDO_DOMAIN_VERIFICATION_BODY } from "../config/aikido-domain-verification.js";

describe("registerRootPublicRoutes", () => {
  it("GET /aikido.txt risponde 200 con body di verifica Aikido", async () => {
    const app = express();
    registerRootPublicRoutes(app);
    const { server, origin } = await listenStable(app);
    try {
      const res = await stableRequest(origin).get("/aikido.txt");
      expect(res.status).toBe(200);
      expect(res.text).toBe(AIKIDO_DOMAIN_VERIFICATION_BODY);
      expect(String(res.headers["content-type"])).toMatch(/text\/plain/);
    } finally {
      await closeStable(server);
    }
  });
});
