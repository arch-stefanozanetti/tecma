import { describe, it, expect, render } from "../../test-utils";
import { Separator } from "./separator";

describe("Separator", () => {
  it("rende con orientamento orizzontale di default", () => {
    const { container } = render(<Separator data-testid="sep" />);
    const sep = container.querySelector("[data-testid=sep]");
    expect(sep).toBeInTheDocument();
    expect(sep?.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("applica orientation vertical", () => {
    const { container } = render(<Separator orientation="vertical" data-testid="sep" />);
    const sep = container.querySelector("[data-testid=sep]");
    expect(sep?.getAttribute("data-orientation")).toBe("vertical");
  });

  it("accetta decorative", () => {
    const { container } = render(<Separator decorative={false} data-testid="sep" />);
    expect(container.querySelector("[data-testid=sep]")).toBeInTheDocument();
  });
});
