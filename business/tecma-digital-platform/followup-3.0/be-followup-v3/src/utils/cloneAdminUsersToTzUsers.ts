/**
 * Clona utenti da DB `user` / `adminUsers` (sola lettura) verso `test-zanetti` / `tz_users`.
 * Scrive SOLO su test-zanetti. Nessuna modifica al DB `user` o ad altri database.
 *
 * Uso (MONGO_DB_NAME deve essere esattamente test-zanetti):
 *   npm run clone-adminusers-to-tz-users
 *
 * Variabili: MONGO_URI, MONGO_DB_NAME=test-zanetti
 */
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const TARGET_DB = "test-zanetti";
const SOURCE_DB = "user";
const SOURCE_COLL = "adminUsers";
const TARGET_COLL = "tz_users";

const EMAILS = [
  "r.cerrone@tecmasolutions.com",
  "e.rizzini@tecmasolutions.com",
  "g.recchimuzzi@tecmasolutions.com",
  "d.abbate@tecmasolutions.com",
  "s.trifiletti@tecmasolutions.com",
  "g.fusco@tecmasolutions.com"
];

type AdminUserDoc = Record<string, unknown> & {
  email?: string;
  password?: string;
  role?: string;
  isDisabled?: boolean;
  project_ids?: unknown[];
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") {
    throw new Error(`Variabile d'ambiente ${name} obbligatoria.`);
  }
  return v.trim();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailRegex(email: string): { $regex: string; $options: string } {
  const escaped = normalizeEmail(email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: `^${escaped}$`, $options: "i" };
}

function mapProjectIds(ids: unknown[] | undefined): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return ids.map((x) => {
    if (x instanceof ObjectId) return x.toHexString();
    const s = String(x);
    if (ObjectId.isValid(s) && s.length === 24) return new ObjectId(s).toHexString();
    return s;
  });
}

function toTzFields(doc: AdminUserDoc, email: string): Record<string, unknown> {
  const pwd = typeof doc.password === "string" ? doc.password : "";
  const disabled = Boolean(doc.isDisabled);
  const status =
    pwd && !disabled ? "active" : disabled ? "disabled" : pwd ? "active" : "disabled";
  const role = String(doc.role || "admin").toLowerCase();
  return {
    email: normalizeEmail(email),
    password: pwd,
    role,
    isDisabled: disabled,
    status,
    project_ids: mapProjectIds(doc.project_ids),
    updatedAt: new Date()
  };
}

async function main(): Promise<void> {
  const mongoUri = getEnv("MONGO_URI");
  const envDb = getEnv("MONGO_DB_NAME");
  if (envDb !== TARGET_DB) {
    console.error(
      `Sicurezza: lo script scrive solo su "${TARGET_DB}". MONGO_DB_NAME="${envDb}". Abort.`
    );
    process.exit(1);
  }

  const emails =
    process.argv.slice(2).map((e) => normalizeEmail(e)).filter(Boolean).length > 0
      ? process.argv.slice(2).map((e) => normalizeEmail(e)).filter(Boolean)
      : EMAILS;

  const client = new MongoClient(mongoUri);
  let failures = 0;

  try {
    await client.connect();
    const source = client.db(SOURCE_DB).collection<AdminUserDoc>(SOURCE_COLL);
    const target = client.db(TARGET_DB).collection(TARGET_COLL);

    for (const email of emails) {
      const doc = await source.findOne({ email: emailRegex(email) });
      if (!doc) {
        console.error(`[skip] Non trovato in ${SOURCE_DB}.${SOURCE_COLL}: ${email}`);
        failures++;
        continue;
      }

      const fields = toTzFields(doc, doc.email || email);
      if (!fields.password) {
        console.error(`[skip] Nessuna password su adminUsers: ${email}`);
        failures++;
        continue;
      }

      const existing = await target.findOne({ email: emailRegex(email) });
      if (existing) {
        await target.updateOne(
          { _id: (existing as { _id: ObjectId })._id },
          { $set: fields }
        );
        console.log(`[update] ${TARGET_DB}.${TARGET_COLL}: ${fields.email}`);
      } else {
        await target.insertOne({
          _id: new ObjectId(),
          ...fields,
          createdAt: new Date()
        });
        console.log(`[insert] ${TARGET_DB}.${TARGET_COLL}: ${fields.email}`);
      }
    }

    if (failures > 0) {
      console.error(`Completato con ${failures} errori.`);
      process.exit(1);
    }
    console.log("Done.");
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
