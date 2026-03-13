import { MongoClient } from "mongodb";
import { ENV } from "../config/env.js";

const SOURCE_DB = "test";
const TARGET_DB = "test-zanetti";

/** Collection tz_* usate in test-zanetti (nessun riferimento a DB/collection esterne). */
const TZ_COLLECTIONS = [
  "tz_projects",
  "tz_workspaces",
  "tz_workspace_projects",
  "tz_additional_infos",
  "tz_requests",
  "tz_request_transitions",
  "tz_request_actions",
  "tz_authEvents",
  "tz_authSessions",
  "tz_workflow_configs",
  "tz_project_policies",
  "tz_project_email_config",
  "tz_project_email_templates",
  "tz_project_pdf_templates",
  "tz_audit_log",
  "tz_clients",
  "tz_apartments",
  "tz_users",
  "tz_quotes",
  "tz_calendar_events",
  "tz_ai_suggestions",
  "tz_ai_suggestion_approvals",
  "tz_ai_action_drafts",
  "tz_domain_events",
  "tz_tasks",
  "tz_reminders_queue",
  "tz_apartment_client_associations",
  "tz_hc_apartments",
  "tz_configuration_templates",
  "tz_complete_flow_runs",
];

const unifyMainDb = async () => {
  const client = new MongoClient(ENV.MONGO_URI);
  try {
    await client.connect();
    const source = client.db(SOURCE_DB);
    // Ensure target DB exists
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const target = client.db(TARGET_DB);

    // eslint-disable-next-line no-console
    console.log(`Unifying main DB: copying tz_* from "${SOURCE_DB}" to "${TARGET_DB}"`);

    for (const collName of TZ_COLLECTIONS) {
      const exists = await source
        .listCollections({ name: collName }, { nameOnly: true })
        .hasNext();
      if (!exists) {
        // eslint-disable-next-line no-console
        console.log(`- Skipping ${collName}: not present in ${SOURCE_DB}`);
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(`- Merging collection ${collName}`);
      await source
        .collection(collName)
        .aggregate([
          { $match: {} },
          {
            $merge: {
              into: { db: TARGET_DB, coll: collName },
              on: "_id",
              whenMatched: "merge",
              whenNotMatched: "insert",
            },
          },
        ])
        .toArray();
    }

    // eslint-disable-next-line no-console
    console.log("Unify main DB completed.");
  } finally {
    await client.close();
  }
};

unifyMainDb().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

