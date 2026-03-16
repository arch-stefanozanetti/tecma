/**
 * Product Discovery: scoring weights (Lists from Excel demo).
 * Score for a customer need = severityWeight × frequencyWeight × impactWeight.
 * Normalized keys: lowercase, spaces → underscores for lookup.
 */

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/\+/g, "");

/** Severity → weight (Blocking=3, High friction=2, Minor=1, Pattern=4) */
export const SEVERITY_WEIGHTS: Record<string, number> = {
  blocking: 3,
  high_friction: 2,
  minor: 1,
  pattern: 4,
};

/** Frequency → weight (1 customer=1, 2-3=2, 4+=3, nice to have=1) */
export const FREQUENCY_WEIGHTS: Record<string, number> = {
  "1_customer": 1,
  "1_customers": 1,
  "2-3_customers": 2,
  "2_3_customers": 2,
  "4+_customers": 3,
  "4_customers": 3,
  nice_to_have: 1,
};

/** Business impact → weight (Deal blocker=3, Upsell=2, Efficiency=2) */
export const IMPACT_WEIGHTS: Record<string, number> = {
  deal_blocker: 3,
  upsell: 2,
  efficiency: 2,
};

function getSeverityWeight(severity: string | undefined): number {
  if (!severity?.trim()) return 1;
  const key = normalize(severity);
  return SEVERITY_WEIGHTS[key] ?? 1;
}

function getFrequencyWeight(frequency: string | undefined): number {
  if (!frequency?.trim()) return 1;
  const key = normalize(frequency);
  return FREQUENCY_WEIGHTS[key] ?? 1;
}

function getImpactWeight(businessImpact: string | undefined): number {
  if (!businessImpact?.trim()) return 1;
  const key = normalize(businessImpact);
  return IMPACT_WEIGHTS[key] ?? 1;
}

/**
 * Compute need score = severityWeight × frequencyWeight × impactWeight.
 * Used when returning customer needs (computed on read).
 */
export function computeNeedScore(need: {
  severity?: string;
  frequency?: string;
  business_impact?: string;
}): number {
  const s = getSeverityWeight(need.severity);
  const f = getFrequencyWeight(need.frequency);
  const i = getImpactWeight(need.business_impact);
  return s * f * i;
}
