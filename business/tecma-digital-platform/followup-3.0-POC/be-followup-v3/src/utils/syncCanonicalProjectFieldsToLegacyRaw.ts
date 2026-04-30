import { getDb } from "../config/db.js";
import { assertJsonSize, deepMergeRawProject } from "../core/projects/legacy-raw-project-merge.js";
import { buildRawProjectPatchFromTzUpdate } from "../core/projects/project-canonical-sync.js";

const COLLECTION_TZ_PROJECTS = "tz_projects";

async function main(): Promise<void> {
  const db = getDb();
  const coll = db.collection<Record<string, unknown>>(COLLECTION_TZ_PROJECTS);
  const docs = await coll.find({}).toArray();

  let touched = 0;
  for (const doc of docs) {
    const updateDoc: Record<string, unknown> = {};
    for (const key of [
      "name",
      "displayName",
      "hostKey",
      "assetKey",
      "customDomain",
      "city",
      "payoff",
      "defaultLang",
      "accountManagerEnabled",
      "automaticQuoteEnabled",
      "broker",
      "contactPhone",
      "contactEmail",
      "projectUrl",
      "iban",
    ]) {
      if (doc[key] !== undefined) updateDoc[key] = doc[key];
    }
    const rawPatch = buildRawProjectPatchFromTzUpdate(updateDoc);
    if (Object.keys(rawPatch).length === 0) continue;

    const legacyPayload =
      typeof doc.legacyPayload === "object" && doc.legacyPayload !== null
        ? (doc.legacyPayload as Record<string, unknown>)
        : {};
    const existingRaw =
      typeof legacyPayload.rawProject === "object" && legacyPayload.rawProject !== null
        ? (legacyPayload.rawProject as Record<string, unknown>)
        : {};
    const mergedRaw = deepMergeRawProject(existingRaw, rawPatch);
    assertJsonSize(mergedRaw);
    const nextLegacyPayload = { ...legacyPayload, rawProject: mergedRaw };
    assertJsonSize(nextLegacyPayload);

    await coll.updateOne(
      { _id: doc._id },
      { $set: { legacyPayload: nextLegacyPayload, updatedAt: new Date().toISOString() } }
    );
    touched += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`[syncCanonicalProjectFieldsToLegacyRaw] done, projects touched: ${touched}/${docs.length}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[syncCanonicalProjectFieldsToLegacyRaw] failed", err);
  process.exit(1);
});

