export const openApiV1 = {
  openapi: "3.0.3",
  info: {
    title: "Followup 3.0 REST API",
    version: "1.0.0",
    description:
      "API REST per Followup 3.0 (CRM multi-progetto). Gestione clienti, appartamenti, trattative (rent/sell), calendario, workspaces, progetti, audit e report. Autenticazione JWT (login, refresh). In locale il backend è su porta 8080."
  },
  servers: [
    { url: "http://localhost:8080/v1", description: "Backend locale (dev)" },
    { url: "/v1", description: "Stesso host (proxy)" }
  ],
  tags: [
    { name: "health", description: "Stato del servizio" },
    { name: "auth", description: "Login, refresh, logout, SSO, reset password, invito" },
    { name: "users", description: "Utenti e inviti (RBAC)" },
    { name: "session", description: "Progetti per email, preferenze utente" },
    { name: "clients", description: "Clienti (query, CRUD, azioni)" },
    { name: "apartments", description: "Appartamenti e listing" },
    { name: "requests", description: "Trattative rent/sell, transizioni, azioni" },
    { name: "calendar", description: "Eventi calendario" },
    { name: "workspaces", description: "Workspace e progetti associati" },
    { name: "projects", description: "Configurazione progetti (policies, email, PDF)" },
    { name: "audit", description: "Log audit e eventi per entità" },
    { name: "reports", description: "Report pipeline, clienti, appartamenti" },
    { name: "Riusabili", description: "API per uso esterno (listings, integrazioni)" },
    { name: "hc", description: "Home Config (appartamenti HC)" },
    { name: "associations", description: "Associazioni appartamento-cliente" },
    { name: "workflows", description: "Complete flow preview/execute" },
    { name: "hc-master", description: "Entità master HC" },
    { name: "templates", description: "Template configurazione progetto" },
    { name: "ai", description: "Suggerimenti AI e action drafts" }
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
        summary: "Login con email e password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "user@example.com" },
                  password: { type: "string", format: "password" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Restituisce accessToken, refreshToken, user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                        role: { type: "string" },
                        isAdmin: { type: "boolean" },
                        permissions: { type: "array", items: { type: "string" } },
                        projectId: { type: "string", nullable: true }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": { description: "Credenziali non valide" }
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
    "/auth/request-password-reset": {
      post: {
        tags: ["auth"],
        operationId: "requestPasswordReset",
        summary: "Richiedi email di reset password (risposta generica anche se email assente)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } }
            }
          }
        },
        responses: { "200": { description: "{ ok: true }" }, "400": { description: "Validazione" } }
      }
    },
    "/auth/reset-password": {
      post: {
        tags: ["auth"],
        operationId: "resetPassword",
        summary: "Reimposta password con token da email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: { token: { type: "string" }, password: { type: "string", minLength: 8 } }
              }
            }
          }
        },
        responses: { "200": { description: "{ ok: true }" }, "400": { description: "Token non valido" } }
      }
    },
    "/auth/set-password-from-invite": {
      post: {
        tags: ["auth"],
        operationId: "setPasswordFromInvite",
        summary: "Attiva account da link invito",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: { token: { type: "string" }, password: { type: "string", minLength: 8 } }
              }
            }
          }
        },
        responses: {
          "200": { description: "accessToken, refreshToken, user (come login)" },
          "400": { description: "Token non valido" }
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
        operationId: "getAuthMe",
        summary: "Utente corrente da JWT",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "id, email, role, isAdmin, permissions, projectId",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string", nullable: true },
                    isAdmin: { type: "boolean" },
                    permissions: { type: "array", items: { type: "string" } },
                    projectId: { type: "string", nullable: true }
                  }
                }
              }
            }
          },
          "401": { description: "Missing or invalid token" }
        }
      }
    },
    "/users": {
      get: {
        tags: ["users"],
        operationId: "listUsersWithVisibility",
        summary: "Lista utenti e visibilità (permesso users.read)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "{ users: [...] }" }, "401": {}, "403": {} }
      },
      post: {
        tags: ["users"],
        operationId: "inviteUser",
        summary: "Invita utente (email + ruolo + progetto)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "role", "projectId"],
                properties: {
                  email: { type: "string", format: "email" },
                  role: { type: "string" },
                  projectId: { type: "string" },
                  projectName: { type: "string" },
                  appPublicUrl: {
                    type: "string",
                    format: "uri",
                    description: "Base URL FE per link invito; se omesso si usa Origin o APP_PUBLIC_URL"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "{ userId }" },
          "403": {},
          "409": { description: "Email già registrata" },
          "502": { description: "Invio email fallito" },
          "503": { description: "SMTP non configurato" }
        }
      }
    },
    "/users/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      patch: {
        tags: ["users"],
        operationId: "patchUser",
        summary: "Aggiorna utente (users.update)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  status: { type: "string", enum: ["invited", "active", "disabled"] },
                  permissions_override: { type: "array", items: { type: "string" } },
                  isDisabled: { type: "boolean" }
                }
              }
            }
          }
        },
        responses: { "200": {}, "404": {} }
      },
      delete: {
        tags: ["users"],
        operationId: "deleteUser",
        summary: "Elimina utente da tz_users (users.delete)",
        security: [{ bearerAuth: [] }],
        responses: { "200": {}, "404": {} }
      }
    },
    "/admin/email-flows": {
      get: {
        tags: ["admin"],
        operationId: "listEmailFlows",
        summary: "Template email transazionali (email_flows.manage)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista flussi" }, "403": {} }
      }
    },
    "/admin/email-flows/{flowKey}": {
      parameters: [{ name: "flowKey", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["admin"],
        operationId: "getEmailFlow",
        summary: "Dettaglio flusso email",
        security: [{ bearerAuth: [] }],
        responses: { "200": {}, "403": {}, "404": {} }
      },
      put: {
        tags: ["admin"],
        operationId: "putEmailFlow",
        summary: "Salva template: editorMode html (bodyHtml) o blocks (layout → HTML sanitizzato)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    required: ["enabled", "subject", "editorMode", "bodyHtml"],
                    properties: {
                      enabled: { type: "boolean" },
                      subject: { type: "string" },
                      editorMode: { type: "string", enum: ["html"] },
                      bodyHtml: { type: "string" }
                    }
                  },
                  {
                    type: "object",
                    required: ["enabled", "subject", "editorMode", "layout"],
                    properties: {
                      enabled: { type: "boolean" },
                      subject: { type: "string" },
                      editorMode: { type: "string", enum: ["blocks"] },
                      layout: { type: "object" }
                    }
                  }
                ]
              }
            }
          }
        },
        responses: { "200": {}, "400": {}, "403": {} }
      }
    },
    "/admin/email-flows/upload-asset": {
      post: {
        tags: ["admin"],
        summary: "Upload immagine per email (multipart field: file); richiede EMAIL_FLOW_S3_BUCKET",
        security: [{ bearerAuth: [] }],
        responses: { "200": {}, "400": {}, "403": {} }
      }
    },
    "/admin/email-flows/{flowKey}/suggested": {
      parameters: [{ name: "flowKey", in: "path", required: true, schema: { type: "string" } }],
      get: {
        tags: ["admin"],
        summary: "Template HTML suggerito con placeholder",
        security: [{ bearerAuth: [] }],
        responses: { "200": {}, "403": {} }
      }
    },
    "/admin/email-flows/{flowKey}/preview": {
      parameters: [{ name: "flowKey", in: "path", required: true, schema: { type: "string" } }],
      post: {
        tags: ["admin"],
        summary: "Anteprima con variabili di esempio",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subject"],
                properties: {
                  subject: { type: "string" },
                  bodyHtml: { type: "string" },
                  layout: { type: "object" },
                  sampleVars: { type: "object", additionalProperties: { type: "string" } }
                }
              }
            }
          }
        },
        responses: { "200": {}, "403": {} }
      }
    },
    "/session/projects-by-email": {
      post: {
        tags: ["session"],
        summary: "Risolvi progetti accessibili per email utente (opzionale workspaceId)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  workspaceId: { type: "string", description: "Se presente, filtra progetti del workspace" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Lista progetti e workspace associati",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    projects: { type: "array", items: { type: "object" } },
                    workspaces: { type: "array", items: { type: "object" } }
                  }
                }
              }
            }
          },
          "400": { description: "Errore validazione" },
          "500": { description: "Errore server" }
        }
      }
    },
    "/clients/query": {
      post: {
        tags: ["clients"],
        summary: "Query clienti paginata (workspaceId, projectIds, search, sort, filters)",
        security: [{ bearerAuth: [] }],
        requestBody: {
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
                  sort: { type: "object", properties: { field: { type: "string" }, direction: { type: "integer", enum: [1, -1] } } },
                  filters: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Lista clienti con paginazione",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/ClientRow" } },
                    pagination: { $ref: "#/components/schemas/Pagination" }
                  }
                }
              }
            }
          }
        }
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
        summary: "Query appartamenti paginata (workspaceId, projectIds, search, sort, filters)",
        security: [{ bearerAuth: [] }],
        requestBody: {
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
                  sort: { type: "object", properties: { field: { type: "string" }, direction: { type: "integer", enum: [1, -1] } } },
                  filters: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Lista appartamenti con paginazione",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/ApartmentRow" } },
                    pagination: { $ref: "#/components/schemas/Pagination" }
                  }
                }
              }
            }
          },
          "401": { description: "Token mancante o non valido" }
        }
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
    },
    "/openapi.json": {
      get: {
        tags: ["health"],
        summary: "Spec OpenAPI (JSON)",
        responses: { "200": { description: "Spec OpenAPI 3.0" } }
      }
    },
    "/calendar/events/query": {
      post: {
        tags: ["calendar"],
        summary: "Query eventi calendario (workspaceId, projectIds, date range)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista eventi" }, "401": { description: "Token mancante o non valido" } }
      }
    },
    "/calendar/events": {
      post: {
        tags: ["calendar"],
        summary: "Crea evento calendario",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "projectId", "title", "startsAt", "endsAt"],
                properties: {
                  workspaceId: { type: "string" },
                  projectId: { type: "string" },
                  title: { type: "string" },
                  startsAt: { type: "string", format: "date-time" },
                  endsAt: { type: "string", format: "date-time" },
                  source: { type: "string", enum: ["FOLLOWUP_SELL", "FOLLOWUP_RENT", "CUSTOM_SERVICE"] }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Evento creato" }, "401": { description: "Non autorizzato" } }
      }
    },
    "/calendar/events/{id}": {
      patch: {
        tags: ["calendar"],
        summary: "Aggiorna evento calendario",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Evento aggiornato" }, "404": { description: "Non trovato" } }
      },
      delete: {
        tags: ["calendar"],
        summary: "Elimina evento calendario",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Evento eliminato" }, "404": { description: "Non trovato" } }
      }
    },
    "/session/preferences": {
      get: {
        tags: ["session"],
        summary: "Preferenze utente (workspaceId, selectedProjectIds) per email",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "email", in: "query", required: true, schema: { type: "string" } },
          { name: "workspaceId", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": { description: "Preferenze trovate" }, "401": { description: "Non autorizzato" } }
      },
      post: {
        tags: ["session"],
        summary: "Salva preferenze utente",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "workspaceId", "selectedProjectIds"],
                properties: {
                  email: { type: "string" },
                  workspaceId: { type: "string" },
                  selectedProjectIds: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Preferenze salvate" } }
      }
    },
    "/workspaces": {
      get: {
        tags: ["workspaces"],
        summary: "Lista workspace (admin)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista workspace" } }
      },
      post: {
        tags: ["workspaces"],
        summary: "Crea workspace (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }
            }
          }
        },
        responses: { "200": { description: "Workspace creato" } }
      }
    },
    "/workspaces/{id}": {
      get: {
        tags: ["workspaces"],
        summary: "Dettaglio workspace",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Workspace" }, "404": { description: "Non trovato" } }
      },
      patch: {
        tags: ["workspaces"],
        summary: "Aggiorna workspace (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } } },
        responses: { "200": { description: "Workspace aggiornato" }, "404": { description: "Non trovato" } }
      },
      delete: {
        tags: ["workspaces"],
        summary: "Elimina workspace (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Workspace eliminato" }, "404": { description: "Non trovato" } }
      }
    },
    "/workspaces/{id}/projects": {
      get: {
        tags: ["workspaces"],
        summary: "Progetti associati al workspace",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Lista progetti del workspace" } }
      }
    },
    "/clients/{id}": {
      get: {
        tags: ["clients"],
        summary: "Dettaglio cliente",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Cliente" }, "404": { description: "Non trovato" } }
      },
      patch: {
        tags: ["clients"],
        summary: "Aggiorna cliente",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Cliente aggiornato" }, "404": { description: "Non trovato" } }
      }
    },
    "/clients": {
      post: {
        tags: ["clients"],
        summary: "Crea cliente",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "projectId", "fullName"],
                properties: {
                  workspaceId: { type: "string" },
                  projectId: { type: "string" },
                  fullName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  status: { type: "string" }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Cliente creato" } }
      }
    },
    "/requests/{id}/transitions": {
      get: {
        tags: ["requests"],
        summary: "Timeline transizioni di stato della trattativa",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Lista transizioni" }, "404": { description: "Trattativa non trovata" } }
      }
    },
    "/requests/{id}/status": {
      patch: {
        tags: ["requests"],
        summary: "Cambia stato trattativa (state machine)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: { status: { type: "string", enum: ["new", "contacted", "viewing", "quote", "offer", "won", "lost"] }, reason: { type: "string" } }
              }
            }
          }
        },
        responses: { "200": { description: "Stato aggiornato" }, "400": { description: "Transizione non consentita" } }
      }
    },
    "/requests/actions": {
      get: {
        tags: ["requests"],
        summary: "Lista azioni timeline (note, call, email) filtrate per workspace/requestId",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
          { name: "requestId", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": { description: "Lista azioni" } }
      },
      post: {
        tags: ["requests"],
        summary: "Crea azione timeline",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "requestIds", "type"],
                properties: {
                  workspaceId: { type: "string" },
                  requestIds: { type: "array", items: { type: "string" } },
                  type: { type: "string", enum: ["note", "call", "email", "meeting", "other"] },
                  title: { type: "string" },
                  description: { type: "string" }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Azione creata" } }
      }
    },
    "/audit/query": {
      post: {
        tags: ["audit"],
        summary: "Query log audit (workspaceId, filtri, paginazione)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista record audit" } }
      }
    },
    "/audit/entity/{entityType}/{entityId}": {
      get: {
        tags: ["audit"],
        summary: "Eventi audit per entità (cliente, appartamento, request)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "entityType", in: "path", required: true, schema: { type: "string", enum: ["client", "apartment", "request"] } },
          { name: "entityId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Lista eventi" } }
      }
    },
    "/workflow/config": {
      get: {
        tags: ["workflows"],
        summary: "Configurazione workflow (workspaceId, projectId, flowType query)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
          { name: "projectId", in: "query", required: true, schema: { type: "string" } },
          { name: "flowType", in: "query", schema: { type: "string", enum: ["sell", "rent"] } }
        ],
        responses: { "200": { description: "Config workflow" } }
      }
    },
    "/reports/{reportType}": {
      post: {
        tags: ["reports"],
        summary: "Genera report (pipeline, clients-by-status, apartments-by-availability)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "reportType", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  workspaceId: { type: "string" },
                  projectIds: { type: "array", items: { type: "string" } },
                  dateFrom: { type: "string" },
                  dateTo: { type: "string" }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Dati report" } }
      }
    },
    "/projects/{projectId}": {
      get: {
        tags: ["projects"],
        summary: "Dettaglio progetto (con workspaceId query)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string" } },
          { name: "workspaceId", in: "query", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Progetto" }, "404": { description: "Non trovato" } }
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
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          perPage: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" }
        }
      },
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
          quoteId: { type: "string", description: "Riferimento a tz_quotes" },
          quoteStatus: { type: "string" },
          quoteNumber: { type: "string" },
          quoteExpiryOn: { type: "string", format: "date-time" },
          quoteTotalPrice: { type: "number" }
        }
      },
      ClientRow: {
        type: "object",
        properties: {
          _id: { type: "string" },
          workspaceId: { type: "string" },
          projectId: { type: "string" },
          fullName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      ApartmentRow: {
        type: "object",
        properties: {
          _id: { type: "string" },
          workspaceId: { type: "string" },
          projectId: { type: "string" },
          code: { type: "string" },
          title: { type: "string" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      }
    }
  }
};
