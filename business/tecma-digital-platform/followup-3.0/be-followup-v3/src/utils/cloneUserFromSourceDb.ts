/**
 * Clona un utente admin (e relativi workspace) dal DB sorgente (sola lettura, es. tecma)
 * al DB target test-zanetti. Scrive SOLO su test-zanetti; nessun altro DB viene modificato.
 *
 * Uso:
 *   SOURCE_MONGO_URI="mongodb+srv://..." SOURCE_MONGO_DB_NAME="tecma" \
 *   MONGO_URI="mongodb+srv://..." MONGO_DB_NAME="test-zanetti" \
 *   npm run clone-user-from-source -- f.stravino@tecmasolutions.com
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

const main = async () => {
  const emailArg = process.argv[2];
  const email = (emailArg ?? "f.stravino@tecmasolutions.com").trim().toLowerCase();
  if (!email) {
    console.error("Uso: npm run clone-user-from-source -- <email>");
    process.exit(1);
  }

  const sourceUri = getEnv("SOURCE_MONGO_URI");
  const sourceDbName = getEnv("SOURCE_MONGO_DB_NAME");
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
    const sourceUsers = sourceDb.collection(userCollName);
    const targetUsers = targetDb.collection(userCollName);

    const normalizedRegex = `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
    const userDoc = await sourceUsers.findOne({
      email: { $regex: normalizedRegex, $options: "i" },
    });

    if (!userDoc) {
      console.error(`Utente non trovato nel DB sorgente (${sourceDbName}): ${email}`);
      process.exit(1);
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
