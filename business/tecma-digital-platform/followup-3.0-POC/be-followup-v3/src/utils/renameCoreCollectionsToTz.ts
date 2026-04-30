import { MongoClient } from "mongodb";
import { ENV } from "../config/env.js";

type Pair = { legacy: string; tz: string };

const PAIRS: Pair[] = [
  { legacy: "clients", tz: "tz_clients" },
];

const run = async () => {
  const client = new MongoClient(ENV.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(ENV.MONGO_DB_NAME);

    const pairs: Pair[] = [
      { legacy: "clients", tz: "tz_clients" },
      { legacy: "apartments", tz: "tz_apartments" },
      { legacy: "calendar_events", tz: "tz_calendar_events" },
      { legacy: "projects", tz: "tz_projects" },
      { legacy: "requests", tz: "tz_requests" },
      { legacy: "timeline_items", tz: "tz_timeline_items" },
      { legacy: "nurturing_rules", tz: "tz_nurturing_rules" },
      { legacy: "domain_events", tz: "tz_domain_events" },
      { legacy: "client_layouts", tz: "tz_client_layouts" },
    ];

    // eslint-disable-next-line no-console
    console.log(`Rinominando collection legacy in tz_* su DB ${db.databaseName}`);

    for (const { legacy, tz } of pairs) {
      const existsLegacy = await db
        .listCollections({ name: legacy }, { nameOnly: true })
        .hasNext();
      if (!existsLegacy) {
        // eslint-disable-next-line no-console
        console.log(`- ${legacy}: non esiste, skip`);
        continue;
      }

      const existsTz = await db
        .listCollections({ name: tz }, { nameOnly: true })
        .hasNext();

      if (!existsTz) {
        // rename diretto legacy -> tz
        // eslint-disable-next-line no-console
        console.log(`- Rinomino ${legacy} -> ${tz}`);
        await db.collection(legacy).rename(tz);
      } else {
        // merge: copia legacy dentro tz_ e poi droppa legacy
        // eslint-disable-next-line no-console
        console.log(`- Merge ${legacy} in ${tz} quindi drop ${legacy}`);
        await db
          .collection(legacy)
          .aggregate([
            { $match: {} },
            {
              $merge: {
                into: tz,
                on: "_id",
                whenMatched: "merge",
                whenNotMatched: "insert",
              },
            },
          ])
          .toArray();
        await db.collection(legacy).drop();
      }
    }

    // eslint-disable-next-line no-console
    console.log("Rinomina/merge completata.");
  } finally {
    await client.close();
  }
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

