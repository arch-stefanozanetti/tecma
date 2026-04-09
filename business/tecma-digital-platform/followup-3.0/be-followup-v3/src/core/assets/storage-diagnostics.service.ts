/**
 * Diagnostica configurazione storage S3 per asset workspace (FASE3 — verifica senza esporre segreti).
 * Usa le stesse variabili di `assets-s3.service.ts` (ASSETS_S3_BUCKET / EMAIL_FLOW_S3_BUCKET, AWS_REGION, credenziali AWS).
 */
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

export type AssetsBucketSource = "ASSETS_S3_BUCKET" | "EMAIL_FLOW_S3_BUCKET" | "none";

export interface AssetsStorageEnvDiagnostics {
  /** true se è impostato almeno un bucket (ASSETS o fallback EMAIL_FLOW). */
  configured: boolean;
  /** Nome bucket effettivo o null. */
  bucket: string | null;
  /** Quale variabile ha fornito il bucket. */
  bucketSource: AssetsBucketSource;
  /** Regione SDK (default allineato a assets-s3). */
  region: string;
  /** Presenza di AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY (valori non esposti). */
  awsCredentialsConfigured: boolean;
}

export interface AssetsStorageProbeResult {
  /** false se bucket o credenziali assenti: nessuna chiamata AWS. */
  attempted: boolean;
  ok: boolean;
  errorCode?: string;
  message?: string;
}

function createAssetsS3Client(): S3Client {
  const region = process.env.AWS_REGION?.trim() || "eu-west-1";
  return new S3Client({ region });
}

export function getAssetsStorageEnvDiagnostics(): AssetsStorageEnvDiagnostics {
  const assets = process.env.ASSETS_S3_BUCKET?.trim();
  const email = process.env.EMAIL_FLOW_S3_BUCKET?.trim();
  const bucket = assets || email || null;
  const bucketSource: AssetsBucketSource = assets ? "ASSETS_S3_BUCKET" : email ? "EMAIL_FLOW_S3_BUCKET" : "none";
  const region = process.env.AWS_REGION?.trim() || "eu-west-1";
  const awsCredentialsConfigured = Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
  return {
    configured: Boolean(bucket),
    bucket,
    bucketSource,
    region,
    awsCredentialsConfigured,
  };
}

export async function probeAssetsStorageBucket(): Promise<AssetsStorageProbeResult> {
  const env = getAssetsStorageEnvDiagnostics();
  if (!env.configured || !env.bucket) {
    return { attempted: false, ok: false, message: "Bucket non configurato (ASSETS_S3_BUCKET o EMAIL_FLOW_S3_BUCKET)" };
  }
  if (!env.awsCredentialsConfigured) {
    return {
      attempted: false,
      ok: false,
      message: "Credenziali AWS mancanti (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
    };
  }
  try {
    const client = createAssetsS3Client();
    await client.send(new HeadBucketCommand({ Bucket: env.bucket }));
    return { attempted: true, ok: true };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      attempted: true,
      ok: false,
      errorCode: typeof err.name === "string" ? err.name : "Error",
      message: typeof err.message === "string" ? err.message.slice(0, 300) : "HeadBucket failed",
    };
  }
}

export async function getAssetsStorageDiagnostics(options: {
  probe: boolean;
}): Promise<{ env: AssetsStorageEnvDiagnostics; probe?: AssetsStorageProbeResult }> {
  const env = getAssetsStorageEnvDiagnostics();
  if (!options.probe) {
    return { env };
  }
  const probe = await probeAssetsStorageBucket();
  return { env, probe };
}
