import { describe, it, expect, render, screen } from "../../test-utils";
import { Link } from "./link";

describe("Link", () => {
  it("rende come anchor con href", () => {
    render(<Link href="/page">Vai</Link>);
    const a = screen.getByRole("link", { name: /vai/i });
    expect(a).toBeInTheDocument();
    expect(a).toHaveAttribute("href", "/page");
  });

  it("applica size sm e regular", () => {
    const { container } = render(<Link href="#" size="sm">Small</Link>);
    expect((container.firstChild as HTMLElement).className).toMatch(/text-xs/);
    const { container: c2 } = render(<Link href="#" size="regular">Reg</Link>);
    expect((c2.firstChild as HTMLElement).className).toMatch(/text-sm/);
  });

  it("mostra iconBefore e iconAfter", () => {
    render(
      <Link href="#" iconBefore={<span data-testid="before">B</span>} iconAfter={<span data-testid="after">A</span>}>
        Test
      </Link>
    );
    expect(screen.getByTestId("before")).toBeInTheDocument();
    expect(screen.getByTestId("after")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveTextContent("Test");
  });

  it("supporta disabled", () => {
    render(<Link href="#" aria-disabled="true">Dis</Link>);
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("aria-disabled", "true");
  });
});
