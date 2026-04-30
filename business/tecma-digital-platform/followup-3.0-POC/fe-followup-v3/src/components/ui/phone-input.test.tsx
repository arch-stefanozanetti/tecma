import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneInput } from "./phone-input";

describe("PhoneInput", () => {
  it("rende input numero e prefisso di default", () => {
    render(<PhoneInput placeholder="Numero" />);
    expect(screen.getByPlaceholderText(/numero/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("senza prefisso mostra solo input tel", () => {
    render(<PhoneInput placeholder="Tel" showPrefix={false} />);
    expect(screen.getByPlaceholderText(/tel/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("value e onChange controllati", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<PhoneInput value="" onChange={handleChange} placeholder="Tel" />);
    await user.type(screen.getByPlaceholderText(/tel/i), "1");
    expect(handleChange).toHaveBeenCalled();
  });

  it("accetta prefixOptions custom", () => {
    render(
      <PhoneInput
        showPrefix
        prefixOptions={[{ value: "XX (+00)", label: "XX (+00)" }]}
        placeholder="Tel"
      />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
