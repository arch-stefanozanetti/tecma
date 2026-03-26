import { ObjectId } from "mongodb";
import { connectDb, disconnectDb, getDb } from "../config/db.js";

const PROJECTS_COLLECTION = "tz_projects";

const SCALAR_KEYS = new Set(["projectId", "project_id"]);
const ARRAY_KEYS = new Set(["projectIds", "project_ids", "selectedProjectIds", "project_ids"]);

type Mapping = Map<string, string>;

function remapDocumentValue(value: unknown, key: string | null, mapping: Mapping): unknown {
  if (Array.isArray(value)) {
    if (key && ARRAY_KEYS.has(key)) {
      return value.map((item) =>
        typeof item === "string" && mapping.has(item) ? mapping.get(item) ?? item : item
      );
    }
    return value.map((item) => remapDocumentValue(item, null, mapping));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      if (k === "_id") {
        out[k] = v;
        continue;
      }
      out[k] = remapDocumentValue(v, k, mapping);
    }
    return out;
  }

  if (typeof value === "string" && key && SCALAR_KEYS.has(key) && mapping.has(value)) {
    return mapping.get(value) ?? value;
  }

  return value;
}

function stringifyId(raw: unknown): string {
  if (raw instanceof ObjectId) return raw.toHexString();
  return String(raw ?? "");
}

async function migrateProjectsToObjectIds(): Promise<Mapping> {
  const db = getDb();
  const projects = db.collection(PROJECTS_COLLECTION);
  const docs = await projects.find({}).toArray();
  const mapping: Mapping = new Map();

  for (const doc of docs) {
    if (doc._id instanceof ObjectId) continue;
    const legacyId = stringifyId(doc._id);
    if (!legacyId || mapping.has(legacyId)) continue;

    const newId = new ObjectId();
    const newIdHex = newId.toHexString();
    const cloned = { ...doc };
    delete (cloned as Record<string, unknown>)._id;

    await projects.insertOne({
      ...cloned,
      _id: newId,
      id: newIdHex,
      legacyProjectId: legacyId,
      updatedAt: new Date().toISOString(),
    });
    await projects.deleteOne({ _id: doc._id });

    mapping.set(legacyId, newIdHex);
  }

  return mapping;
}

async function remapReferences(mapping: Mapping): Promise<{ scanned: number; updated: number }> {
  const db = getDb();
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const legacyIds = [...mapping.keys()];
  let scanned = 0;
  let updated = 0;

  for (const collMeta of collections) {
    const name = collMeta.name;
    if (!name || name === PROJECTS_COLLECTION) continue;
    const coll = db.collection(name);
    const docs = await coll
      .find({
        $or: [
          { projectId: { $in: legacyIds } },
          { project_id: { $in: legacyIds } },
          { projectIds: { $in: legacyIds } },
          { project_ids: { $in: legacyIds } },
          { selectedProjectIds: { $in: legacyIds } },
        ],
      })
      .toArray();
    if (docs.length === 0) continue;
    console.log(`[migrate-project-ids] ${name}: ${docs.length} docs to update`);
    for (const doc of docs) {
      scanned += 1;
      const transformed = remapDocumentValue(doc, null, mapping) as Record<string, unknown>;
      if (JSON.stringify(transformed) === JSON.stringify(doc)) continue;
      await coll.replaceOne({ _id: doc._id }, transformed);
      updated += 1;
    }
  }

  return { scanned, updated };
}

async function run() {
  await connectDb();
  console.log("[migrate-project-ids] start");
  const mapping = await migrateProjectsToObjectIds();
  if (mapping.size === 0) {
    console.log("[migrate-project-ids] no legacy project IDs found");
    return;
  }

  const { scanned, updated } = await remapReferences(mapping);
  console.log("[migrate-project-ids] done");
  console.log(`- remapped projects: ${mapping.size}`);
  console.log(`- scanned docs: ${scanned}`);
  console.log(`- updated docs: ${updated}`);
}

run()
  .catch((err) => {
    console.error("[migrate-project-ids] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
