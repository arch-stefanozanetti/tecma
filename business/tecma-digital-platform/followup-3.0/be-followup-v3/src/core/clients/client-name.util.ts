/**
 * Normalizza nome/cognome da documenti tz_clients (campi espliciti o legacy fullName).
 */

export function splitLegacyFullName(fullName: string): { firstName: string; lastName: string } {
  const t = (fullName || "").trim();
  if (!t) return { firstName: "", lastName: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "" };
  return { firstName: t.slice(0, i).trim(), lastName: t.slice(i + 1).trim() };
}

export function joinClientFullName(firstName: string, lastName: string): string {
  return `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
}

export interface ClientNameParts {
  firstName: string;
  lastName: string;
  fullName: string;
}

export function namesFromDoc(doc: Record<string, unknown>): ClientNameParts {
  const fnRaw = typeof doc.firstName === "string" ? doc.firstName.trim() : "";
  const lnRaw = typeof doc.lastName === "string" ? doc.lastName.trim() : "";
  const legacyFull = typeof doc.fullName === "string" ? doc.fullName.trim() : "";

  if (fnRaw || lnRaw) {
    const full = joinClientFullName(fnRaw, lnRaw) || legacyFull || "-";
    return { firstName: fnRaw, lastName: lnRaw, fullName: full || "-" };
  }

  const split = splitLegacyFullName(legacyFull);
  const full = joinClientFullName(split.firstName, split.lastName) || legacyFull || "-";
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    fullName: full || "-",
  };
}
