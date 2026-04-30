import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { deleteObject, getPresignedGetUrl, putObjectBuffer } from "../assets/assets-s3.service.js";
import { namesFromDoc } from "../clients/client-name.util.js";
import {
  getRequestById,
  updateRequestStatus,
  type RequestRow,
} from "../requests/requests.service.js";

const COLLECTION = "tz_quotes";

/** Riga quote per liste interne (CRM). */
export interface QuoteListRow {
  _id: string;
  workspaceId: string;
  projectId: string;
  requestId?: string;
  clientId?: string;
  quoteNumber: string;
  status: string;
  totalPrice?: number;
  expiryOn?: string;
  /** True se esiste flusso pubblico (token hash persistito). */
  hasDigitalLink: boolean;
  pdfStorageKey?: string | null;
  createdAt: string;
  updatedAt: string;
  legacyClientId?: string | null;
  legacyApartmentId?: string | null;
  migrationLegacyId?: string;
}

const quoteSortable: Record<string, 1> = {
  createdAt: 1,
  updatedAt: 1,
  quoteNumber: 1,
  status: 1,
  totalPrice: 1,
};

const buildQuoteMatch = (q: ListQueryInput) => {
  const conditions: Record<string, unknown>[] = [
    { workspaceId: q.workspaceId },
    { projectId: { $in: q.projectIds } },
  ];

  const requestId = q.filters?.requestId;
  if (typeof requestId === "string" && requestId.trim() && ObjectId.isValid(requestId.trim())) {
    conditions.push({ requestId: requestId.trim() });
  }

  const status = q.filters?.status;
  if (typeof status === "string" && status.trim()) {
    conditions.push({ status: status.trim() });
  }

  return { $and: conditions };
};

const mapDocToQuoteListRow = (doc: Record<string, unknown>): QuoteListRow => {
  const tokenHash = doc.tokenHash;
  const mig = doc.migration as Record<string, unknown> | undefined;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
    workspaceId: typeof doc.workspaceId === "string" ? doc.workspaceId : "",
    projectId: typeof doc.projectId === "string" ? doc.projectId : "",
    requestId: typeof doc.requestId === "string" ? doc.requestId : undefined,
    clientId: typeof doc.clientId === "string" ? doc.clientId : undefined,
    quoteNumber: typeof doc.quoteNumber === "string" ? doc.quoteNumber : "",
    status: typeof doc.status === "string" ? doc.status : "",
    totalPrice: typeof doc.totalPrice === "number" ? doc.totalPrice : undefined,
    expiryOn:
      doc.expiryOn instanceof Date
        ? doc.expiryOn.toISOString()
        : typeof doc.expiryOn === "string"
          ? doc.expiryOn
          : undefined,
    hasDigitalLink: typeof tokenHash === "string" && tokenHash.length > 0,
    pdfStorageKey:
      doc.pdfStorageKey === null || doc.pdfStorageKey === undefined
        ? null
        : typeof doc.pdfStorageKey === "string"
          ? doc.pdfStorageKey
          : null,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : typeof doc.createdAt === "string"
          ? doc.createdAt
          : "",
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : typeof doc.updatedAt === "string"
          ? doc.updatedAt
          : "",
    legacyClientId: typeof doc.legacyClientId === "string" ? doc.legacyClientId : null,
    legacyApartmentId: typeof doc.legacyApartmentId === "string" ? doc.legacyApartmentId : null,
    migrationLegacyId: typeof mig?.legacyId === "string" ? mig.legacyId : undefined,
  };
};

/**
 * Elenco paginato quote per workspace/progetti (ListQuery).
 */
export async function queryQuotes(rawInput: unknown): Promise<PaginatedResponse<QuoteListRow>> {
  const input = ListQuerySchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection(COLLECTION);

  const match = buildQuoteMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);
  const sortField =
    input.sort?.field && quoteSortable[input.sort.field] ? input.sort.field : "createdAt";
  const sortDirection = input.sort?.direction ?? -1;

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(match),
  ]);

  const data: QuoteListRow[] = rawData.map((doc) => mapDocToQuoteListRow(doc as Record<string, unknown>));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage) || 0,
    },
  };
}

const CreateDigitalQuoteSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  requestId: z.string().min(1),
  totalPrice: z.number().nonnegative(),
  /** ISO date o YYYY-MM-DD */
  expiryOn: z.string().min(1),
});

const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw, "utf8").digest("hex");

function buildQuotePdfBuffer(params: {
  quoteNumber: string;
  clientName: string;
  apartmentLabel?: string;
  totalPrice: number;
  expiryLabel: string;
  typeLabel: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(`Preventivo ${params.quoteNumber}`, { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(11).fillColor("#333333");
    doc.text(`Cliente: ${params.clientName}`);
    if (params.apartmentLabel) {
      doc.text(`Unità: ${params.apartmentLabel}`);
    }
    doc.text(`Trattativa: ${params.typeLabel}`);
    doc.moveDown();
    doc.fontSize(12).text(`Importo: ${params.totalPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`);
    doc.text(`Validità: ${params.expiryLabel}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor("#666666").text("Documento generato digitalmente da Tecma Followup.", {
      align: "center",
    });
    doc.end();
  });
}

function parseExpiryToIso(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T23:59:59.000Z`);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.valueOf())) {
    throw new HttpError("Data di scadenza non valida", 400);
  }
  return d.toISOString();
}

export async function createDigitalQuote(
  rawInput: unknown,
  options?: { userId?: string }
): Promise<{
  data: {
    quoteId: string;
    quoteNumber: string;
    publicUrl: string;
    expiryOn: string;
    request: RequestRow;
  };
}> {
  const input = CreateDigitalQuoteSchema.parse(rawInput);
  const expiryIso = parseExpiryToIso(input.expiryOn);

  const { request } = await getRequestById(input.requestId);
  if (request.workspaceId !== input.workspaceId) {
    throw new HttpError("Request not found", 404);
  }
  if (request.projectId !== input.projectId) {
    throw new HttpError("Progetto non coerente con la trattativa", 400);
  }
  if (request.status === "quote" && request.quoteId) {
    throw new HttpError("Preventivo già presente per questa trattativa", 409);
  }

  const db = getDb();
  const clientDoc = await db.collection("tz_clients").findOne({
    _id: new ObjectId(request.clientId),
  });
  const clientName = clientDoc
    ? namesFromDoc(clientDoc as Record<string, unknown>).fullName || request.clientName || request.clientId
    : request.clientName || request.clientId;

  const apartmentLabel =
    request.apartmentCode ?? (request.apartmentId ? String(request.apartmentId) : undefined);
  const typeLabel = request.type === "rent" ? "Affitto" : "Vendita";

  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const quoteNumber = `Q-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();

  const insertDoc: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    requestId: input.requestId,
    clientId: request.clientId,
    quoteNumber,
    totalPrice: input.totalPrice,
    expiryOn: expiryIso,
    status: "sent",
    tokenHash,
    pdfStorageKey: null,
    createdAt: now,
    updatedAt: now,
    createdBy: options?.userId ?? null,
  };

  const inserted = await db.collection(COLLECTION).insertOne(insertDoc);
  const quoteId = inserted.insertedId.toHexString();
  const storageKey = `workspaces/${input.workspaceId}/quotes/${quoteId}.pdf`;

  let pdfUploaded = false;
  try {
    const pdfBuffer = await buildQuotePdfBuffer({
      quoteNumber,
      clientName,
      apartmentLabel,
      totalPrice: input.totalPrice,
      expiryLabel: new Date(expiryIso).toLocaleDateString("it-IT"),
      typeLabel,
    });
    await putObjectBuffer(storageKey, pdfBuffer, "application/pdf");
    pdfUploaded = true;

    await db.collection(COLLECTION).updateOne(
      { _id: inserted.insertedId },
      { $set: { pdfStorageKey: storageKey, updatedAt: new Date().toISOString() } }
    );

    const statusResult = await updateRequestStatus(
      input.requestId,
      {
        status: "quote",
        quoteId,
        quoteNumber,
        quoteTotalPrice: input.totalPrice,
        quoteExpiryOn: expiryIso,
        quoteStatus: "sent",
      },
      { userId: options?.userId }
    );

    return {
      data: {
        quoteId,
        quoteNumber,
        /** Path relativo alla base API (es. `http://host/v1` + `publicUrl`). */
        publicUrl: `/public/quotes/${token}`,
        expiryOn: expiryIso,
        request: statusResult.request,
      },
    };
  } catch (err) {
    await db.collection(COLLECTION).deleteOne({ _id: inserted.insertedId });
    if (pdfUploaded) {
      await deleteObject(storageKey).catch(() => undefined);
    }
    throw err;
  }
}

export async function getQuotePublicByToken(
  rawToken: string
): Promise<{
  data: {
    found: boolean;
    quoteNumber?: string;
    totalPrice?: number;
    expiryOn?: string;
    pdfDownloadUrl?: string;
    pdfExpiresAt?: string;
    clientName?: string;
  };
}> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) {
    return { data: { found: false } };
  }
  const tokenHash = hashToken(token);
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ tokenHash, status: "sent" });
  if (!doc) {
    return { data: { found: false } };
  }

  const expiryOn =
    doc.expiryOn instanceof Date
      ? doc.expiryOn.toISOString()
      : typeof doc.expiryOn === "string"
        ? doc.expiryOn
        : "";
  if (expiryOn && new Date(expiryOn).getTime() < Date.now()) {
    return { data: { found: false } };
  }

  const quoteNumber = typeof doc.quoteNumber === "string" ? doc.quoteNumber : "";
  const totalPrice = typeof doc.totalPrice === "number" ? doc.totalPrice : 0;
  const clientId = typeof doc.clientId === "string" ? doc.clientId : "";
  let clientName: string | undefined;
  if (clientId && ObjectId.isValid(clientId)) {
    const c = await db.collection("tz_clients").findOne({ _id: new ObjectId(clientId) });
    if (c) {
      const n = namesFromDoc(c as Record<string, unknown>);
      if (n.fullName && n.fullName !== "-") clientName = n.fullName;
    }
  }

  const pdfStorageKey = typeof doc.pdfStorageKey === "string" ? doc.pdfStorageKey : null;
  let pdfDownloadUrl: string | undefined;
  let pdfExpiresAt: string | undefined;
  if (pdfStorageKey) {
    const signed = await getPresignedGetUrl(pdfStorageKey, 15 * 60, {
      entityType: "quote",
      entityId: String(doc._id ?? ""),
      workspaceId: typeof doc.workspaceId === "string" ? doc.workspaceId : undefined,
      projectId: typeof doc.projectId === "string" ? doc.projectId : undefined,
    });
    pdfDownloadUrl = signed.downloadUrl;
    pdfExpiresAt = signed.expiresAt.toISOString();
  }

  return {
    data: {
      found: true,
      quoteNumber,
      totalPrice,
      expiryOn,
      pdfDownloadUrl,
      pdfExpiresAt,
      clientName,
    },
  };
}
