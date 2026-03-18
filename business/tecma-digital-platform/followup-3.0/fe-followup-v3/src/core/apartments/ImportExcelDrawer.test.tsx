import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "../../test-utils";
import { ImportExcelDrawer } from "./ImportExcelDrawer";

const mocks = vi.hoisted(() => ({
  unitsImportPreviewMock: vi.fn(),
  unitsImportExecuteMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    unitsImportPreview: mocks.unitsImportPreviewMock,
    unitsImportExecute: mocks.unitsImportExecuteMock,
  },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ toastError: mocks.toastErrorMock }),
}));

describe("ImportExcelDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.unitsImportPreviewMock.mockResolvedValue({
      validRows: [{ unit_code: "A-1" }],
      errors: [],
      duplicates: [],
    });
    mocks.unitsImportExecuteMock.mockResolvedValue({ created: 1, skipped: 0, errors: [] });

    class MockFileReader {
      public result: string | ArrayBuffer | null = null;
      public onload: null | (() => void) = null;
      readAsDataURL() {
        this.result = "data:application/vnd.ms-excel;base64,ZmFrZQ==";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);
  });

  it("mostra bottone anteprima dopo selezione file e carica preview", async () => {
    render(
      <ImportExcelDrawer open onOpenChange={vi.fn()} workspaceId="ws-1" projectId="p-1" />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["fake"], "units.xlsx", { type: "application/vnd.ms-excel" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /carica e anteprima/i }));

    expect(
      (await screen.findAllByText((_, element) => element?.textContent?.includes("righe valide") ?? false)).length
    ).toBeGreaterThan(0);
    expect(mocks.unitsImportPreviewMock).toHaveBeenCalledWith("ws-1", "p-1", "ZmFrZQ==");
  });

  it("esegue import e mostra risultato", async () => {
    const onImported = vi.fn();
    render(
      <ImportExcelDrawer open onOpenChange={vi.fn()} workspaceId="ws-1" projectId="p-1" onImported={onImported} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(["fake"], "units.xlsx", { type: "application/vnd.ms-excel" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: /carica e anteprima/i }));
    expect(
      (await screen.findAllByText((_, element) => element?.textContent?.includes("righe valide") ?? false)).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^importa$/i }));

    expect(await screen.findByText(/creati:/i)).toBeInTheDocument();
    expect(mocks.unitsImportExecuteMock).toHaveBeenCalledWith(
      "ws-1",
      "p-1",
      [{ unit_code: "A-1" }],
      "skip"
    );
    expect(onImported).toHaveBeenCalled();
  });
});
