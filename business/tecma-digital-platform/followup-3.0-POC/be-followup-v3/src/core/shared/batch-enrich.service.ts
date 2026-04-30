import { ObjectId, type Db } from "mongodb";
import { namesFromDoc } from "../clients/client-name.util.js";

export async function batchLoadClientNames(
  db: Db,
  clientIds: string[]
): Promise<Record<string, string>> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const map: Record<string, string> = {};
  const collection = db.collection("tz_clients");
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (typeof (collection as { find?: unknown }).find === "function" && objectIds.length > 0) {
    const rowsRaw = await collection
      .find({ _id: { $in: objectIds } })
      .project({ _id: 1, fullName: 1, firstName: 1, lastName: 1 })
      .toArray();
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    for (const row of rows) {
      const id =
        row._id instanceof ObjectId
          ? row._id.toHexString()
          : typeof row._id === "string"
            ? row._id
            : "";
      if (!id) continue;
      const n = namesFromDoc(row as Record<string, unknown>);
      map[id] = n.fullName && n.fullName !== "-" ? n.fullName : id;
    }
  } else if (typeof (collection as { findOne?: unknown }).findOne === "function") {
    for (const id of ids) {
      if (!ObjectId.isValid(id)) continue;
      const row = await collection.findOne(
        { _id: new ObjectId(id) },
        { projection: { _id: 1, fullName: 1, firstName: 1, lastName: 1 } }
      );
      if (row) {
        const n = namesFromDoc(row as Record<string, unknown>);
        map[id] = n.fullName && n.fullName !== "-" ? n.fullName : id;
      }
    }
  }
  ids.forEach((id) => {
    if (!map[id]) map[id] = id;
  });
  return map;
}

export async function batchLoadApartmentCodes(
  db: Db,
  apartmentIds: string[]
): Promise<Record<string, string>> {
  const ids = [...new Set(apartmentIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const map: Record<string, string> = {};
  const collection = db.collection("tz_apartments");
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (typeof (collection as { find?: unknown }).find === "function" && objectIds.length > 0) {
    const rowsRaw = await collection
      .find({ _id: { $in: objectIds } })
      .project({ _id: 1, code: 1 })
      .toArray();
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    for (const row of rows) {
      const id =
        row._id instanceof ObjectId
          ? row._id.toHexString()
          : typeof row._id === "string"
            ? row._id
            : "";
      if (!id) continue;
      map[id] = typeof row.code === "string" ? row.code : id;
    }
  } else if (typeof (collection as { findOne?: unknown }).findOne === "function") {
    for (const id of ids) {
      if (!ObjectId.isValid(id)) continue;
      const row = await collection.findOne({ _id: new ObjectId(id) }, { projection: { _id: 1, code: 1 } });
      if (row && typeof (row as { code?: string }).code === "string") {
        map[id] = (row as unknown as { code: string }).code;
      }
    }
  }
  ids.forEach((id) => {
    if (!map[id]) map[id] = id;
  });
  return map;
}
