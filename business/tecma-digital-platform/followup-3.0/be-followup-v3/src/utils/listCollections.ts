import { connectDb } from "../config/db.js";

const main = async () => {
  const db = await connectDb();
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();

  const names = collections.map((c) => c.name).sort((a, b) => a.localeCompare(b));
  // eslint-disable-next-line no-console
  console.log(`Collections (${names.length}):`);
  for (const name of names) {
    // eslint-disable-next-line no-console
    console.log(`- ${name}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to list collections", error);
    process.exit(1);
  });
