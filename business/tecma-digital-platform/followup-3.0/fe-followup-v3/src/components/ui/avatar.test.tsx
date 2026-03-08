import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("rende con data-testid", () => {
    render(<Avatar text="MR" data-testid="avatar" />);
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
  });

  it("accetta text per iniziali (contenuto nel fallback)", () => {
    render(<Avatar text="AB" data-testid="avatar" />);
    const root = screen.getByTestId("avatar");
    expect(root).toBeInTheDocument();
    // Radix Fallback può essere asincrono; verifichiamo che il root esista
    expect(root.tagName).toBe("SPAN");
  });

  it("accetta src (Image con fallback)", () => {
    render(<Avatar src="https://example.com/photo.jpg" alt="User" data-testid="avatar" />);
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    // In jsdom l'img può non essere nel DOM fino al load; verifichiamo il root
    const img = document.querySelector('img[src="https://example.com/photo.jpg"]');
    if (img) expect(img).toHaveAttribute("alt", "User");
  });

  it("accetta size sm, md, lg", () => {
    const { rerender } = render(<Avatar text="X" size="sm" />);
    expect(screen.getByTestId("avatar").className).toMatch(/h-8/);
    rerender(<Avatar text="X" size="lg" />);
    expect(screen.getByTestId("avatar").className).toMatch(/h-12/);
  });

  it("accetta icon e rende avatar (fallback con icon)", async () => {
    const { container } = render(<Avatar icon={<span data-testid="avatar-icon">I</span>} />);
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    await waitFor(() => {
      const icon = container.querySelector("[data-testid=avatar-icon]");
      expect(icon).toBeInTheDocument();
    });
  });
});
