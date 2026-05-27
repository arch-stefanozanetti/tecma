/**
 * Migra tz_workspace_user_projects → tz_user_project_access per workspace.
 *
 * Uso:
 *   npx tsx scripts/migrate-user-project-access.ts <workspaceId>
 *   WORKSPACE_ID=... npx tsx scripts/migrate-user-project-access.ts
 */
import { connectDb } from "../src/config/db.js";
import { migrateLegacyUserProjectAccessForWorkspace } from "../src/core/access/user-project-access.service.js";

async function main(): Promise<void> {
  const workspaceId = (process.argv[2] || process.env.WORKSPACE_ID || "").trim();
  if (!workspaceId) {
    console.error("Usage: npx tsx scripts/migrate-user-project-access.ts <workspaceId>");
    process.exit(1);
  }
  await connectDb();
  const result = await migrateLegacyUserProjectAccessForWorkspace(workspaceId);
  console.log(JSON.stringify({ workspaceId, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
