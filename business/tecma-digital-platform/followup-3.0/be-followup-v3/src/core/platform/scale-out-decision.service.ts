import { getDb } from "../../config/db.js";

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export const evaluateScaleOutDecision = async (workspaceId: string): Promise<Record<string, unknown>> => {
  const db = getDb();
  const [platformUsage, dispatchFailures, notificationsCount, signatureOps, marketingOps] = await Promise.all([
    db.collection("tz_platform_api_usage").countDocuments({ workspaceId }),
    db.collection("tz_automation_dispatch_log").countDocuments({ workspaceId, status: "failed" }),
    db.collection("tz_notifications").countDocuments({ workspaceId, createdAt: { $gte: new Date(daysAgoIso(30)) } }),
    db.collection("tz_signature_requests").countDocuments({ workspaceId, createdAt: { $gte: daysAgoIso(30) } }),
    db.collection("tz_marketing_enrollments").countDocuments({ workspaceId, createdAt: { $gte: daysAgoIso(30) } }),
  ]);

  const candidates = [
    {
      domain: "notifications",
      score: notificationsCount > 50_000 ? 9 : notificationsCount > 10_000 ? 7 : 4,
      rationale: "volume based on 30d notifications",
    },
    {
      domain: "document-signing",
      score: signatureOps > 2_000 ? 8 : signatureOps > 500 ? 6 : 3,
      rationale: "signature operations 30d",
    },
    {
      domain: "automation-engine",
      score: dispatchFailures > 500 ? 9 : dispatchFailures > 100 ? 7 : 4,
      rationale: "failure pressure on automation dispatch",
    },
    {
      domain: "reporting-pipeline",
      score: platformUsage > 120_000 ? 8 : platformUsage > 20_000 ? 6 : 3,
      rationale: "platform consumption and external reuse",
    },
    {
      domain: "marketing-automation",
      score: marketingOps > 20_000 ? 8 : marketingOps > 5_000 ? 6 : 3,
      rationale: "marketing enrollment load",
    },
  ];

  const extractNow = candidates.filter((c) => c.score >= 8).map((c) => c.domain);
  const recommendation =
    extractNow.length > 0
      ? "selective_microservices"
      : "modular_monolith_boundaries";

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    metrics: {
      platformUsage30d: platformUsage,
      dispatchFailuresTotal: dispatchFailures,
      notifications30d: notificationsCount,
      signatureOps30d: signatureOps,
      marketingOps30d: marketingOps,
    },
    candidates,
    recommendation,
    extractNow,
    criteria: {
      ownership: "required",
      independentScaling: "required",
      distinctSLA: "required",
      externalReuse: "required",
    },
  };
};

