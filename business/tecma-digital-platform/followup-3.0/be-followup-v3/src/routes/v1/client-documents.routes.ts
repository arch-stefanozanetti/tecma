import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import {
  getClientDocumentUploadUrl,
  createClientDocument,
  listClientDocuments,
  getClientDocumentDownloadUrl,
  getClientDocumentShareLink,
  deleteClientDocument,
} from "../../core/clients/client-documents.service.js";

export const clientDocumentsRoutes = Router();
const withWorkspaceAccess = requireCanAccessWorkspace("workspaceId");

clientDocumentsRoutes.post(
  "/workspaces/:workspaceId/clients/:clientId/documents/upload-url",
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const clientId = req.params.clientId ?? "";
    const userId = typeof req.user?.sub === "string" ? req.user.sub : "";
    return getClientDocumentUploadUrl(workspaceId, clientId, userId, req.body);
  })
);

clientDocumentsRoutes.post(
  "/workspaces/:workspaceId/clients/:clientId/documents",
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const clientId = req.params.clientId ?? "";
    const userId = typeof req.user?.sub === "string" ? req.user.sub : "";
    const created = await createClientDocument(workspaceId, clientId, userId, req.body);
    return { data: created };
  })
);

clientDocumentsRoutes.get(
  "/workspaces/:workspaceId/clients/:clientId/documents",
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const clientId = req.params.clientId ?? "";
    const list = await listClientDocuments(workspaceId, clientId);
    return { data: list };
  })
);

clientDocumentsRoutes.get(
  "/workspaces/:workspaceId/clients/:clientId/documents/:docId/download-url",
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const clientId = req.params.clientId ?? "";
    const docId = req.params.docId ?? "";
    return getClientDocumentDownloadUrl(workspaceId, clientId, docId);
  })
);

clientDocumentsRoutes.get(
  "/workspaces/:workspaceId/clients/:clientId/documents/:docId/share-link",
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const clientId = req.params.clientId ?? "";
    const docId = req.params.docId ?? "";
    return getClientDocumentShareLink(workspaceId, clientId, docId);
  })
);

clientDocumentsRoutes.delete(
  "/workspaces/:workspaceId/clients/:clientId/documents/:docId",
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const clientId = req.params.clientId ?? "";
    const docId = req.params.docId ?? "";
    const userId = typeof req.user?.sub === "string" ? req.user.sub : "";
    await deleteClientDocument(workspaceId, clientId, docId, userId);
    return { deleted: true };
  })
);
