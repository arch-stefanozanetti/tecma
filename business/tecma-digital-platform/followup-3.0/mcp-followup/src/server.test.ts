import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./server.js";

describe("mcp-followup", () => {
  it("GET /health returns ok and service name", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: "mcp-followup" });
  });

  it("GET /tools without x-api-key returns 403", async () => {
    const res = await request(app).get("/tools");
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /tools with valid x-api-key returns tools list", async () => {
    const res = await request(app).get("/tools").set("x-api-key", "change-me");
    expect(res.status).toBe(200);
    expect(res.body.tools).toEqual([
      "search_clients",
      "search_apartments",
      "list_associations",
      "generate_workspace_report"
    ]);
  });

  it("POST /tools/search_clients with invalid body returns 400", async () => {
    const res = await request(app)
      .post("/tools/search_clients")
      .set("x-api-key", "change-me")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
