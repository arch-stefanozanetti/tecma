import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp"
};

export async function uploadEmailFlowAsset(buffer: Buffer, mime: string): Promise<string> {
  const bucket = process.env.EMAIL_FLOW_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() || "eu-west-1";
  if (!bucket) {
    throw new Error("Upload non configurato: imposta EMAIL_FLOW_S3_BUCKET e credenziali AWS");
  }
  const ext = ALLOWED_TYPES[mime];
  if (!ext) {
    throw new Error("Formato non consentito (jpeg, png, gif, webp)");
  }
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("File troppo grande (max 2MB)");
  }
  const key = `email-flows/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const client = new S3Client({ region });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mime
    })
  );
  const base = process.env.EMAIL_FLOW_S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
