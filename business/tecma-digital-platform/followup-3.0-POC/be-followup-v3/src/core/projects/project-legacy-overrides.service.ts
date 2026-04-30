import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";
import {
  applyAdvancedPathOverrides,
  assertJsonSize,
  deepMergeRawProject,
  type AdvancedOverrideRow,
} from "./legacy-raw-project-merge.js";
import {
  buildTzPatchFromIdentityFields,
  tzProjectFilter,
} from "./project-canonical-sync.js";

const COLLECTION_PROJECT_LEGACY_OVERRIDES = "tz_project_legacy_overrides";
const COLLECTION_TZ_PROJECTS = "tz_projects";

const EnabledToolsSchema = z.object({
  quotations: z.boolean().optional(),
  appointments: z.boolean().optional(),
  floorPlans: z.boolean().optional(),
  docs: z.boolean().optional(),
  myHome: z.boolean().optional(),
});

const FloorPlanningSchema = z.object({
  flowDeskEnabled: z.boolean().optional(),
  flowWebEnabled: z.boolean().optional(),
  planInfoEnabled: z.boolean().optional(),
  showOnlyAvailable: z.boolean().optional(),
});

const NeurosalesSchema = z.object({
  enabled: z.boolean().optional(),
  dashboardEnabled: z.boolean().optional(),
  cardsEnabled: z.boolean().optional(),
  homePageEnabled: z.boolean().optional(),
});

const MyHomeSchema = z.object({
  enabled: z.boolean().optional(),
  documentAreaEnabled: z.boolean().optional(),
  proposalEnabled: z.boolean().optional(),
  reserveEnabled: z.boolean().optional(),
  onlinePaymentEnabled: z.boolean().optional(),
});

const AppointmentsSchema = z.object({
  bookingEnabled: z.boolean().optional(),
  openDaysEnabled: z.boolean().optional(),
  unavailablePeriodEnabled: z.boolean().optional(),
});

const PolicyFlagsSchema = z.object({
  gdprEnabled: z.boolean().optional(),
  marketingConsentEnabled: z.boolean().optional(),
  profilingConsentEnabled: z.boolean().optional(),
});

const JobsSchema = z.object({
  leaseExpiryReminderEnabled: z.boolean().optional(),
  reminderDaysBefore: z.number().int().min(0).max(365).optional(),
});

const AdvancedOverrideSchema = z.object({
  path: z.string().min(1).max(2000),
  valueType: z.enum(["string", "number", "boolean"]),
  stringValue: z.string().optional(),
  numberValue: z.number().optional(),
  booleanValue: z.boolean().optional(),
});

/** JSON annidato per configurazioni legacy (limite dimensione in assertJsonSize). */
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(500_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

const PageTitlesSchema = z.record(z.string().max(120), z.string().max(4000)).optional();

const LegacyToolEntrySchema = z
  .object({
    name: z.string().max(200).optional(),
    version: z.string().max(80).optional(),
    url: z.string().max(4000).optional(),
    baseUrl: z.string().max(2000).optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

const IdentityFieldsSchema = z
  .object({
    name: z.string().max(500).optional(),
    code: z.string().max(200).optional(),
    hostKey: z.string().max(500).optional(),
    assetKey: z.string().max(500).optional(),
    displayName: z.string().max(500).optional(),
    payoff: z.string().max(500).optional(),
    city: z.string().max(200).optional(),
    contactPhone: z.string().max(200).optional(),
    contactEmail: z.string().max(500).optional(),
    contactForm: z.string().max(2000).optional(),
    storeAddress: z.string().max(1000).optional(),
    customDomain: z.string().max(500).optional(),
    broker: z.string().max(100).optional(),
    area: z.enum(["sale", "rent"]).optional(),
    defaultLang: z.string().max(50).optional(),
    mailLanguages: z.array(z.string().max(50)).max(50).optional(),
    disabledLanguages: z.array(z.string().max(50)).max(50).optional(),
    accountManagerEnabled: z.boolean().optional(),
    automaticQuoteEnabled: z.boolean().optional(),
    googleRecaptchaSecret: z.string().max(500).optional(),
    hCaptchaSecret: z.string().max(500).optional(),
    AQcode: z.string().max(100).optional(),
    languages: z.array(z.string().max(50)).max(50).optional(),
  })
  .strict();

const LegacyOverridesPutSchema = z.object({
  enabledTools: EnabledToolsSchema.optional(),
  floorPlanning: FloorPlanningSchema.optional(),
  neurosales: NeurosalesSchema.optional(),
  myHome: MyHomeSchema.optional(),
  appointments: AppointmentsSchema.optional(),
  policyFlags: PolicyFlagsSchema.optional(),
  jobs: JobsSchema.optional(),
  advancedOverrides: z.array(AdvancedOverrideSchema).max(500).optional(),
  identityFields: IdentityFieldsSchema.optional(),
  pageTitles: PageTitlesSchema,
  manifestConfig: JsonValueSchema.optional(),
  myLivingConfig: JsonValueSchema.optional(),
  legacyEnabledTools: z.array(LegacyToolEntrySchema).max(200).optional(),
  rentAssetContext: JsonValueSchema.optional(),
  myhomeConfig: JsonValueSchema.optional(),
  jobsConfig: JsonValueSchema.optional(),
  followupConfig: JsonValueSchema.optional(),
  floorPlanningConfig: JsonValueSchema.optional(),
  neurosalesConfig: JsonValueSchema.optional(),
  legacyPolicyFlags: JsonValueSchema.optional(),
  businessPlatformConfig: JsonValueSchema.optional(),
  domainWhitelist: z.array(z.string().max(500)).max(500).optional(),
  projectFlags: JsonValueSchema.optional(),
  proposalTemplate: JsonValueSchema.optional(),
  iban: JsonValueSchema.optional(),
});

export type ProjectLegacyOverridesInput = z.infer<typeof LegacyOverridesPutSchema>;

export interface ProjectLegacyOverridesRow extends ProjectLegacyOverridesInput {
  projectId: string;
  updatedAt: string;
}

const mapSection = <T>(value: unknown): T | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  return value as T;
};

function buildRawProjectPatchFromInput(input: ProjectLegacyOverridesInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.identityFields) {
    const id = input.identityFields;
    const entries: [string, unknown][] = [
      ["name", id.name],
      ["code", id.code],
      ["hostKey", id.hostKey],
      ["assetKey", id.assetKey],
      ["displayName", id.displayName],
      ["payoff", id.payoff],
      ["city", id.city],
      ["contactPhone", id.contactPhone],
      ["contactEmail", id.contactEmail],
      ["contactForm", id.contactForm],
      ["storeAddress", id.storeAddress],
      ["customDomain", id.customDomain],
      ["broker", id.broker],
      ["area", id.area],
      ["defaultLang", id.defaultLang],
      ["mailLanguages", id.mailLanguages],
      ["disabledLanguages", id.disabledLanguages],
      ["accountManagerEnabled", id.accountManagerEnabled],
      ["automaticQuoteEnabled", id.automaticQuoteEnabled],
      ["googleRecaptchaSecret", id.googleRecaptchaSecret],
      ["hCaptchaSecret", id.hCaptchaSecret],
      ["AQcode", id.AQcode],
      ["languages", id.languages],
    ];
    for (const [k, v] of entries) {
      if (v !== undefined) patch[k] = v;
    }
  }

  if (input.pageTitles !== undefined) patch.pageTitles = input.pageTitles;
  if (input.manifestConfig !== undefined) patch.manifestConfig = input.manifestConfig;
  if (input.myLivingConfig !== undefined) patch.myLivingConfig = input.myLivingConfig;
  if (input.legacyEnabledTools !== undefined) patch.enabledTools = input.legacyEnabledTools;
  if (input.rentAssetContext !== undefined) patch.rentAssetContext = input.rentAssetContext;
  if (input.myhomeConfig !== undefined) patch.myhomeConfig = input.myhomeConfig;
  if (input.jobsConfig !== undefined) patch.jobsConfig = input.jobsConfig;
  if (input.followupConfig !== undefined) patch.followupConfig = input.followupConfig;
  if (input.floorPlanningConfig !== undefined) patch.floorPlanningConfig = input.floorPlanningConfig;
  if (input.neurosalesConfig !== undefined) patch.neurosalesConfig = input.neurosalesConfig;
  if (input.legacyPolicyFlags !== undefined) patch.policyFlags = input.legacyPolicyFlags;
  if (input.businessPlatformConfig !== undefined) patch.businessPlatformConfig = input.businessPlatformConfig;
  if (input.domainWhitelist !== undefined) patch.domainWhitelist = input.domainWhitelist;
  if (input.projectFlags !== undefined) patch.projectFlags = input.projectFlags;
  if (input.proposalTemplate !== undefined) patch.proposalTemplate = input.proposalTemplate;
  if (input.iban !== undefined) patch.iban = input.iban;

  return patch;
}

function rowFromDoc(doc: Record<string, unknown>, projectId: string, updatedAt: string): ProjectLegacyOverridesRow {
  return {
    projectId,
    enabledTools: mapSection<ProjectLegacyOverridesInput["enabledTools"]>(doc.enabledTools),
    floorPlanning: mapSection<ProjectLegacyOverridesInput["floorPlanning"]>(doc.floorPlanning),
    neurosales: mapSection<ProjectLegacyOverridesInput["neurosales"]>(doc.neurosales),
    myHome: mapSection<ProjectLegacyOverridesInput["myHome"]>(doc.myHome),
    appointments: mapSection<ProjectLegacyOverridesInput["appointments"]>(doc.appointments),
    policyFlags: mapSection<ProjectLegacyOverridesInput["policyFlags"]>(doc.policyFlags),
    jobs: mapSection<ProjectLegacyOverridesInput["jobs"]>(doc.jobs),
    advancedOverrides: Array.isArray(doc.advancedOverrides)
      ? (doc.advancedOverrides as ProjectLegacyOverridesInput["advancedOverrides"])
      : undefined,
    identityFields: mapSection<ProjectLegacyOverridesInput["identityFields"]>(doc.identityFields),
    pageTitles: mapSection<ProjectLegacyOverridesInput["pageTitles"]>(doc.pageTitles),
    manifestConfig: doc.manifestConfig,
    myLivingConfig: doc.myLivingConfig,
    legacyEnabledTools: Array.isArray(doc.legacyEnabledTools)
      ? (doc.legacyEnabledTools as ProjectLegacyOverridesInput["legacyEnabledTools"])
      : undefined,
    rentAssetContext: doc.rentAssetContext,
    myhomeConfig: doc.myhomeConfig,
    jobsConfig: doc.jobsConfig,
    followupConfig: doc.followupConfig,
    floorPlanningConfig: doc.floorPlanningConfig,
    neurosalesConfig: doc.neurosalesConfig,
    legacyPolicyFlags: doc.legacyPolicyFlags,
    businessPlatformConfig: doc.businessPlatformConfig,
    domainWhitelist: Array.isArray(doc.domainWhitelist)
      ? (doc.domainWhitelist as string[])
      : undefined,
    projectFlags: doc.projectFlags,
    proposalTemplate: doc.proposalTemplate,
    iban: doc.iban,
    updatedAt,
  };
}

export const getProjectLegacyOverrides = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectLegacyOverridesRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const doc = await db
    .collection<Record<string, unknown>>(COLLECTION_PROJECT_LEGACY_OVERRIDES)
    .findOne({ projectId });
  const now = new Date().toISOString();
  if (!doc) return { projectId, updatedAt: now };
  return rowFromDoc(doc, projectId, toIsoDate(doc.updatedAt));
};

export const putProjectLegacyOverrides = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectLegacyOverridesRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = LegacyOverridesPutSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();

  const $set: Record<string, unknown> = {
    projectId,
    updatedAt: now,
  };
  const keys = [
    "enabledTools",
    "floorPlanning",
    "neurosales",
    "myHome",
    "appointments",
    "policyFlags",
    "jobs",
    "advancedOverrides",
    "identityFields",
    "pageTitles",
    "manifestConfig",
    "myLivingConfig",
    "legacyEnabledTools",
    "rentAssetContext",
    "myhomeConfig",
    "jobsConfig",
    "followupConfig",
    "floorPlanningConfig",
    "neurosalesConfig",
    "legacyPolicyFlags",
    "businessPlatformConfig",
    "domainWhitelist",
    "projectFlags",
    "proposalTemplate",
    "iban",
  ] as const;
  for (const k of keys) {
    if (input[k] !== undefined) $set[k] = input[k];
  }

  await db.collection(COLLECTION_PROJECT_LEGACY_OVERRIDES).updateOne(
    { projectId },
    { $set },
    { upsert: true }
  );

  const patch = buildRawProjectPatchFromInput(input);
  const adv = input.advancedOverrides as AdvancedOverrideRow[] | undefined;

  if (Object.keys(patch).length > 0 || (adv && adv.length > 0)) {
    const tzColl = db.collection<Record<string, unknown>>(COLLECTION_TZ_PROJECTS);
    const tzPatch = buildTzPatchFromIdentityFields(
      (input.identityFields as Record<string, unknown> | undefined) ?? undefined
    );
    const projDoc = await tzColl.findOne(tzProjectFilter(projectId));
    const legacyPayload =
      typeof projDoc?.legacyPayload === "object" && projDoc?.legacyPayload !== null
        ? (projDoc.legacyPayload as Record<string, unknown>)
        : {};
    const existingRaw =
      typeof legacyPayload.rawProject === "object" && legacyPayload.rawProject !== null
        ? (legacyPayload.rawProject as Record<string, unknown>)
        : {};

    let mergedRaw = Object.keys(patch).length > 0 ? deepMergeRawProject(existingRaw, patch) : { ...existingRaw };
    if (adv && adv.length > 0) {
      mergedRaw = applyAdvancedPathOverrides(mergedRaw, adv);
    }
    assertJsonSize(mergedRaw);

    const newLegacyPayload = {
      ...legacyPayload,
      rawProject: mergedRaw,
    };
    assertJsonSize(newLegacyPayload);

    await tzColl.updateOne(tzProjectFilter(projectId), {
      $set: {
        ...tzPatch,
        legacyPayload: newLegacyPayload,
        updatedAt: now,
      },
    });
  } else {
    const tzPatch = buildTzPatchFromIdentityFields(
      (input.identityFields as Record<string, unknown> | undefined) ?? undefined
    );
    if (Object.keys(tzPatch).length > 0) {
      await db.collection(COLLECTION_TZ_PROJECTS).updateOne(tzProjectFilter(projectId), {
        $set: { ...tzPatch, updatedAt: now },
      });
    }
  }

  return getProjectLegacyOverrides(projectId, workspaceId, isAdmin);
};
