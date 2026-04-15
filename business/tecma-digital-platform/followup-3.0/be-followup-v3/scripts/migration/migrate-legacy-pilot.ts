import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { MongoClient, ObjectId, type Document, type WithId } from "mongodb";

import { extractLegacyQuoteTotalPrice } from "../../src/core/quotes/legacy-quote-total.js";

type ProjectIdStrategy = "preserve_legacy_objectid_hex" | "map_to_new_id";

type MappingProject = {
  legacyProjectId: string;
  legacyProjectName?: string;
  targetProjectId?: string;
  enabled: boolean;
};

type MappingFile = {
  version: number;
  projectIdStrategy: ProjectIdStrategy;
  workspace: {
    workspaceName: string;
    targetWorkspaceId?: string;
    createIfMissing?: boolean;
  };
  projects: MappingProject[];
  notes?: string;
};

type PilotReport = {
  runId: string;
  dryRun: boolean;
  workspaceId: string;
  workspaceName: string;
  startedAt: string;
  endedAt?: string;
  source: {
    uriMasked: string;
    dbProject: string;
    dbClient: string;
    dbAsset: string;
    dbUser: string;
  };
  targetDb: string;
  mappedProjects: { legacyProjectId: string; targetProjectId: string; legacyProjectName?: string }[];
  counters: Record<string, number>;
  notes: string[];
};

const TARGET_DB_ALLOWED = "test-zanetti";
const DEFAULT_MAPPING_FILE = path.resolve(process.cwd(), "../docs/deliverables/legacy-project-workspace-mapping.json");
const DEFAULT_REPORT_DIR = path.resolve(process.cwd(), "../docs/deliverables/reports");

function env(name: string, fallback?: string): string {
  const raw = process.env[name] ?? fallback;
  if (raw == null || String(raw).trim() === "") {
    throw new Error(`Variabile ${name} mancante`);
  }
  return String(raw).trim();
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function maskUri(uri: string): string {
  return uri.replace(/:\/\/(.+?)@/, "://***:***@");
}

function nowIso(): string {
  return new Date().toISOString();
}

function toHexId(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value).toHexString();
  if (typeof value === "string") return value;
  return String(value ?? "");
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function mapLegacyRole(rawRole: unknown): string {
  const role = String(rawRole ?? "").trim().toLowerCase();
  if (!role) return "viewer";
  if (["admin", "account_manager", "configuration_manager"].includes(role)) return "admin";
  if (["vendor_manager", "front_office", "building_manager"].includes(role)) return "collaborator";
  if (["vendor", "user"].includes(role)) return "viewer";
  return "viewer";
}

function mapApartmentStatus(doc: Record<string, unknown>): "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED" {
  const raw = String(doc.status ?? "").toLowerCase();
  const availability = doc.availability as Record<string, unknown> | undefined;
  const av = String(availability?.value ?? "").toLowerCase();
  if (raw.includes("sold") || av.includes("sold")) return "SOLD";
  if (raw.includes("rent") || av.includes("rent")) return "RENTED";
  if (raw.includes("reserv") || av.includes("reserv")) return "RESERVED";
  return "AVAILABLE";
}

function mapRequestStatus(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "new";
  if (["init"].includes(v)) return "new";
  if (["ok", "application_completed", "accepted", "rented", "rent_completed"].includes(v)) return "won";
  if (["cancellato", "cancelled", "declined", "invalid", "invalido"].includes(v)) return "lost";
  if (v.includes("expired") || v.includes("suspended")) return "quote";
  return "contacted";
}

function envToLegacyBucket(appEnvRaw: string | undefined): string {
  const appEnv = String(appEnvRaw ?? "").trim().toLowerCase();
  return appEnv === "prod" ? "tecma-assets-prod" : "tecma-assets-coll";
}

function buildLegacyPlanimetryUrl(params: {
  appEnvRaw: string | undefined;
  projectDisplayName: string;
  apartmentName: string;
}): string {
  const bucket = envToLegacyBucket(params.appEnvRaw);
  const projectPath = encodeURIComponent(params.projectDisplayName.trim().replace(/\s+/g, " "));
  const apartmentFile = encodeURIComponent(`${params.apartmentName.trim().replace(/\s+/g, " ")}.png`);
  return `https://objectstorage.eu-frankfurt-1.oraclecloud.com/n/fronf8xprl08/b/${bucket}/o/initiatives/${projectPath}/floorplanning/img/planimetrie/${apartmentFile}`;
}

function isClientAllowedByGdpr(doc: Record<string, unknown>, mode: string): boolean {
  if (mode === "all") return true;
  const trattamento = doc.trattamento === true;
  const profilazione = doc.profilazione === true;
  const marketing = doc.marketing === true;
  const privacyInfo = typeof doc.privacyInformation === "object" && doc.privacyInformation != null;
  if (mode === "require_trattamento") return trattamento;
  return trattamento || profilazione || marketing || privacyInfo;
}

function loadMapping(filePath: string): MappingFile {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(text) as MappingFile;
  if (!Array.isArray(parsed.projects) || parsed.projects.length === 0) {
    throw new Error("Mapping senza progetti. Popola legacy-project-workspace-mapping.json");
  }
  return parsed;
}

async function ensureWorkspace(targetDb: ReturnType<MongoClient["db"]>, mapping: MappingFile, dryRun: boolean): Promise<{ workspaceId: string; workspaceName: string }> {
  const coll = targetDb.collection("tz_workspaces");
  const name = mapping.workspace.workspaceName || "Migration Pilot";
  const explicitId = (mapping.workspace.targetWorkspaceId ?? "").trim();
  if (explicitId) return { workspaceId: explicitId, workspaceName: name };

  const existing = await coll.findOne({ name });
  if (existing?._id) {
    return { workspaceId: toHexId(existing._id), workspaceName: name };
  }

  if (dryRun) {
    return { workspaceId: "DRY_RUN_WORKSPACE_ID", workspaceName: name };
  }

  const ts = nowIso();
  const insert = await coll.insertOne({ name, createdAt: ts, updatedAt: ts } as never);
  return { workspaceId: insert.insertedId.toHexString(), workspaceName: name };
}

async function upsertProject(
  sourceProject: WithId<Document>,
  targetDb: ReturnType<MongoClient["db"]>,
  workspaceId: string,
  targetProjectId: string,
  legacyProjectId: string,
  runId: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) return;
  const ts = nowIso();
  const projectsColl = targetDb.collection("tz_projects");
  const sourceAny = sourceProject as Record<string, unknown>;
  const legalNotes =
    typeof sourceAny.legalNotes === "string"
      ? sourceAny.legalNotes
      : typeof sourceAny.disclaimer === "string"
        ? sourceAny.disclaimer
        : undefined;
  const privacyPolicyUrl =
    typeof sourceAny.privacyPolicyUrl === "string"
      ? sourceAny.privacyPolicyUrl
      : typeof sourceAny.privacyUrl === "string"
        ? sourceAny.privacyUrl
        : undefined;
  const termsUrl =
    typeof sourceAny.termsUrl === "string"
      ? sourceAny.termsUrl
      : typeof sourceAny.termsAndConditionsUrl === "string"
        ? sourceAny.termsAndConditionsUrl
        : undefined;
  const policyContent =
    typeof sourceAny.policyContent === "string"
      ? sourceAny.policyContent
      : typeof sourceAny.privacyContent === "string"
        ? sourceAny.privacyContent
        : undefined;
  const branding = typeof sourceAny.branding === "object" && sourceAny.branding != null
    ? (sourceAny.branding as Record<string, unknown>)
    : undefined;
  await projectsColl.updateOne(
    { _id: targetProjectId } as never,
    {
      $set: {
        name: String(sourceProject.name ?? sourceProject.displayName ?? `Project ${legacyProjectId}`),
        displayName: String(sourceProject.displayName ?? sourceProject.name ?? `Project ${legacyProjectId}`),
        code: sourceProject.code ? String(sourceProject.code) : targetProjectId.slice(0, 8),
        mode: String(sourceProject.mode ?? "sell").toLowerCase() === "rent" ? "rent" : "sell",
        city: typeof sourceAny.city === "string" ? sourceAny.city : undefined,
        payoff: typeof sourceAny.payoff === "string" ? sourceAny.payoff : undefined,
        contactEmail:
          typeof sourceAny.contactEmail === "string"
            ? sourceAny.contactEmail
            : typeof sourceAny.email === "string"
              ? sourceAny.email
              : undefined,
        contactPhone:
          typeof sourceAny.contactPhone === "string"
            ? sourceAny.contactPhone
            : typeof sourceAny.phone === "string"
              ? sourceAny.phone
              : undefined,
        projectUrl:
          typeof sourceAny.projectUrl === "string"
            ? sourceAny.projectUrl
            : typeof sourceAny.website === "string"
              ? sourceAny.website
              : undefined,
        customDomain: typeof sourceAny.customDomain === "string" ? sourceAny.customDomain : undefined,
        defaultLang: typeof sourceAny.defaultLang === "string" ? sourceAny.defaultLang : undefined,
        hostKey: typeof sourceAny.hostKey === "string" ? sourceAny.hostKey : undefined,
        assetKey: typeof sourceAny.assetKey === "string" ? sourceAny.assetKey : undefined,
        feVendorKey: typeof sourceAny.feVendorKey === "string" ? sourceAny.feVendorKey : undefined,
        automaticQuoteEnabled: sourceAny.automaticQuoteEnabled === true,
        accountManagerEnabled: sourceAny.accountManagerEnabled === true,
        hasDAS: sourceAny.hasDAS === true,
        broker:
          sourceAny.broker === null || typeof sourceAny.broker === "string"
            ? sourceAny.broker
            : undefined,
        iban: typeof sourceAny.iban === "string" ? sourceAny.iban : undefined,
        archived: false,
        legacyPayload: {
          rawProject: sourceAny,
        },
        updatedAt: ts,
        migration: {
          legacySourceDb: "project",
          legacyCollection: "projects",
          legacyId: legacyProjectId,
          runId,
        },
      },
      $setOnInsert: {
        _id: targetProjectId,
        createdAt: ts,
      },
    } as never,
    { upsert: true }
  );

  await targetDb.collection("tz_workspace_projects").updateOne(
    { workspaceId, projectId: targetProjectId } as never,
    { $setOnInsert: { workspaceId, projectId: targetProjectId, createdAt: ts } as never },
    { upsert: true }
  );

  if (privacyPolicyUrl || termsUrl || policyContent || legalNotes) {
    await targetDb.collection("tz_project_policies").updateOne(
      { projectId: targetProjectId } as never,
      {
        $set: {
          projectId: targetProjectId,
          ...(privacyPolicyUrl && { privacyPolicyUrl }),
          ...(termsUrl && { termsUrl }),
          ...(policyContent && { content: policyContent }),
          ...(legalNotes && { legalNotes }),
          updatedAt: ts,
        } as never,
      },
      { upsert: true }
    );
  }

  const logoUrl = branding && typeof branding.logoUrl === "string" ? branding.logoUrl : undefined;
  const primaryColor = branding && typeof branding.primaryColor === "string" ? branding.primaryColor : undefined;
  const footerText = branding && typeof branding.footerText === "string" ? branding.footerText : undefined;
  if (logoUrl || primaryColor || footerText) {
    await targetDb.collection("tz_project_branding").updateOne(
      { projectId: targetProjectId } as never,
      {
        $set: {
          projectId: targetProjectId,
          ...(logoUrl && { logoUrl }),
          ...(primaryColor && { primaryColor }),
          ...(footerText && { footerText }),
          updatedAt: ts,
        } as never,
      },
      { upsert: true }
    );
  }
}

async function main(): Promise<void> {
  const targetUri = env("MONGO_URI");
  const targetDbName = env("MONGO_DB_NAME");
  if (targetDbName !== TARGET_DB_ALLOWED) {
    throw new Error(`Sicurezza: MONGO_DB_NAME deve essere ${TARGET_DB_ALLOWED}, ricevuto ${targetDbName}`);
  }

  const sourceUri = env("SOURCE_MONGO_URI", targetUri);
  const sourceProjectDbName = env("SOURCE_PROJECT_DB_NAME", "project");
  const sourceClientDbName = env("SOURCE_CLIENT_DB_NAME", "client");
  const sourceAssetDbName = env("SOURCE_ASSET_DB_NAME", "asset");
  const sourceUserDbName = env("SOURCE_USER_DB_NAME", "user");

  const mappingFile = env("LEGACY_PROJECT_MAPPING_FILE", DEFAULT_MAPPING_FILE);
  const reportDir = env("MIGRATION_REPORT_DIR", DEFAULT_REPORT_DIR);
  const runId = env("PILOT_RUN_ID", `legacy-pilot-${Date.now()}`);
  const dryRun = envBool("DRY_RUN", true);
  const gdprMode = env("GDPR_MODE", "require_any_consent").toLowerCase();

  const limitProjects = envNum("PROJECT_LIMIT", 20);
  const limitUsers = envNum("USER_LIMIT", 500);
  const limitClients = envNum("CLIENT_LIMIT", 3000);
  const limitApartments = envNum("APARTMENT_LIMIT", 3000);
  const limitQuotes = envNum("QUOTE_LIMIT", 1500);
  const limitRequests = envNum("REQUEST_LIMIT", 2500);

  const mapping = loadMapping(mappingFile);
  const mapped = mapping.projects.filter((p) => p.enabled);
  if (mapped.length === 0) {
    throw new Error("Nessun progetto abilitato nel mapping (enabled=true)");
  }

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  const report: PilotReport = {
    runId,
    dryRun,
    workspaceId: "",
    workspaceName: mapping.workspace.workspaceName || "Migration Pilot",
    startedAt: nowIso(),
    source: {
      uriMasked: maskUri(sourceUri),
      dbProject: sourceProjectDbName,
      dbClient: sourceClientDbName,
      dbAsset: sourceAssetDbName,
      dbUser: sourceUserDbName,
    },
    targetDb: targetDbName,
    mappedProjects: [],
    counters: {
      projectsScanned: 0,
      projectsUpserted: 0,
      usersScanned: 0,
      usersUpserted: 0,
      clientsScanned: 0,
      clientsSkippedGdpr: 0,
      clientsUpserted: 0,
      apartmentsScanned: 0,
      apartmentsUpserted: 0,
      quotesScanned: 0,
      quotesUpserted: 0,
      requestsScanned: 0,
      requestsUpserted: 0,
    },
    notes: [],
  };

  const legacyToTargetProjectId = new Map<string, string>();
  const legacyProjectDisplayName = new Map<string, string>();
  const legacyClientToTarget = new Map<string, string>();
  const legacyApartmentToTarget = new Map<string, string>();
  const legacyQuoteToTarget = new Map<string, string>();

  try {
    await Promise.all([sourceClient.connect(), targetClient.connect()]);

    const sourceProjectDb = sourceClient.db(sourceProjectDbName);
    const sourceClientDb = sourceClient.db(sourceClientDbName);
    const sourceAssetDb = sourceClient.db(sourceAssetDbName);
    const sourceUserDb = sourceClient.db(sourceUserDbName);
    const targetDb = targetClient.db(targetDbName);

    const workspace = await ensureWorkspace(targetDb, mapping, dryRun);
    report.workspaceId = workspace.workspaceId;
    report.workspaceName = workspace.workspaceName;

    const projectColl = sourceProjectDb.collection("projects");
    for (const row of mapped.slice(0, limitProjects)) {
      const legacyProjectId = row.legacyProjectId;
      const sourceProject = await projectColl.findOne({ _id: new ObjectId(legacyProjectId) } as never);
      report.counters.projectsScanned += 1;
      if (!sourceProject) {
        report.notes.push(`Project legacy non trovato: ${legacyProjectId}`);
        continue;
      }
      const targetProjectId =
        mapping.projectIdStrategy === "map_to_new_id"
          ? String(row.targetProjectId || "").trim()
          : (row.targetProjectId || legacyProjectId).trim();
      if (!targetProjectId) {
        report.notes.push(`targetProjectId mancante per ${legacyProjectId}`);
        continue;
      }
      legacyToTargetProjectId.set(legacyProjectId, targetProjectId);
      legacyProjectDisplayName.set(
        legacyProjectId,
        String(sourceProject.displayName ?? sourceProject.name ?? row.legacyProjectName ?? legacyProjectId)
      );
      report.mappedProjects.push({ legacyProjectId, targetProjectId, legacyProjectName: row.legacyProjectName });
      await upsertProject(sourceProject, targetDb, workspace.workspaceId, targetProjectId, legacyProjectId, runId, dryRun);
      report.counters.projectsUpserted += 1;
    }

    const legacyProjectIds = [...legacyToTargetProjectId.keys()].map((id) => new ObjectId(id));

    const usersColl = sourceUserDb.collection("users");
    const users = await usersColl
      .find({ project_ids: { $in: legacyProjectIds } } as never)
      .limit(limitUsers)
      .toArray();

    for (const u of users) {
      report.counters.usersScanned += 1;
      const email = normalizeEmail(u.email);
      if (!email) continue;
      const projectIdsRaw = Array.isArray(u.project_ids) ? u.project_ids : [];
      const targetProjects = projectIdsRaw
        .map((id) => legacyToTargetProjectId.get(toHexId(id)))
        .filter((x): x is string => Boolean(x));
      const ts = nowIso();
      const roleKey = mapLegacyRole(u.role);
      if (!dryRun) {
        const tzUser = await targetDb.collection("tz_users").findOneAndUpdate(
          { email } as never,
          {
            $set: {
              email,
              firstName: String(u.firstName ?? ""),
              lastName: String(u.lastName ?? ""),
              role: roleKey,
              legacyRole: String(u.role ?? ""),
              workspaceId: workspace.workspaceId,
              // Necessario per /session/projects-by-email sui non-admin (collection tz_users)
              project_ids: targetProjects,
              isDisabled: u.isDisabled === true,
              updatedAt: ts,
              migration: {
                legacySourceDb: sourceUserDbName,
                legacyCollection: "users",
                legacyId: toHexId(u._id),
                runId,
              },
            },
            $setOnInsert: { createdAt: ts },
          } as never,
          { upsert: true, returnDocument: "after" }
        );
        const userId = toHexId(tzUser?._id);
        await targetDb.collection("user").updateOne(
          { email } as never,
          {
            $set: {
              email,
              firstName: String(u.firstName ?? ""),
              lastName: String(u.lastName ?? ""),
              role: roleKey,
              workspaces: [{ workspaceId: workspace.workspaceId, role: roleKey }],
              // Necessario per /session/projects-by-email sui non-admin
              project_ids: targetProjects,
              updatedOn: ts,
            },
            $setOnInsert: { createdOn: ts },
          } as never,
          { upsert: true }
        );
        await targetDb.collection("tz_user_workspaces").updateOne(
          { workspaceId: workspace.workspaceId, userId: email } as never,
          {
            $set: {
              role: roleKey,
              access_scope: "all",
              updatedAt: ts,
            },
            $setOnInsert: {
              workspaceId: workspace.workspaceId,
              userId: email,
              createdAt: ts,
            },
          } as never,
          { upsert: true }
        );
        for (const projectId of targetProjects) {
          await targetDb.collection("tz_workspace_user_projects").updateOne(
            { workspaceId: workspace.workspaceId, userId, projectId } as never,
            { $setOnInsert: { workspaceId: workspace.workspaceId, userId, projectId, createdAt: ts } as never },
            { upsert: true }
          );
        }
      }
      report.counters.usersUpserted += 1;
    }

    const clientsColl = sourceClientDb.collection("clients");
    const clients = await clientsColl
      .find({ project_id: { $in: legacyProjectIds } } as never)
      .limit(limitClients)
      .toArray();

    for (const c of clients) {
      report.counters.clientsScanned += 1;
      if (!isClientAllowedByGdpr(c as Record<string, unknown>, gdprMode)) {
        report.counters.clientsSkippedGdpr += 1;
        continue;
      }
      const legacyProjectId = toHexId(c.project_id);
      const projectId = legacyToTargetProjectId.get(legacyProjectId);
      if (!projectId) continue;

      const ts = nowIso();
      const legacyId = toHexId(c._id);
      const email = normalizeEmail(c.email);
      const firstName = String(c.firstName ?? c.name ?? c.fullName ?? "").trim() || "N/A";
      const lastName = String(c.lastName ?? "").trim();

      if (!dryRun) {
        const result = await targetDb.collection("tz_clients").findOneAndUpdate(
          {
            workspaceId: workspace.workspaceId,
            "migration.legacySourceDb": sourceClientDbName,
            "migration.legacyCollection": "clients",
            "migration.legacyId": legacyId,
          } as never,
          {
            $set: {
              workspaceId: workspace.workspaceId,
              projectId,
              firstName,
              lastName,
              fullName: [firstName, lastName].filter(Boolean).join(" "),
              email: email || undefined,
              phone: String(c.tel ?? "").trim() || undefined,
              city: String(c.city ?? "").trim() || undefined,
              status: String(c.status ?? "lead").toLowerCase(),
              extraInfo: {
                coniuge: c.coniuge ?? null,
                family: c.family ?? null,
                additionalInfo: c.additionalInfo ?? null,
                privacyInformation: c.privacyInformation ?? null,
                legacyFlags: {
                  trattamento: c.trattamento === true,
                  profilazione: c.profilazione === true,
                  marketing: c.marketing === true,
                },
              },
              updatedAt: ts,
              migration: {
                legacySourceDb: sourceClientDbName,
                legacyCollection: "clients",
                legacyId,
                runId,
              },
            },
            $setOnInsert: { createdAt: ts },
          } as never,
          { upsert: true, returnDocument: "after" }
        );
        const targetId = toHexId(result?._id ?? legacyId);
        legacyClientToTarget.set(legacyId, targetId);
      } else {
        legacyClientToTarget.set(legacyId, `DRY_CLIENT_${legacyId}`);
      }
      report.counters.clientsUpserted += 1;
    }

    const apartmentsColl = sourceAssetDb.collection("apartments_view");
    const apartments = await apartmentsColl
      .find({ project_id: { $in: legacyProjectIds } } as never)
      .limit(limitApartments)
      .toArray();

    for (const a of apartments) {
      report.counters.apartmentsScanned += 1;
      const legacyProjectId = toHexId(a.project_id);
      const projectId = legacyToTargetProjectId.get(legacyProjectId);
      if (!projectId) continue;
      const legacyId = toHexId(a._id);
      const ts = nowIso();
      const mode = a.forRent === true ? "RENT" : "SELL";
      const price = Number(a.price ?? 0);
      const projectDisplayName = legacyProjectDisplayName.get(legacyProjectId) ?? legacyProjectId;
      const apartmentNameForPlan = String(a.name ?? a.code ?? `APT ${legacyId.slice(-6)}`);
      const planimetryUrl = buildLegacyPlanimetryUrl({
        appEnvRaw: process.env.APP_ENV,
        projectDisplayName,
        apartmentName: apartmentNameForPlan,
      });

      if (!dryRun) {
        const result = await targetDb.collection("tz_apartments").findOneAndUpdate(
          {
            workspaceId: workspace.workspaceId,
            "migration.legacySourceDb": sourceAssetDbName,
            "migration.legacyCollection": "apartments_view",
            "migration.legacyId": legacyId,
          } as never,
          {
            $set: {
              workspaceId: workspace.workspaceId,
              projectId,
              code: String(a.code ?? legacyId.slice(-6)),
              name: String(a.name ?? `APT ${legacyId.slice(-6)}`),
              status: mapApartmentStatus(a as Record<string, unknown>),
              mode,
              surfaceMq: Number(a?.plan?.surfaceArea?.apartment ?? 0),
              rawPrice: { mode, amount: Number.isFinite(price) ? price : 0 },
              floor: Number(a.floor ?? 0),
              planimetryUrl,
              extraInfo: a.extraInfo ?? {},
              legacyPayload: {
                plan: a.plan ?? null,
                typology: a.plan?.typology ?? null,
                availability: a.availability ?? null,
              },
              updatedAt: ts,
              migration: {
                legacySourceDb: sourceAssetDbName,
                legacyCollection: "apartments_view",
                legacyId,
                runId,
              },
            },
            $setOnInsert: { createdAt: ts },
          } as never,
          { upsert: true, returnDocument: "after" }
        );
        legacyApartmentToTarget.set(legacyId, toHexId(result?._id ?? legacyId));
      } else {
        legacyApartmentToTarget.set(legacyId, `DRY_APT_${legacyId}`);
      }
      report.counters.apartmentsUpserted += 1;
    }

    const quotesColl = sourceAssetDb.collection("quotes");
    const quotes = await quotesColl.find({ project_id: { $in: legacyProjectIds } } as never).limit(limitQuotes).toArray();

    for (const q of quotes) {
      report.counters.quotesScanned += 1;
      const legacyProjectId = toHexId(q.project_id);
      const projectId = legacyToTargetProjectId.get(legacyProjectId);
      if (!projectId) continue;
      const legacyId = toHexId(q._id);
      const ts = nowIso();
      const qRec = q as Record<string, unknown>;
      const totalPrice = extractLegacyQuoteTotalPrice(qRec);
      if (!dryRun) {
        const result = await targetDb.collection("tz_quotes").findOneAndUpdate(
          {
            workspaceId: workspace.workspaceId,
            "migration.legacySourceDb": sourceAssetDbName,
            "migration.legacyCollection": "quotes",
            "migration.legacyId": legacyId,
          } as never,
          {
            $set: {
              workspaceId: workspace.workspaceId,
              projectId,
              status: String(q.status ?? "draft"),
              quoteNumber: String(q.quoteNumber ?? `LQ-${legacyId.slice(-6)}`),
              expiryOn: q.expiryOn ?? null,
              customQuote: q.customQuote ?? null,
              legacyClientId: q.client ? toHexId(q.client) : null,
              legacyApartmentId: q.appartment ? toHexId(q.appartment) : null,
              ...(totalPrice !== undefined ? { totalPrice } : {}),
              updatedAt: ts,
              migration: {
                legacySourceDb: sourceAssetDbName,
                legacyCollection: "quotes",
                legacyId,
                runId,
              },
            },
            $setOnInsert: { createdAt: ts },
          } as never,
          { upsert: true, returnDocument: "after" }
        );
        legacyQuoteToTarget.set(legacyId, toHexId(result?._id ?? legacyId));
      } else {
        legacyQuoteToTarget.set(legacyId, `DRY_QUOTE_${legacyId}`);
      }
      report.counters.quotesUpserted += 1;
    }

    const requestsColl = sourceClientDb.collection("requests");
    const requests = await requestsColl
      .find({ project_id: { $in: legacyProjectIds } } as never)
      .limit(limitRequests)
      .toArray();

    for (const r of requests) {
      report.counters.requestsScanned += 1;
      const legacyProjectId = toHexId(r.project_id);
      const projectId = legacyToTargetProjectId.get(legacyProjectId);
      if (!projectId) continue;
      const legacyId = toHexId(r._id);
      const ts = nowIso();
      const legacyClientId = toHexId(r.client_id);
      const legacyApartmentId = toHexId(r.apartment_id ?? r.space_id);
      const legacyQuoteId = toHexId(r.quote_id);

      const clientId = legacyClientToTarget.get(legacyClientId);
      const apartmentId = legacyApartmentToTarget.get(legacyApartmentId);
      const quoteId = legacyQuoteToTarget.get(legacyQuoteId);

      if (!dryRun) {
        await targetDb.collection("tz_requests").updateOne(
          {
            workspaceId: workspace.workspaceId,
            "migration.legacySourceDb": sourceClientDbName,
            "migration.legacyCollection": "requests",
            "migration.legacyId": legacyId,
          } as never,
          {
            $set: {
              workspaceId: workspace.workspaceId,
              projectId,
              clientId,
              apartmentId,
              quoteId,
              status: mapRequestStatus(r.status ?? r.requestStatus),
              requestType: String(r.spaceType ?? "SELL").toUpperCase() === "RENT" ? "RENT" : "SELL",
              title: String(r.name ?? "Trattativa migrata"),
              amount: Number(r.priceTotal ?? r.price ?? 0),
              updatedAt: ts,
              migration: {
                legacySourceDb: sourceClientDbName,
                legacyCollection: "requests",
                legacyId,
                runId,
                legacyStatus: r.status ?? null,
              },
            },
            $setOnInsert: { createdAt: ts },
          } as never,
          { upsert: true }
        );
      }

      report.counters.requestsUpserted += 1;
    }

    report.endedAt = nowIso();
    fs.mkdirSync(reportDir, { recursive: true });
    const jsonPath = path.join(reportDir, `${runId}.json`);
    const mdPath = path.join(reportDir, `${runId}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    const md = [
      `# Legacy pilot migration report`,
      ``,
      `- Run: \`${report.runId}\``,
      `- Dry-run: \`${report.dryRun}\``,
      `- Workspace: \`${report.workspaceName}\` (\`${report.workspaceId}\`)`,
      `- Source: \`${report.source.uriMasked}\``,
      `- Target DB: \`${report.targetDb}\``,
      ``,
      `## Counters`,
      ``,
      ...Object.entries(report.counters).map(([k, v]) => `- ${k}: ${v}`),
      ``,
      `## Projects`,
      ``,
      ...report.mappedProjects.map((p) => `- ${p.legacyProjectId} -> ${p.targetProjectId}${p.legacyProjectName ? ` (${p.legacyProjectName})` : ""}`),
      ``,
      `## Notes`,
      ``,
      ...(report.notes.length ? report.notes.map((n) => `- ${n}`) : ["- none"]),
      ``,
    ].join("\n");
    fs.writeFileSync(mdPath, md);

    // eslint-disable-next-line no-console
    console.log(`[migrate:legacy-pilot] done runId=${runId} dryRun=${dryRun}`);
    // eslint-disable-next-line no-console
    console.log(`[migrate:legacy-pilot] report json=${jsonPath}`);
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[migrate:legacy-pilot] failed", err);
  process.exit(1);
});
