/**
 * Clona un utente admin (e relativi workspace) dal DB sorgente (sola lettura, es. tecma)
 * al DB target test-zanetti. Scrive SOLO su test-zanetti; nessun altro DB viene modificato.
 *
 * Uso:
 *   MONGO_URI + MONGO_DB_NAME=test-zanetti nel .env; opzionale SOURCE_* se il DB sorgente è altrove.
 *   Se SOURCE_MONGO_URI non è impostato, si usa MONGO_URI; se SOURCE_MONGO_DB_NAME manca → "tecma".
 *   npm run clone-user-from-source -- f.stravino@tecmasolutions.com
 *   npm run clone-user-from-source -- user1@... user2@...   # più utenti, una sola connessione
 *
 * Requisiti: MONGO_DB_NAME deve essere esattamente "test-zanetti" (sicurezza).
 */
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const TARGET_DB_ALLOWED = "test-zanetti";
const USER_COLLECTION_CANDIDATES = ["tz_users", "users", "Users", "user", "User", "backoffice_users"];
const USER_WORKSPACES_COLLECTION = "tz_user_workspaces";

function getEnv(name: string): string {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") {
    throw new Error(`Variabile d'ambiente ${name} obbligatoria per questo script.`);
  }
  return v.trim();
}

/** Stesso cluster di MONGO_URI, DB diverso (es. tecma → test-zanetti). */
function getSourceMongoUri(): string {
  const src = process.env.SOURCE_MONGO_URI?.trim();
  if (src) return src;
  return getEnv("MONGO_URI");
}

function getSourceMongoDbName(): string {
  const n = process.env.SOURCE_MONGO_DB_NAME?.trim();
  if (n) return n;
  return "tecma";
}

async function detectUserCollectionName(
  client: MongoClient,
  dbName: string
): Promise<string> {
  const db = client.db(dbName);
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) return name;
  }
  const available = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  throw new Error(
    `Collezione utenti non trovata nel db "${dbName}". Collezioni: [${available.join(", ")}]`
  );
}

async function cloneOneUser(
  email: string,
  sourceDb: ReturnType<MongoClient["db"]>,
  targetDb: ReturnType<MongoClient["db"]>,
  sourceDbName: string,
  targetDbName: string,
  userCollName: string
): Promise<void> {
  const sourceUsers = sourceDb.collection(userCollName);
  const targetUsers = targetDb.collection(userCollName);

  const normalizedRegex = `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
  const userDoc = await sourceUsers.findOne({
    email: { $regex: normalizedRegex, $options: "i" },
  });

  if (!userDoc) {
    throw new Error(`Utente non trovato nel DB sorgente (${sourceDbName}): ${email}`);
  }

  const userObj = userDoc as Record<string, unknown>;
  const { _id: _omitId, ...userFields } = userObj;
  const docToInsert = {
    ...userFields,
    email: email,
    updatedAt: new Date(),
  };

  const existingTarget = await targetUsers.findOne({
    email: { $regex: normalizedRegex, $options: "i" },
  });

  if (existingTarget) {
    await targetUsers.updateOne(
      { _id: (existingTarget as { _id: ObjectId })._id },
      { $set: docToInsert }
    );
    console.log(`Aggiornato utente esistente in ${targetDbName}: ${email}`);
  } else {
    await targetUsers.insertOne({
      ...docToInsert,
      createdAt: (userObj.createdAt as Date) ?? new Date(),
    });
    console.log(`Inserito utente in ${targetDbName}: ${email}`);
  }

  const hasWorkspaces = await sourceDb
    .listCollections({ name: USER_WORKSPACES_COLLECTION }, { nameOnly: true })
    .hasNext();
  if (hasWorkspaces) {
    const sourceUw = sourceDb.collection(USER_WORKSPACES_COLLECTION);
    const targetUw = targetDb.collection(USER_WORKSPACES_COLLECTION);
    const memberships = await sourceUw.find({ userId: email }).toArray();
    for (const m of memberships) {
      const workspaceId = (m as unknown as { workspaceId: string }).workspaceId;
      const existing = await targetUw.findOne({
        workspaceId,
        userId: email,
      });
      if (!existing) {
        const { _id: _o, ...rest } = m as Record<string, unknown>;
        await targetUw.insertOne({
          ...rest,
          userId: email,
          createdAt: (rest.createdAt as string) ?? new Date().toISOString(),
          updatedAt: (rest.updatedAt as string) ?? new Date().toISOString(),
        });
      }
    }
    console.log(`Workspace memberships: ${memberships.length} copiati/verificati per ${email}`);
  }
}

const main = async () => {
  const emails = process.argv
    .slice(2)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    console.error("Uso: npm run clone-user-from-source -- <email> [email2 ...]");
    process.exit(1);
  }

  const sourceUri = getSourceMongoUri();
  const sourceDbName = getSourceMongoDbName();
  const targetUri = getEnv("MONGO_URI");
  const targetDbName = getEnv("MONGO_DB_NAME");

  if (targetDbName !== TARGET_DB_ALLOWED) {
    console.error(
      `Sicurezza: questo script scrive solo sul DB "${TARGET_DB_ALLOWED}". MONGO_DB_NAME è "${targetDbName}". Abort.`
    );
    process.exit(1);
  }

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db(sourceDbName);
    const targetDb = targetClient.db(targetDbName);

    const userCollName = await detectUserCollectionName(sourceClient, sourceDbName);

    for (const email of emails) {
      console.log(`--- ${email} ---`);
      await cloneOneUser(email, sourceDb, targetDb, sourceDbName, targetDbName, userCollName);
    }

    console.log("Done.");
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
