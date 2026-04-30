import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "../../test-utils";
import { ImageAssetField } from "./ImageAssetField";

vi.mock("../../api/domains/storageApi", () => ({
  storageApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        bucket: "tecma-assets-coll",
        prefix: "initiatives/Progetto/",
        folders: ["initiatives/Progetto/global/img/"],
        files: [{ key: "initiatives/Progetto/global/img/logo.png", size: 100 }],
      },
    }),
    createUploadUrl: vi.fn().mockResolvedValue({
      data: {
        bucket: "tecma-assets-coll",
        key: "initiatives/Progetto/global/img/logo.png",
        uploadUrl: "https://signed.example",
        expiresAt: new Date().toISOString(),
        publicUrl: "https://cdn.example/logo.png",
      },
    }),
    uploadToSignedUrl: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue({ data: { bucket: "tecma-assets-coll", folderKey: "x/" } }),
    bootstrap: vi.fn().mockResolvedValue({ data: { bucket: "tecma-assets-coll", folders: [] } }),
  },
}));

describe("ImageAssetField", () => {
  it("renderizza i tab e carica la libreria storage", async () => {
    const onChange = vi.fn();
    render(<ImageAssetField workspaceId="ws1" projectId="p1" value="" onChange={onChange} />);
    expect(await screen.findByRole("tab", { name: /carica/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /libreria/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /url esterno/i })).toBeInTheDocument();
    expect(screen.getByText(/carica su bucket oci/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("prefix cartella"), {
      target: { value: "initiatives/Progetto/global/img/" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

