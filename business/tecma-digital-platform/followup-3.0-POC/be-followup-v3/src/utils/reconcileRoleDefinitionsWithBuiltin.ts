/**
 * Allinea `tz_roleDefinitions` (owner, admin, collaborator, viewer) al piano minimo codice + permessi già in DB.
 *
 * Uso: dalla root be-followup-v3 con MONGO_URI / env come il server:
 *   npx tsx src/utils/reconcileRoleDefinitionsWithBuiltin.ts
 */
import { connectDb } from "../config/db.js";
import { reconcileWorkspaceRoleDefinitionsWithBuiltin } from "../core/rbac/roleDefinitions.service.js";

async function main() {
  await connectDb();
  await reconcileWorkspaceRoleDefinitionsWithBuiltin();
  console.log("[rbac] reconcileWorkspaceRoleDefinitionsWithBuiltin: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
