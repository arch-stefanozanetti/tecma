import { connectDb } from "../config/db.js";

const COPY_SUFFIX = `copy_test_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
const DEFAULT_COLLECTIONS = ["clients", "apartments", "calendar_events"];

const main = async () => {
  const db = await connectDb();
  const selected = process.argv.slice(2);
  const sourceCollections = selected.length > 0 ? selected : DEFAULT_COLLECTIONS;

  // eslint-disable-next-line no-console
  console.log(`Copy suffix: ${COPY_SUFFIX}`);

  for (const sourceName of sourceCollections) {
    const source = db.collection(sourceName);
    const exists = await db.listCollections({ name: sourceName }, { nameOnly: true }).hasNext();
    if (!exists) {
      // eslint-disable-next-line no-console
      console.log(`Skip: source collection "${sourceName}" not found`);
      continue;
    }

    const targetName = `${sourceName}_${COPY_SUFFIX}`;
    const targetExists = await db.listCollections({ name: targetName }, { nameOnly: true }).hasNext();
    if (targetExists) {
      // eslint-disable-next-line no-console
      console.log(`Skip: target collection "${targetName}" already exists`);
      continue;
    }

    const docs = await source.find({}).toArray();
    const sanitizedDocs = docs.map((doc) => {
      const { _id, ...rest } = doc as Record<string, unknown>;
      return rest;
    });

    if (sanitizedDocs.length === 0) {
      await db.createCollection(targetName);
      // eslint-disable-next-line no-console
      console.log(`Created empty copy: ${targetName}`);
      continue;
    }

    await db.collection(targetName).insertMany(sanitizedDocs);
    // eslint-disable-next-line no-console
    console.log(`Copied ${sanitizedDocs.length} docs from ${sourceName} -> ${targetName}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to copy collections", error);
    process.exit(1);
  });
