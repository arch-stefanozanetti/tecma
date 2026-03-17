import { Router } from "express";
import { queryApartments } from "../../core/apartments/apartments.service.js";
import {
  loginWithCredentials,
  exchangeSsoJwt,
  refreshAccessToken,
  logoutWithRefreshToken,
} from "../../core/auth/auth.service.js";
import { exchangeCodeForTokens } from "../../core/connectors/outlook.service.js";
import { openApiV1 } from "../../docs/openapi.js";
import { HttpError } from "../../types/http.js";
import { handleAsync, sendError } from "../asyncHandler.js";
import { authRateLimiter, publicApiRateLimiter } from "../rateLimitMiddleware.js";

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Followup 3.0 API - Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/v1/openapi.json",
        dom_id: "#swagger-ui",
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
`;

export const publicRoutes = Router();

publicRoutes.get("/health", (_req, res) => {
  res.json({ ok: true, service: "be-followup-v3" });
});

publicRoutes.get("/openapi.json", (_req, res) => {
  res.json(openApiV1);
});

publicRoutes.get("/docs", (_req, res) => {
  res.type("html").send(SWAGGER_UI_HTML);
});

publicRoutes.post("/auth/login", authRateLimiter, handleAsync((req) => loginWithCredentials(req.body)));
publicRoutes.post("/auth/sso-exchange", authRateLimiter, handleAsync((req) => exchangeSsoJwt(req.body)));
publicRoutes.post("/auth/refresh", handleAsync((req) => refreshAccessToken(req.body)));
publicRoutes.post("/auth/logout", (req, res) => {
  logoutWithRefreshToken(req.body)
    .then(() => res.status(204).end())
    .catch((err) => sendError(res, err));
});

publicRoutes.post("/public/listings", publicApiRateLimiter, handleAsync((req) => queryApartments(req.body)));
publicRoutes.get("/public/listings", publicApiRateLimiter, handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectIdsRaw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
  const projectIds = projectIdsRaw ? projectIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!workspaceId || projectIds.length === 0) throw new HttpError("workspaceId and projectIds (comma-separated) query params required", 400);
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : 25;
  const searchText = typeof req.query.searchText === "string" ? req.query.searchText : undefined;
  const body = {
    workspaceId,
    projectIds,
    page: Number.isNaN(page) ? 1 : page,
    perPage: Number.isNaN(perPage) ? 25 : Math.min(200, perPage),
    ...(searchText !== undefined && searchText !== "" && { searchText }),
  };
  return queryApartments(body);
}));

publicRoutes.get("/connectors/outlook/callback", (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const base = (process.env.OUTLOOK_FRONTEND_REDIRECT_BASE ?? "").replace(/\/$/, "");
  const toPath = (q: string) => (base ? `${base}/integrations?tab=connettori&outlook=${q}` : `/integrations?tab=connettori&outlook=${q}`);
  if (!code || !stateRaw) {
    res.redirect(302, toPath("error"));
    return;
  }
  let state: { userId: string; workspaceId?: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as { userId: string; workspaceId?: string };
  } catch {
    res.redirect(302, toPath("error"));
    return;
  }
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI ?? "";
  exchangeCodeForTokens(code, redirectUri, state)
    .then(() => res.redirect(302, toPath("connected")))
    .catch(() => res.redirect(302, toPath("error")));
});
