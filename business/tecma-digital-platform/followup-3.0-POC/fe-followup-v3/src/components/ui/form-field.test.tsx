import { describe, it, expect, render, screen } from "../../test-utils";
import { FormField, useFormField } from "./form-field";
import { Input } from "./input";

describe("FormField", () => {
  it("rende label e children", () => {
    render(
      <FormField label="Nome campo">
        <Input placeholder="Scrivi..." />
      </FormField>
    );
    expect(screen.getByText("Nome campo")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/scrivi/i)).toBeInTheDocument();
  });

  it("mostra asterisco quando required=true", () => {
    render(
      <FormField label="Obbligatorio" required>
        <Input />
      </FormField>
    );
    const label = screen.getByText(/obbligatorio/i);
    expect(label.closest("label")).toHaveTextContent("*");
  });

  it("mostra (optional) quando optional=true e non required", () => {
    render(
      <FormField label="Opzionale" optional>
        <Input />
      </FormField>
    );
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("mostra helperText sotto il control", () => {
    render(
      <FormField label="Campo" helperText="Testo di aiuto">
        <Input />
      </FormField>
    );
    expect(screen.getByText("Testo di aiuto")).toBeInTheDocument();
  });

  it("applica testo rosso all'helper quando invalid=true", () => {
    render(
      <FormField label="Campo" helperText="Errore" invalid>
        <Input />
      </FormField>
    );
    const helper = screen.getByText("Errore");
    expect(helper).toHaveClass("text-destructive");
    expect(helper).toHaveAttribute("role", "alert");
  });

  it("imposta data-invalid sul wrapper quando invalid=true", () => {
    const { container } = render(
      <FormField label="X" invalid>
        <Input />
      </FormField>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute("data-invalid", "true");
  });

  it("collega label al control via id quando Input è figlio (useFormField)", () => {
    render(
      <FormField label="Campo con id" id="my-field">
        <Input placeholder="Input" />
      </FormField>
    );
    const input = screen.getByPlaceholderText(/input/i);
    expect(input).toHaveAttribute("id", "my-field");
    expect(screen.getByText("Campo con id")).toHaveAttribute("for", "my-field");
  });

  it("passa aria-describedby al control quando c'è helperText", () => {
    render(
      <FormField label="Campo" id="f1" helperText="Helper">
        <Input placeholder="X" />
      </FormField>
    );
    const input = screen.getByPlaceholderText(/^x$/i);
    expect(input).toHaveAttribute("aria-describedby", "f1-helper");
  });

  it("non mostra icona info se infoTooltip non è passato", () => {
    render(
      <FormField label="Senza info">
        <Input />
      </FormField>
    );
    expect(screen.queryByRole("img", { hidden: true })).toBeNull();
  });

  it("mostra icona info quando infoTooltip è passato", () => {
    render(
      <FormField label="Con info" infoTooltip="Tooltip testo">
        <Input />
      </FormField>
    );
    const labelArea = screen.getByText("Con info").closest("div");
    expect(labelArea?.querySelector("svg")).toBeInTheDocument();
  });
});

describe("useFormField", () => {
  it("restituisce null fuori da FormField", () => {
    let result: ReturnType<typeof useFormField> = undefined as unknown as ReturnType<typeof useFormField>;
    function Consumer() {
      result = useFormField();
      return null;
    }
    render(<Consumer />);
    expect(result).toBeNull();
  });

  it("restituisce id, helperId, invalid dentro FormField", () => {
    let result: ReturnType<typeof useFormField> = null;
    function Consumer() {
      result = useFormField();
      return <span data-testid="consumer">{result ? result.id : "none"}</span>;
    }
    render(
      <FormField label="L" id="ctx-id" helperText="H" invalid>
        <Consumer />
      </FormField>
    );
    expect(result).not.toBeNull();
    expect(result?.id).toBe("ctx-id");
    expect(result?.helperId).toBe("ctx-id-helper");
    expect(result?.invalid).toBe(true);
    expect(screen.getByTestId("consumer")).toHaveTextContent("ctx-id");
  });
});
