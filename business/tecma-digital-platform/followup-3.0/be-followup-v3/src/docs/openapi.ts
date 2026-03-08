export const openApiV1 = {
  openapi: "3.0.3",
  info: {
    title: "Followup 3.0 REST API",
    version: "1.0.0",
    description: "Core REST API for Followup 3.0 (multi-project CRM)."
  },
  servers: [{ url: "/v1", description: "Local proxy" }],
  tags: [
    { name: "health" },
    { name: "Riusabili", description: "API per uso esterno (listings, integrazioni)" },
    { name: "auth" },
    { name: "session" },
    { name: "clients" },
    { name: "apartments" },
    { name: "hc" },
    { name: "associations" },
    { name: "workflows" },
    { name: "hc-master" },
    { name: "templates" },
    { name: "requests" },
    { name: "ai" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        summary: "Healthcheck",
        responses: { "200": { description: "Service healthy" } }
      }
    },
    "/auth/login": {
      post: {
        tags: ["auth"],
        summary: "Login with email and password",
        requestBody: { required: true },
        responses: {
          "200": { description: "Returns accessToken, refreshToken, user" },
          "401": { description: "Invalid credentials" }
        }
      }
    },
    "/auth/sso-exchange": {
      post: {
        tags: ["auth"],
        summary: "Exchange SSO JWT for access and refresh tokens",
        requestBody: { required: true },
        responses: {
          "200": { description: "Returns accessToken, refreshToken, user" },
          "401": { description: "Invalid SSO token or user not found" }
        }
      }
    },
    "/auth/refresh": {
      post: {
        tags: ["auth"],
        summary: "Refresh access token using refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } }
            }
          }
        },
        responses: {
          "200": { description: "Returns new accessToken and refreshToken" },
          "401": { description: "Invalid or expired refresh token" }
        }
      }
    },
    "/auth/logout": {
      post: {
        tags: ["auth"],
        summary: "Logout and invalidate refresh session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } }
            }
          }
        },
        responses: {
          "204": { description: "Session invalidated" },
          "400": { description: "Validation error" }
        }
      }
    },
    "/public/listings": {
      post: {
        tags: ["apartments", "Riusabili"],
        summary: "Public listings (no JWT). Rate limited by IP (60 req/min). Same contract as POST /apartments/query.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "projectIds"],
                properties: {
                  workspaceId: { type: "string" },
                  projectIds: { type: "array", items: { type: "string" } },
                  page: { type: "integer", minimum: 1, default: 1 },
                  perPage: { type: "integer", minimum: 1, maximum: 200, default: 25 },
                  searchText: { type: "string" },
                  sort: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      direction: { type: "integer", enum: [1, -1] }
                    }
                  },
                  filters: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Paginated apartments (listings)" },
          "400": { description: "Validation error" },
          "429": { description: "Rate limit exceeded" }
        }
      }
    },
    "/auth/me": {
      get: {
        tags: ["auth"],
        summary: "Get current user from JWT",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Current user" }, "401": { description: "Missing or invalid token" } }
      }
    },
    "/session/projects-by-email": {
      post: {
        tags: ["session"],
        summary: "Resolve projects by user email",
        requestBody: { required: true },
        responses: {
          "200": { description: "Project access resolved" },
          "400": { description: "Validation error" },
          "500": { description: "Server error" }
        }
      }
    },
    "/clients/query": {
      post: {
        tags: ["clients"],
        summary: "Paginated clients query",
        responses: { "200": { description: "Clients list" } }
      }
    },
    "/clients/lite/query": {
      post: {
        tags: ["clients", "Riusabili"],
        summary: "Light clients query for selectors (external integrations)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Light clients list" }, "401": { description: "Missing or invalid token" } }
      }
    },
    "/apartments/query": {
      post: {
        tags: ["apartments", "Riusabili"],
        summary: "Paginated apartments query (listings for external use)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Apartments list" }, "401": { description: "Missing or invalid token" } }
      }
    },
    "/requests/query": {
      post: {
        tags: ["requests"],
        summary: "Paginated requests/deals query (rent + sell unified)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "projectIds"],
                properties: {
                  workspaceId: { type: "string" },
                  projectIds: { type: "array", items: { type: "string" } },
                  page: { type: "integer", minimum: 1, default: 1 },
                  perPage: { type: "integer", minimum: 1, maximum: 200, default: 25 },
                  searchText: { type: "string" },
                  sort: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      direction: { type: "integer", enum: [1, -1] }
                    }
                  },
                  filters: {
                    type: "object",
                    properties: {
                      status: { type: "array", items: { type: "string" } },
                      type: { type: "array", items: { type: "string", enum: ["rent", "sell"] } }
                    }
                  }
                }
              }
            }
          }
        },
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Paginated list of requests",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "pagination"],
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RequestRow" }
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        perPage: { type: "integer" },
                        total: { type: "integer" },
                        totalPages: { type: "integer" }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": { description: "Validation error (invalid body)" },
          "401": { description: "Missing or invalid token" }
        }
      }
    },
    "/requests/{id}": {
      get: {
        tags: ["requests"],
        summary: "Get request/deal by id",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Request found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["request"],
                  properties: { request: { $ref: "#/components/schemas/RequestRow" } }
                }
              }
            }
          },
          "404": { description: "Request not found" },
          "401": { description: "Missing or invalid token" }
        }
      }
    },
    "/apartments": {
      post: {
        tags: ["apartments"],
        summary: "Create apartment",
        responses: {
          "200": { description: "Apartment created" },
          "409": { description: "Duplicate business conflict" }
        }
      }
    },
    "/apartments/{id}": {
      get: {
        tags: ["apartments"],
        summary: "Get apartment by id",
        responses: { "200": { description: "Apartment found" }, "404": { description: "Not found" } }
      },
      patch: {
        tags: ["apartments"],
        summary: "Update apartment by id",
        responses: { "200": { description: "Apartment updated" }, "404": { description: "Not found" } }
      }
    },
    "/hc/apartments": {
      post: {
        tags: ["hc"],
        summary: "Create or update HC apartment config",
        responses: { "200": { description: "HC config upserted" } }
      }
    },
    "/hc/apartments/query": {
      post: {
        tags: ["hc"],
        summary: "Paginated HC apartments query",
        responses: { "200": { description: "HC config list" } }
      }
    },
    "/hc/apartments/{apartmentId}": {
      get: {
        tags: ["hc"],
        summary: "Get HC config by apartment id",
        responses: { "200": { description: "HC config found" }, "404": { description: "Not found" } }
      },
      patch: {
        tags: ["hc"],
        summary: "Patch HC config by apartment id",
        responses: { "200": { description: "HC config updated" }, "404": { description: "Not found" } }
      }
    },
    "/associations/apartment-client": {
      post: {
        tags: ["associations"],
        summary: "Create apartment-client association",
        responses: {
          "200": { description: "Association created/updated" },
          "409": { description: "Conflict (apartment already linked or downgrade)" }
        }
      }
    },
    "/associations/query": {
      post: {
        tags: ["associations"],
        summary: "Paginated associations query",
        responses: { "200": { description: "Associations list" } }
      }
    },
    "/associations/{id}": {
      delete: {
        tags: ["associations"],
        summary: "Soft delete association",
        responses: { "200": { description: "Association deleted" }, "404": { description: "Not found" } }
      }
    },
    "/workflows/complete-flow/preview": {
      post: {
        tags: ["workflows"],
        summary: "Validate complete flow payload and preview execution",
        responses: { "200": { description: "Flow preview generated" } }
      }
    },
    "/workflows/complete-flow/execute": {
      post: {
        tags: ["workflows"],
        summary: "Execute complete flow",
        responses: { "200": { description: "Flow executed" } }
      }
    },
    "/hc-master/{entity}/query": {
      post: {
        tags: ["hc-master"],
        summary: "Paginated HC master query by entity",
        responses: { "200": { description: "HC master rows" } }
      }
    },
    "/hc-master/{entity}": {
      post: {
        tags: ["hc-master"],
        summary: "Create HC master entity row",
        responses: { "200": { description: "HC master row created" } }
      }
    },
    "/hc-master/{entity}/{id}": {
      patch: {
        tags: ["hc-master"],
        summary: "Update HC master entity row",
        responses: { "200": { description: "HC master row updated" } }
      },
      delete: {
        tags: ["hc-master"],
        summary: "Delete HC master entity row",
        responses: { "200": { description: "HC master row deleted" } }
      }
    },
    "/templates/configuration": {
      get: {
        tags: ["templates"],
        summary: "Get template configuration by projectId query param",
        responses: { "200": { description: "Template loaded" }, "404": { description: "Not found" } }
      }
    },
    "/templates/configuration/{projectId}": {
      put: {
        tags: ["templates"],
        summary: "Save template configuration by project",
        responses: { "200": { description: "Template saved" } }
      }
    },
    "/templates/configuration/{projectId}/validate": {
      post: {
        tags: ["templates"],
        summary: "Validate template payload",
        responses: { "200": { description: "Validation completed" } }
      }
    },
    "/ai/suggestions": {
      post: {
        tags: ["ai"],
        summary: "Generate AI suggestions (suggest-only)",
        responses: { "200": { description: "Suggestions generated" } }
      }
    },
    "/ai/approvals": {
      post: {
        tags: ["ai"],
        summary: "Approve or reject AI suggestion",
        responses: {
          "200": { description: "Decision recorded" },
          "404": { description: "Suggestion not found" }
        }
      }
    },
    "/ai/actions/drafts": {
      post: {
        tags: ["ai"],
        summary: "Create AI action draft (approval required)",
        responses: { "200": { description: "Draft created" } }
      }
    },
    "/ai/actions/drafts/query": {
      post: {
        tags: ["ai"],
        summary: "Query AI action drafts queue",
        responses: { "200": { description: "Drafts list" } }
      }
    },
    "/ai/actions/drafts/{id}/decision": {
      post: {
        tags: ["ai"],
        summary: "Approve or reject AI action draft",
        responses: {
          "200": { description: "Draft decision recorded and optionally executed" },
          "404": { description: "Draft not found" }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token from login or refresh"
      }
    },
    schemas: {
      RequestRow: {
        type: "object",
        required: ["_id", "projectId", "workspaceId", "clientId", "type", "status", "createdAt", "updatedAt"],
        properties: {
          _id: { type: "string" },
          projectId: { type: "string" },
          workspaceId: { type: "string" },
          clientId: { type: "string" },
          apartmentId: { type: "string", nullable: true },
          type: { type: "string", enum: ["rent", "sell"] },
          status: { type: "string", enum: ["new", "contacted", "viewing", "quote", "offer", "won", "lost"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          quoteId: { type: "string", description: "Riferimento a asset.quotes (legacy)" },
          quoteStatus: { type: "string" },
          quoteNumber: { type: "string" },
          quoteExpiryOn: { type: "string", format: "date-time" },
          quoteTotalPrice: { type: "number" }
        }
      }
    }
  }
};
