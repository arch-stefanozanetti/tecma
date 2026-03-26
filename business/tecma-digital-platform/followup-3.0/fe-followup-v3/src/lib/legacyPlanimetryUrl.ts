type ApiEnvironment = "dev-1" | "demo" | "prod";

const OCI_BASE = "https://objectstorage.eu-frankfurt-1.oraclecloud.com/n/fronf8xprl08";

function envToBucket(env?: ApiEnvironment): string {
  return env === "prod" ? "tecma-assets-prod" : "tecma-assets-coll";
}

function safeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildLegacyPlanimetryUrl(input: {
  apiEnvironment?: ApiEnvironment;
  projectName: string;
  apartmentName: string;
  cacheKey?: string;
}): string | null {
  const projectName = safeName(input.projectName);
  const apartmentName = safeName(input.apartmentName);
  if (!projectName || !apartmentName) return null;

  const bucket = envToBucket(input.apiEnvironment);
  const projectPath = encodeURIComponent(projectName);
  const apartmentFile = encodeURIComponent(`${apartmentName}.png`);
  const cacheSuffix = input.cacheKey ? `?cache=${encodeURIComponent(input.cacheKey)}` : "";

  return `${OCI_BASE}/b/${bucket}/o/initiatives/${projectPath}/floorplanning/img/planimetrie/${apartmentFile}${cacheSuffix}`;
}

