import { describe, it, expect, beforeEach } from "vitest";
import { getAssetsStorageEnvDiagnostics } from "./storage-diagnostics.service.js";

describe("storage-diagnostics.service", () => {
  const envKeys = [
    "ASSETS_S3_BUCKET",
    "EMAIL_FLOW_S3_BUCKET",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ] as const;

  beforeEach(() => {
    envKeys.forEach((k) => {
      delete process.env[k];
    });
  });

  it("configured false quando nessun bucket", () => {
    const d = getAssetsStorageEnvDiagnostics();
    expect(d.configured).toBe(false);
    expect(d.bucket).toBeNull();
    expect(d.bucketSource).toBe("none");
    expect(d.awsCredentialsConfigured).toBe(false);
  });

  it("preferisce ASSETS_S3_BUCKET su EMAIL_FLOW", () => {
    process.env.ASSETS_S3_BUCKET = "assets-b";
    process.env.EMAIL_FLOW_S3_BUCKET = "email-b";
    const d = getAssetsStorageEnvDiagnostics();
    expect(d.configured).toBe(true);
    expect(d.bucket).toBe("assets-b");
    expect(d.bucketSource).toBe("ASSETS_S3_BUCKET");
  });

  it("usa EMAIL_FLOW se ASSETS assente", () => {
    process.env.EMAIL_FLOW_S3_BUCKET = "email-only";
    const d = getAssetsStorageEnvDiagnostics();
    expect(d.bucketSource).toBe("EMAIL_FLOW_S3_BUCKET");
    expect(d.bucket).toBe("email-only");
  });

  it("rileva credenziali AWS quando entrambe presenti", () => {
    process.env.ASSETS_S3_BUCKET = "b";
    process.env.AWS_ACCESS_KEY_ID = "AKIA";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    const d = getAssetsStorageEnvDiagnostics();
    expect(d.awsCredentialsConfigured).toBe(true);
  });
});
