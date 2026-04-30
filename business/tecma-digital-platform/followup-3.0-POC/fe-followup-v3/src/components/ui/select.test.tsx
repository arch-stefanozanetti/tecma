import { describe, it, expect, render, screen } from "../../test-utils";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectLabel,
  SelectGroup,
} from "./select";
import { FormField } from "./form-field";

describe("Select", () => {
  it("rende trigger con placeholder", () => {
    render(
      <Select>
        <SelectTrigger data-testid="select-trigger">
          <SelectValue placeholder="Scegli..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opzione A</SelectItem>
          <SelectItem value="b">Opzione B</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByTestId("select-trigger");
    expect(trigger).toHaveTextContent("Scegli...");
    expect(trigger).toHaveAttribute("role", "combobox");
  });

  it("applica invalid al trigger quando invalid=true", () => {
    render(
      <Select>
        <SelectTrigger invalid data-testid="select-trigger">
          <SelectValue placeholder="Scegli" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">X</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByTestId("select-trigger");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger.className).toMatch(/destructive/);
  });

  it("rende SelectGroup e SelectLabel", () => {
    render(
      <Select>
        <SelectTrigger data-testid="select-trigger">
          <SelectValue placeholder="Scegli" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Etichetta</SelectLabel>
            <SelectItem value="a">A</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("select-trigger")).toHaveTextContent("Scegli");
  });

  it("usa useFormField quando dentro FormField (id e invalid)", () => {
    render(
      <FormField label="Tipo" id="sel-type" invalid helperText="Errore">
        <Select>
          <SelectTrigger data-testid="select-trigger">
            <SelectValue placeholder="Scegli" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="x">X</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    );
    const trigger = screen.getByTestId("select-trigger");
    expect(trigger).toHaveAttribute("id", "sel-type");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "sel-type-helper");
  });
});
