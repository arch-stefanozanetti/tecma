import type { Document } from "mongodb";
import {
  shouldApplyEntityAssignmentListFilter,
  useStrictEntityAssignmentOnly,
  viewerAssignmentUserId,
  type EntityAssignmentListViewer,
} from "./entity-assignment-query.util.js";

/** Pipeline $lookup + $match per visibilità entity-assignment su client o apartment. */
export function entityAssignmentVisibilityStages(
  workspaceId: string,
  viewer: EntityAssignmentListViewer | undefined,
  entityType: "client" | "apartment",
  entityIdExpr: string = "{ $toString: \"$_id\" }"
): Document[] {
  if (!shouldApplyEntityAssignmentListFilter(viewer)) return [];

  const viewerId = viewerAssignmentUserId(viewer!);
  const strict = useStrictEntityAssignmentOnly(viewer);
  const lookupField = entityType === "client" ? "cid" : "aid";

  return [
    {
      $lookup: {
        from: "tz_entity_assignments",
        let: { [lookupField]: entityIdExpr.startsWith("{") ? entityIdExpr : { $toString: entityIdExpr } },
        pipeline: [
          {
            $match: {
              workspaceId,
              entityType,
              $expr: { $eq: ["$entityId", `$$${lookupField}`] },
            },
          },
        ],
        as: "__ea",
      },
    },
    {
      $match: strict
        ? { "__ea.0.userId": viewerId }
        : { $or: [{ __ea: { $size: 0 } }, { "__ea.0.userId": viewerId }] },
    },
  ];
}

/** Visibilità evento calendario: se ha clientId, stesse regole del cliente. */
export function calendarEntityAssignmentVisibilityStages(
  workspaceId: string,
  viewer: EntityAssignmentListViewer | undefined
): Document[] {
  if (!shouldApplyEntityAssignmentListFilter(viewer)) return [];

  const viewerId = viewerAssignmentUserId(viewer!);
  const strict = useStrictEntityAssignmentOnly(viewer);

  const clientVisible = strict
    ? {
        $or: [
          { clientId: { $exists: false } },
          { clientId: null },
          { clientId: "" },
          { "__client_ea.0.userId": viewerId },
        ],
      }
    : {
        $or: [
          { clientId: { $exists: false } },
          { clientId: null },
          { clientId: "" },
          { __client_ea: { $size: 0 } },
          { "__client_ea.0.userId": viewerId },
        ],
      };

  return [
    {
      $lookup: {
        from: "tz_entity_assignments",
        let: { cid: { $toString: "$clientId" } },
        pipeline: [
          {
            $match: {
              workspaceId,
              entityType: "client",
              $expr: { $eq: ["$entityId", "$$cid"] },
            },
          },
        ],
        as: "__client_ea",
      },
    },
    { $match: clientVisible },
  ];
}

/** Visibilità request: cliente visibile e (se presente) appartamento visibile. */
export function requestEntityAssignmentVisibilityStages(
  workspaceId: string,
  viewer: EntityAssignmentListViewer | undefined
): Document[] {
  if (!shouldApplyEntityAssignmentListFilter(viewer)) return [];

  const viewerId = viewerAssignmentUserId(viewer!);
  const strict = useStrictEntityAssignmentOnly(viewer);

  const clientMatch = strict
    ? { "__client_ea.0.userId": viewerId }
    : { $or: [{ __client_ea: { $size: 0 } }, { "__client_ea.0.userId": viewerId }] };

  const aptMatch = strict
    ? {
        $or: [
          { apartmentId: { $exists: false } },
          { apartmentId: null },
          { apartmentId: "" },
          { "__apt_ea.0.userId": viewerId },
        ],
      }
    : {
        $or: [
          { apartmentId: { $exists: false } },
          { apartmentId: null },
          { apartmentId: "" },
          { __apt_ea: { $size: 0 } },
          { "__apt_ea.0.userId": viewerId },
        ],
      };

  return [
    {
      $lookup: {
        from: "tz_entity_assignments",
        let: { cid: { $toString: "$clientId" } },
        pipeline: [
          {
            $match: {
              workspaceId,
              entityType: "client",
              $expr: { $eq: ["$entityId", "$$cid"] },
            },
          },
        ],
        as: "__client_ea",
      },
    },
    { $match: clientMatch },
    {
      $lookup: {
        from: "tz_entity_assignments",
        let: { aid: { $toString: "$apartmentId" } },
        pipeline: [
          {
            $match: {
              workspaceId,
              entityType: "apartment",
              $expr: { $eq: ["$entityId", "$$aid"] },
            },
          },
        ],
        as: "__apt_ea",
      },
    },
    { $match: aptMatch },
  ];
}
