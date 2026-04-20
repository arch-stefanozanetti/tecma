/**
 * Sync 1-way: tz_apartments → Webflow CMS collection (Data API v2).
 * La collection Webflow deve avere campi con slug coerenti (vedi messaggio errore / doc).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { getWebflowSecrets } from "./webflow-config.service.js";

const MAP_COLLECTION = "tz_webflow_item_map";

const WF_API = "https://api.webflow.com/v2";

/**
 * Slug campi custom nella collection Webflow (creali con gli stessi slug).
 * `name` e `slug` sono i campi CMS standard.
 */
const DEFAULT_SLUGS = {
  tecmaId: "tecma-apartment-id",
  price: "prezzo-eur",
  status: "stato",
  mode: "modalita",
  code: "codice-unita",
  planimetry: "planimetria-url",
};

export const WebflowSyncBodySchema = z.object({
  projectIds: z.array(z.string().min(1)).min(1),
});

export type WebflowSyncResult = {
  synced: number;
  created: number;
  updated: number;
  errors: Array<{ apartmentId: string; message: string }>;
};

async function wfFetch(
  apiToken: string,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const res = await fetch(`${WF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function syncApartmentsToWebflow(
  workspaceId: string,
  projectIds: string[]
): Promise<WebflowSyncResult> {
  const secrets = await getWebflowSecrets(workspaceId);
  if (!secrets) throw new HttpError("Webflow non configurato", 400);

  const { apiToken, apartmentsCollectionId } = secrets;
  const db = getDb();
  const apartments = await db
    .collection("tz_apartments")
    .find({
      workspaceId,
      projectId: { $in: projectIds },
    })
    .project({
      _id: 1,
      code: 1,
      name: 1,
      status: 1,
      mode: 1,
      rawPrice: 1,
      planimetryUrl: 1,
    })
    .toArray();

  const result: WebflowSyncResult = { synced: 0, created: 0, updated: 0, errors: [] };

  for (const apt of apartments) {
    const apartmentId = apt._id instanceof ObjectId ? apt._id.toHexString() : String(apt._id);
    const code = String(apt.code ?? "").trim() || apartmentId;
    const name = String(apt.name ?? code).trim();
    const slug = `u-${code}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
    const price =
      apt.rawPrice && typeof apt.rawPrice === "object" && apt.rawPrice !== null && "amount" in apt.rawPrice
        ? Number((apt.rawPrice as { amount: number }).amount)
        : 0;
    const status = String(apt.status ?? "");
    const mode = String(apt.mode ?? "");

    const fieldData: Record<string, unknown> = {
      name,
      slug,
      [DEFAULT_SLUGS.tecmaId]: apartmentId,
      [DEFAULT_SLUGS.price]: price,
      [DEFAULT_SLUGS.status]: status,
      [DEFAULT_SLUGS.mode]: mode,
      [DEFAULT_SLUGS.code]: code,
    };
    if (typeof apt.planimetryUrl === "string" && apt.planimetryUrl) {
      fieldData[DEFAULT_SLUGS.planimetry] = apt.planimetryUrl;
    }

    try {
      const mapDoc = await db.collection(MAP_COLLECTION).findOne({ workspaceId, apartmentId });
      let webflowItemId = mapDoc?.webflowItemId ? String(mapDoc.webflowItemId) : "";

      if (webflowItemId) {
        const patch = await wfFetch(
          apiToken,
          `/collections/${apartmentsCollectionId}/items/${webflowItemId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ fieldData }),
          }
        );
        if (!patch.ok && patch.status === 404) {
          webflowItemId = "";
        } else if (!patch.ok) {
          throw new Error(
            typeof patch.json === "object" && patch.json && "message" in (patch.json as object)
              ? String((patch.json as { message?: string }).message)
              : patch.text.slice(0, 300)
          );
        } else {
          result.updated += 1;
          result.synced += 1;
          await db.collection(MAP_COLLECTION).updateOne(
            { workspaceId, apartmentId },
            {
              $set: {
                webflowItemId,
                collectionId: apartmentsCollectionId,
                updatedAt: new Date().toISOString(),
              },
            },
            { upsert: true }
          );
          continue;
        }
      }

      if (!webflowItemId) {
        const create = await wfFetch(apiToken, `/collections/${apartmentsCollectionId}/items`, {
          method: "POST",
          body: JSON.stringify({
            isArchived: false,
            isDraft: false,
            fieldData,
          }),
        });
        if (!create.ok) {
          const msg =
            create.json && typeof create.json === "object" && "message" in create.json
              ? String((create.json as { message?: string }).message)
              : create.text.slice(0, 400);
          throw new Error(msg || `HTTP ${create.status}`);
        }
        const data = create.json as { id?: string };
        const newId = data.id;
        if (!newId) throw new Error("Webflow: risposta senza id item");
        webflowItemId = newId;
        result.created += 1;
        result.synced += 1;
        await db.collection(MAP_COLLECTION).updateOne(
          { workspaceId, apartmentId },
          {
            $set: {
              webflowItemId,
              collectionId: apartmentsCollectionId,
              updatedAt: new Date().toISOString(),
            },
          },
          { upsert: true }
        );
      }
    } catch (e) {
      result.errors.push({
        apartmentId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
