import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDb, getDb } from "../config/db.js";

const USER_COLLECTION_CANDIDATES = ["tz_users", "users", "Users", "user", "User", "backoffice_users"];

const EMAIL = "s.zanetti@tecmasolutions.com";
const PASSWORD = "JJUbbsuy3339!";

const detectUserCollectionName = async (): Promise<string> => {
  const db = getDb();
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (exists) return name;
  }
  const available = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  throw new Error(
    `User collection not found in db "${db.databaseName}". Available collections: [${available.join(", ")}]`
  );
};

const main = async () => {
  await connectDb();
  const db = getDb();
  const collectionName = await detectUserCollectionName();
  const users = db.collection(collectionName);

  const email = EMAIL.trim().toLowerCase();
  const normalizedRegex = `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

  const existing = await users.findOne({
    email: { $regex: normalizedRegex, $options: "i" }
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  if (existing) {
    await users.updateOne(
      { _id: (existing as { _id: unknown })._id as import("mongodb").ObjectId },
      {
        $set: {
          email,
          password: passwordHash,
          role: "admin",
          isDisabled: false,
          updatedAt: new Date()
        }
      }
    );
    // eslint-disable-next-line no-console
    console.log(`Updated existing admin user "${email}" in collection "${collectionName}".`);
  } else {
    await users.insertOne({
      email,
      password: passwordHash,
      role: "admin",
      isDisabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    // eslint-disable-next-line no-console
    console.log(`Created admin user "${email}" in collection "${collectionName}".`);
  }
};

main()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

