/**
 * Stato locale per Configurazioni legacy: form semplificati + JSON per blocchi annidati.
 */

export type LegacyToolRow = {
  name: string;
  version: string;
  url: string;
  baseUrl: string;
  enabled: boolean;
};

export type LegacyOverridesDraft = {
  enabledTools: {
    quotations: boolean;
    appointments: boolean;
    floorPlans: boolean;
    docs: boolean;
    myHome: boolean;
  };
  floorPlanning: {
    flowDeskEnabled: boolean;
    flowWebEnabled: boolean;
    planInfoEnabled: boolean;
    showOnlyAvailable: boolean;
  };
  neurosales: {
    enabled: boolean;
    dashboardEnabled: boolean;
    cardsEnabled: boolean;
    homePageEnabled: boolean;
  };
  myHome: {
    enabled: boolean;
    documentAreaEnabled: boolean;
    proposalEnabled: boolean;
    reserveEnabled: boolean;
    onlinePaymentEnabled: boolean;
  };
  appointments: {
    bookingEnabled: boolean;
    openDaysEnabled: boolean;
    unavailablePeriodEnabled: boolean;
  };
  policyFlags: {
    gdprEnabled: boolean;
    marketingConsentEnabled: boolean;
    profilingConsentEnabled: boolean;
  };
  jobs: {
    leaseExpiryReminderEnabled: boolean;
    reminderDaysBefore: string;
  };
  advancedOverrides: Array<{
    path: string;
    valueType: "string" | "number" | "boolean";
    value: string;
  }>;
  identityFields: {
    name: string;
    code: string;
    hostKey: string;
    assetKey: string;
    displayName: string;
    payoff: string;
    city: string;
    contactPhone: string;
    contactEmail: string;
    contactForm: string;
    storeAddress: string;
    customDomain: string;
    broker: string;
    area: "" | "sale" | "rent";
    defaultLang: string;
    mailLanguages: string;
    disabledLanguages: string;
    accountManagerEnabled: boolean;
    automaticQuoteEnabled: boolean;
    googleRecaptchaSecret: string;
    hCaptchaSecret: string;
    AQcode: string;
    languages: string;
  };
  pageTitleRows: Array<{ key: string; value: string }>;
  legacyEnabledTools: LegacyToolRow[];
  manifestJson: string;
  myLivingJson: string;
  rentAssetJson: string;
  myhomeJson: string;
  jobsConfigJson: string;
  followupJson: string;
  floorPlanningConfigJson: string;
  neurosalesJson: string;
  legacyPolicyFlagsJson: string;
  businessPlatformJson: string;
  domainWhitelist: string;
  projectFlagsJson: string;
  proposalTemplateJson: string;
  ibanJson: string;
};

const readLegacyBoolean = (
  rawProject: Record<string, unknown> | null | undefined,
  path: string[],
  fallback = false
): boolean => {
  let cursor: unknown = rawProject;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null) return fallback;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "boolean" ? cursor : fallback;
};

const readLegacyNumber = (rawProject: Record<string, unknown> | null | undefined, path: string[]): string => {
  let cursor: unknown = rawProject;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null) return "";
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "number" ? String(cursor) : "";
};

const str = (v: unknown): string => (typeof v === "string" ? v : v != null ? String(v) : "");

export function emptyLegacyOverridesDraft(): LegacyOverridesDraft {
  return {
    enabledTools: {
      quotations: false,
      appointments: false,
      floorPlans: false,
      docs: false,
      myHome: false,
    },
    floorPlanning: {
      flowDeskEnabled: false,
      flowWebEnabled: false,
      planInfoEnabled: false,
      showOnlyAvailable: false,
    },
    neurosales: {
      enabled: false,
      dashboardEnabled: false,
      cardsEnabled: false,
      homePageEnabled: false,
    },
    myHome: {
      enabled: false,
      documentAreaEnabled: false,
      proposalEnabled: false,
      reserveEnabled: false,
      onlinePaymentEnabled: false,
    },
    appointments: {
      bookingEnabled: false,
      openDaysEnabled: false,
      unavailablePeriodEnabled: false,
    },
    policyFlags: {
      gdprEnabled: false,
      marketingConsentEnabled: false,
      profilingConsentEnabled: false,
    },
    jobs: {
      leaseExpiryReminderEnabled: false,
      reminderDaysBefore: "",
    },
    advancedOverrides: [],
    identityFields: {
      name: "",
      code: "",
      hostKey: "",
      assetKey: "",
      displayName: "",
      payoff: "",
      city: "",
      contactPhone: "",
      contactEmail: "",
      contactForm: "",
      storeAddress: "",
      customDomain: "",
      broker: "",
      area: "",
      defaultLang: "it-IT",
      mailLanguages: "",
      disabledLanguages: "",
      accountManagerEnabled: false,
      automaticQuoteEnabled: false,
      googleRecaptchaSecret: "",
      hCaptchaSecret: "",
      AQcode: "",
      languages: "",
    },
    pageTitleRows: [],
    legacyEnabledTools: [],
    manifestJson: "",
    myLivingJson: "",
    rentAssetJson: "",
    myhomeJson: "",
    jobsConfigJson: "",
    followupJson: "",
    floorPlanningConfigJson: "",
    neurosalesJson: "",
    legacyPolicyFlagsJson: "",
    businessPlatformJson: "",
    domainWhitelist: "",
    projectFlagsJson: "",
    proposalTemplateJson: "",
    ibanJson: "",
  };
}

function pageTitlesToRows(raw: unknown): Array<{ key: string; value: string }> {
  if (typeof raw !== "object" || raw === null) return [];
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

function toolsFromRaw(raw: unknown): LegacyToolRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const o = typeof t === "object" && t !== null ? (t as Record<string, unknown>) : {};
    return {
      name: str(o.name),
      version: str(o.version),
      url: str(o.url),
      baseUrl: str(o.baseUrl),
      enabled: typeof o.enabled === "boolean" ? o.enabled : false,
    };
  });
}

function safeStringifyJson(label: string, value: unknown): string {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return `/* errore serializzazione ${label} */`;
  }
}

export type LegacyOverridesApiRow = {
  enabledTools?: LegacyOverridesDraft["enabledTools"];
  floorPlanning?: LegacyOverridesDraft["floorPlanning"];
  neurosales?: LegacyOverridesDraft["neurosales"];
  myHome?: LegacyOverridesDraft["myHome"];
  appointments?: LegacyOverridesDraft["appointments"];
  policyFlags?: LegacyOverridesDraft["policyFlags"];
  jobs?: { leaseExpiryReminderEnabled?: boolean; reminderDaysBefore?: number };
  advancedOverrides?: Array<{
    path: string;
    valueType: "string" | "number" | "boolean";
    stringValue?: string;
    numberValue?: number;
    booleanValue?: boolean;
  }>;
  identityFields?: Partial<LegacyOverridesDraft["identityFields"]> & { area?: "sale" | "rent" };
  pageTitles?: Record<string, string>;
  manifestConfig?: unknown;
  myLivingConfig?: unknown;
  legacyEnabledTools?: LegacyToolRow[];
  rentAssetContext?: unknown;
  myhomeConfig?: unknown;
  jobsConfig?: unknown;
  followupConfig?: unknown;
  floorPlanningConfig?: unknown;
  neurosalesConfig?: unknown;
  legacyPolicyFlags?: unknown;
  businessPlatformConfig?: unknown;
  domainWhitelist?: string[];
  projectFlags?: unknown;
  proposalTemplate?: unknown;
  iban?: unknown;
};

export function buildLegacyOverridesDraftFromSources(
  legacyOverrides: LegacyOverridesApiRow | null | undefined,
  rawProject: Record<string, unknown> | null
): LegacyOverridesDraft {
  const base = emptyLegacyOverridesDraft();
  const ov = legacyOverrides;

  const mergeIdentity = (fromRaw: (k: string) => string): LegacyOverridesDraft["identityFields"] => ({
    name: str(ov?.identityFields?.name) || fromRaw("name"),
    code: str(ov?.identityFields?.code) || fromRaw("code"),
    hostKey: str(ov?.identityFields?.hostKey) || fromRaw("hostKey"),
    assetKey: str(ov?.identityFields?.assetKey) || fromRaw("assetKey"),
    displayName: str(ov?.identityFields?.displayName) || fromRaw("displayName"),
    payoff: str(ov?.identityFields?.payoff) || fromRaw("payoff"),
    city: str(ov?.identityFields?.city) || fromRaw("city"),
    contactPhone: str(ov?.identityFields?.contactPhone) || fromRaw("contactPhone"),
    contactEmail: str(ov?.identityFields?.contactEmail) || fromRaw("contactEmail"),
    contactForm: str(ov?.identityFields?.contactForm) || fromRaw("contactForm"),
    storeAddress: str(ov?.identityFields?.storeAddress) || fromRaw("storeAddress"),
    customDomain: str(ov?.identityFields?.customDomain) || fromRaw("customDomain"),
    broker: str(ov?.identityFields?.broker) || fromRaw("broker"),
    area: ((): LegacyOverridesDraft["identityFields"]["area"] => {
      const oa = ov?.identityFields?.area;
      if (oa === "sale" || oa === "rent") return oa;
      const ra = rawProject?.area;
      if (ra === "sale" || ra === "rent") return ra;
      return "";
    })(),
    defaultLang: str(ov?.identityFields?.defaultLang) || str(rawProject?.defaultLang) || "it-IT",
    mailLanguages:
      Array.isArray(ov?.identityFields?.mailLanguages) && ov.identityFields.mailLanguages.length
        ? ov.identityFields.mailLanguages.join(", ")
        : Array.isArray(rawProject?.mailLanguages)
          ? (rawProject.mailLanguages as string[]).join(", ")
          : "",
    disabledLanguages:
      Array.isArray(ov?.identityFields?.disabledLanguages) && ov.identityFields.disabledLanguages.length
        ? ov.identityFields.disabledLanguages.join(", ")
        : Array.isArray(rawProject?.disabledLanguages)
          ? (rawProject.disabledLanguages as string[]).join(", ")
          : "",
    accountManagerEnabled:
      ov?.identityFields?.accountManagerEnabled ?? (rawProject?.accountManagerEnabled === true),
    automaticQuoteEnabled:
      ov?.identityFields?.automaticQuoteEnabled ?? (rawProject?.automaticQuoteEnabled === true),
    googleRecaptchaSecret: str(ov?.identityFields?.googleRecaptchaSecret) || str(rawProject?.googleRecaptchaSecret),
    hCaptchaSecret: str(ov?.identityFields?.hCaptchaSecret) || str(rawProject?.hCaptchaSecret),
    AQcode: str(ov?.identityFields?.AQcode) || str(rawProject?.AQcode),
    languages:
      Array.isArray(ov?.identityFields?.languages) && ov.identityFields.languages.length
        ? ov.identityFields.languages.join(", ")
        : Array.isArray(rawProject?.languages)
          ? (rawProject.languages as string[]).join(", ")
          : "",
  });

  return {
    ...base,
    enabledTools: {
      quotations: ov?.enabledTools?.quotations ?? readLegacyBoolean(rawProject, ["enabledTools", "quotations"]),
      appointments: ov?.enabledTools?.appointments ?? readLegacyBoolean(rawProject, ["enabledTools", "appointments"]),
      floorPlans: ov?.enabledTools?.floorPlans ?? readLegacyBoolean(rawProject, ["enabledTools", "floorPlans"]),
      docs: ov?.enabledTools?.docs ?? readLegacyBoolean(rawProject, ["enabledTools", "docs"]),
      myHome: ov?.enabledTools?.myHome ?? readLegacyBoolean(rawProject, ["enabledTools", "myHome"]),
    },
    floorPlanning: {
      flowDeskEnabled: ov?.floorPlanning?.flowDeskEnabled ?? readLegacyBoolean(rawProject, ["floorPlanningConfig", "flowDeskEnabled"]),
      flowWebEnabled: ov?.floorPlanning?.flowWebEnabled ?? readLegacyBoolean(rawProject, ["floorPlanningConfig", "flowWebEnabled"]),
      planInfoEnabled: ov?.floorPlanning?.planInfoEnabled ?? readLegacyBoolean(rawProject, ["floorPlanningConfig", "planInfoEnabled"]),
      showOnlyAvailable: ov?.floorPlanning?.showOnlyAvailable ?? readLegacyBoolean(rawProject, ["floorPlanningConfig", "showOnlyAvailable"]),
    },
    neurosales: {
      enabled: ov?.neurosales?.enabled ?? readLegacyBoolean(rawProject, ["neurosalesConfig", "enabled"]),
      dashboardEnabled: ov?.neurosales?.dashboardEnabled ?? readLegacyBoolean(rawProject, ["neurosalesConfig", "dashboardEnabled"]),
      cardsEnabled: ov?.neurosales?.cardsEnabled ?? readLegacyBoolean(rawProject, ["neurosalesConfig", "cardsEnabled"]),
      homePageEnabled: ov?.neurosales?.homePageEnabled ?? readLegacyBoolean(rawProject, ["neurosalesConfig", "homePageEnabled"]),
    },
    myHome: {
      enabled: ov?.myHome?.enabled ?? readLegacyBoolean(rawProject, ["myhomeConfig", "enabled"]),
      documentAreaEnabled: ov?.myHome?.documentAreaEnabled ?? readLegacyBoolean(rawProject, ["myhomeConfig", "documentAreaEnabled"]),
      proposalEnabled: ov?.myHome?.proposalEnabled ?? readLegacyBoolean(rawProject, ["myhomeConfig", "proposalEnabled"]),
      reserveEnabled: ov?.myHome?.reserveEnabled ?? readLegacyBoolean(rawProject, ["myhomeConfig", "reserveEnabled"]),
      onlinePaymentEnabled: ov?.myHome?.onlinePaymentEnabled ?? readLegacyBoolean(rawProject, ["myhomeConfig", "onlinePaymentEnabled"]),
    },
    appointments: {
      bookingEnabled: ov?.appointments?.bookingEnabled ?? readLegacyBoolean(rawProject, ["appointmentsConfig", "bookingEnabled"]),
      openDaysEnabled: ov?.appointments?.openDaysEnabled ?? readLegacyBoolean(rawProject, ["appointmentsConfig", "openDaysEnabled"]),
      unavailablePeriodEnabled: ov?.appointments?.unavailablePeriodEnabled ?? readLegacyBoolean(rawProject, ["appointmentsConfig", "unavailablePeriodEnabled"]),
    },
    policyFlags: {
      gdprEnabled: ov?.policyFlags?.gdprEnabled ?? readLegacyBoolean(rawProject, ["gdpr", "enabled"]),
      marketingConsentEnabled: ov?.policyFlags?.marketingConsentEnabled ?? readLegacyBoolean(rawProject, ["gdpr", "marketingConsentEnabled"]),
      profilingConsentEnabled: ov?.policyFlags?.profilingConsentEnabled ?? readLegacyBoolean(rawProject, ["gdpr", "profilingConsentEnabled"]),
    },
    jobs: {
      leaseExpiryReminderEnabled:
        ov?.jobs?.leaseExpiryReminderEnabled ?? readLegacyBoolean(rawProject, ["jobsConfig", "leaseExpiryReminderEnabled"]),
      reminderDaysBefore:
        ov?.jobs?.reminderDaysBefore !== undefined
          ? String(ov.jobs.reminderDaysBefore)
          : readLegacyNumber(rawProject, ["jobsConfig", "reminderDaysBefore"]),
    },
    advancedOverrides: Array.isArray(ov?.advancedOverrides)
      ? ov.advancedOverrides.map((row) => ({
          path: row.path ?? "",
          valueType: row.valueType ?? "string",
          value:
            row.valueType === "number"
              ? String(row.numberValue ?? "")
              : row.valueType === "boolean"
                ? String(row.booleanValue ?? false)
                : row.stringValue ?? "",
        }))
      : [],
    identityFields: mergeIdentity((k) => str(rawProject?.[k])),
    pageTitleRows: ov?.pageTitles
      ? pageTitlesToRows(ov.pageTitles)
      : pageTitlesToRows(rawProject?.pageTitles),
    legacyEnabledTools:
      ov?.legacyEnabledTools && ov.legacyEnabledTools.length > 0
        ? ov.legacyEnabledTools
        : toolsFromRaw(rawProject?.enabledTools),
    manifestJson:
      ov?.manifestConfig !== undefined ? safeStringifyJson("manifest", ov.manifestConfig) : safeStringifyJson("manifest", rawProject?.manifestConfig),
    myLivingJson:
      ov?.myLivingConfig !== undefined ? safeStringifyJson("myLiving", ov.myLivingConfig) : safeStringifyJson("myLiving", rawProject?.myLivingConfig),
    rentAssetJson:
      ov?.rentAssetContext !== undefined
        ? safeStringifyJson("rent", ov.rentAssetContext)
        : safeStringifyJson("rent", rawProject?.rentAssetContext),
    myhomeJson:
      ov?.myhomeConfig !== undefined ? safeStringifyJson("myhome", ov.myhomeConfig) : safeStringifyJson("myhome", rawProject?.myhomeConfig),
    jobsConfigJson:
      ov?.jobsConfig !== undefined ? safeStringifyJson("jobs", ov.jobsConfig) : safeStringifyJson("jobs", rawProject?.jobsConfig),
    followupJson:
      ov?.followupConfig !== undefined ? safeStringifyJson("followup", ov.followupConfig) : safeStringifyJson("followup", rawProject?.followupConfig),
    floorPlanningConfigJson:
      ov?.floorPlanningConfig !== undefined
        ? safeStringifyJson("fp", ov.floorPlanningConfig)
        : safeStringifyJson("fp", rawProject?.floorPlanningConfig),
    neurosalesJson:
      ov?.neurosalesConfig !== undefined
        ? safeStringifyJson("neuro", ov.neurosalesConfig)
        : safeStringifyJson("neuro", rawProject?.neurosalesConfig),
    legacyPolicyFlagsJson:
      ov?.legacyPolicyFlags !== undefined
        ? safeStringifyJson("policy", ov.legacyPolicyFlags)
        : safeStringifyJson("policy", rawProject?.policyFlags),
    businessPlatformJson:
      ov?.businessPlatformConfig !== undefined
        ? safeStringifyJson("bp", ov.businessPlatformConfig)
        : safeStringifyJson("bp", rawProject?.businessPlatformConfig),
    domainWhitelist:
      ov?.domainWhitelist && ov.domainWhitelist.length
        ? ov.domainWhitelist.join(", ")
        : Array.isArray(rawProject?.domainWhitelist)
          ? (rawProject.domainWhitelist as string[]).join(", ")
          : "",
    projectFlagsJson:
      ov?.projectFlags !== undefined ? safeStringifyJson("pf", ov.projectFlags) : safeStringifyJson("pf", rawProject?.projectFlags),
    proposalTemplateJson:
      ov?.proposalTemplate !== undefined
        ? safeStringifyJson("proposal", ov.proposalTemplate)
        : safeStringifyJson("proposal", rawProject?.proposalTemplate),
    ibanJson: ov?.iban !== undefined ? safeStringifyJson("iban", ov.iban) : safeStringifyJson("iban", rawProject?.iban),
  };
}

function parseJsonField(
  raw: string,
  fieldLabel: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(t) as unknown };
  } catch {
    return { ok: false, error: `JSON non valido in ${fieldLabel}` };
  }
}

function splitComma(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function buildPutPayloadFromDraft(
  d: LegacyOverridesDraft
):
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string } {
  const pageTitles: Record<string, string> = {};
  for (const row of d.pageTitleRows) {
    const k = row.key.trim();
    if (!k) continue;
    pageTitles[k] = row.value;
  }

  const jsonBlocks: Array<[string, string, string]> = [
    ["Manifest", d.manifestJson, "manifestConfig"],
    ["MyLiving", d.myLivingJson, "myLivingConfig"],
    ["Rent asset", d.rentAssetJson, "rentAssetContext"],
    ["MyHome config", d.myhomeJson, "myhomeConfig"],
    ["Jobs config", d.jobsConfigJson, "jobsConfig"],
    ["FollowUp config", d.followupJson, "followupConfig"],
    ["FloorPlanning config", d.floorPlanningConfigJson, "floorPlanningConfig"],
    ["Neurosales config", d.neurosalesJson, "neurosalesConfig"],
    ["Policy flags (raw)", d.legacyPolicyFlagsJson, "legacyPolicyFlags"],
    ["Business platform", d.businessPlatformJson, "businessPlatformConfig"],
    ["Project flags", d.projectFlagsJson, "projectFlags"],
    ["Proposal template", d.proposalTemplateJson, "proposalTemplate"],
    ["IBAN", d.ibanJson, "iban"],
  ];

  const parsedJson: Record<string, unknown> = {};
  for (const [label, json, apiKey] of jsonBlocks) {
    const r = parseJsonField(json, label);
    if (!r.ok) return r;
    if (r.value !== undefined) parsedJson[apiKey] = r.value;
  }

  const identityFields: Record<string, unknown> = {
    name: d.identityFields.name || undefined,
    code: d.identityFields.code || undefined,
    hostKey: d.identityFields.hostKey || undefined,
    assetKey: d.identityFields.assetKey || undefined,
    displayName: d.identityFields.displayName || undefined,
    payoff: d.identityFields.payoff || undefined,
    city: d.identityFields.city || undefined,
    contactPhone: d.identityFields.contactPhone || undefined,
    contactEmail: d.identityFields.contactEmail || undefined,
    contactForm: d.identityFields.contactForm || undefined,
    storeAddress: d.identityFields.storeAddress || undefined,
    customDomain: d.identityFields.customDomain || undefined,
    broker: d.identityFields.broker || undefined,
    ...(d.identityFields.area ? { area: d.identityFields.area } : {}),
    defaultLang: d.identityFields.defaultLang || undefined,
    mailLanguages: splitComma(d.identityFields.mailLanguages),
    disabledLanguages: splitComma(d.identityFields.disabledLanguages),
    accountManagerEnabled: d.identityFields.accountManagerEnabled,
    automaticQuoteEnabled: d.identityFields.automaticQuoteEnabled,
    googleRecaptchaSecret: d.identityFields.googleRecaptchaSecret || undefined,
    hCaptchaSecret: d.identityFields.hCaptchaSecret || undefined,
    AQcode: d.identityFields.AQcode || undefined,
    languages: splitComma(d.identityFields.languages),
  };

  const payload: Record<string, unknown> = {
    enabledTools: d.enabledTools,
    floorPlanning: d.floorPlanning,
    neurosales: d.neurosales,
    myHome: d.myHome,
    appointments: d.appointments,
    policyFlags: d.policyFlags,
    jobs: {
      leaseExpiryReminderEnabled: d.jobs.leaseExpiryReminderEnabled,
      reminderDaysBefore:
        d.jobs.reminderDaysBefore.trim() === "" ? undefined : Number(d.jobs.reminderDaysBefore),
    },
    advancedOverrides: d.advancedOverrides
      .filter((r) => r.path.trim() !== "")
      .map((r) => ({
        path: r.path.trim(),
        valueType: r.valueType,
        ...(r.valueType === "number"
          ? { numberValue: r.value.trim() === "" ? undefined : Number(r.value) }
          : r.valueType === "boolean"
            ? { booleanValue: r.value === "true" }
            : { stringValue: r.value }),
      })),
    identityFields,
    pageTitles: Object.keys(pageTitles).length ? pageTitles : undefined,
    legacyEnabledTools: d.legacyEnabledTools.length ? d.legacyEnabledTools : undefined,
    domainWhitelist: splitComma(d.domainWhitelist),
    ...parsedJson,
  };

  if (payload.domainWhitelist && (payload.domainWhitelist as string[]).length === 0) {
    delete payload.domainWhitelist;
  }

  return { ok: true, payload };
}
