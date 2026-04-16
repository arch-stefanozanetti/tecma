import type { AmlProvider } from "./aml-provider.types.js";
import { SumsubAdapter } from "./sumsub/sumsub-adapter.js";
import { getSumsubConfigSecrets } from "./aml-config.service.js";

export async function getAmlProviderForWorkspace(
  workspaceId: string,
  providerId: string
): Promise<AmlProvider | null> {
  if (providerId === "sumsub") {
    const secrets = await getSumsubConfigSecrets(workspaceId);
    if (!secrets) return null;
    return new SumsubAdapter({
      appToken: secrets.appToken,
      secretKey: secrets.secretKey,
      levelName: secrets.levelName,
    });
  }
  return null;
}
