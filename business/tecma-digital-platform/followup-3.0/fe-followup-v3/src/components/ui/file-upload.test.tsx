import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { FileUpload } from "./file-upload";

describe("FileUpload", () => {
  it("rende titolo e zona con role button quando showButton è false", () => {
    render(<FileUpload title="Carica documento" />);
    expect(screen.getByText("Carica documento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /carica file/i })).toBeInTheDocument();
  });

  it("rende subtitle e pulsante Upload quando showButton è true", () => {
    render(
      <FileUpload
        title="Drop zone"
        subtitle="Solo PDF"
        showButton
      />
    );
    expect(screen.getByText("Drop zone")).toBeInTheDocument();
    expect(screen.getByText("Solo PDF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("mostra errorMessage quando presente", () => {
    render(
      <FileUpload title="Upload" errorMessage="File non valido" />
    );
    expect(screen.getByText("File non valido")).toBeInTheDocument();
  });

  it("mostra lista file e chiama onRemoveFile al click su rimuovi", async () => {
    const user = userEvent.setup();
    const onRemoveFile = vi.fn();
    render(
      <FileUpload
        title="Upload"
        files={[{ id: "1", name: "doc.pdf" }]}
        onRemoveFile={onRemoveFile}
      />
    );
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
    const remove = screen.getByRole("button", { name: /rimuovi doc\.pdf/i });
    await user.click(remove);
    expect(onRemoveFile).toHaveBeenCalledWith("1");
  });
});
