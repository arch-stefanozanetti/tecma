import { getJson, postJson } from "../http";

export const storageApi = {
  list: (workspaceId: string, params?: { projectId?: string; bucket?: string; prefix?: string }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("projectId", params.projectId);
    if (params?.bucket) q.set("bucket", params.bucket);
    if (params?.prefix) q.set("prefix", params.prefix);
    const query = q.toString();
    return getJson<{
      data: {
        bucket: string;
        prefix: string;
        folders: string[];
        files: Array<{ key: string; size: number; lastModified?: string }>;
      };
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/storage/list${query ? `?${query}` : ""}`);
  },
  createUploadUrl: (
    workspaceId: string,
    body: {
      projectId?: string;
      bucket?: string;
      prefix?: string;
      fileName: string;
      mimeType: string;
      sizeBytes?: number;
    }
  ) =>
    postJson<{
      data: {
        bucket: string;
        key: string;
        uploadUrl: string;
        expiresAt: string;
        publicUrl: string | null;
      };
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/storage/upload-url`, body),
  createFolder: (workspaceId: string, body: { projectId?: string; bucket?: string; prefix: string }) =>
    postJson<{ data: { bucket: string; folderKey: string } }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/storage/folders`,
      body
    ),
  bootstrap: (workspaceId: string, body: { projectId: string; bucket?: string }) =>
    postJson<{ data: { bucket: string; folders: string[] } }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/storage/bootstrap`,
      body
    ),
  uploadToSignedUrl: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!res.ok) throw new Error(`Upload fallito (${res.status})`);
  },
};

