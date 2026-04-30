import { describe, it, expect, render, screen } from "../../test-utils";
import {
  SidePanel,
  SidePanelBody,
  SidePanelClose,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "./side-panel";

describe("SidePanel", () => {
  it("renderizza variante operational con slot", () => {
    render(
      <SidePanel variant="operational" defaultOpen>
        <SidePanelContent>
          <SidePanelHeader actions={<SidePanelClose />}>
            <SidePanelTitle>Operativo</SidePanelTitle>
          </SidePanelHeader>
          <SidePanelBody>Body operativo</SidePanelBody>
          <SidePanelFooter>Footer operativo</SidePanelFooter>
        </SidePanelContent>
      </SidePanel>
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Operativo");
    expect(screen.getByRole("dialog")).toHaveTextContent("Body operativo");
    expect(screen.getByRole("dialog")).toHaveTextContent("Footer operativo");
  });

  it("renderizza variante preview", () => {
    render(
      <SidePanel variant="preview" defaultOpen>
        <SidePanelContent side="right" size="md">
          <SidePanelHeader actions={<SidePanelClose />}>
            <SidePanelTitle>Preview</SidePanelTitle>
          </SidePanelHeader>
          <SidePanelBody>Contenuto preview</SidePanelBody>
          <SidePanelFooter>Azioni preview</SidePanelFooter>
        </SidePanelContent>
      </SidePanel>
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Preview");
    expect(screen.getByRole("dialog")).toHaveTextContent("Contenuto preview");
  });

  it("renderizza variante navigation", () => {
    render(
      <SidePanel variant="navigation" defaultOpen>
        <SidePanelContent side="left" size="sm">
          <SidePanelHeader actions={<SidePanelClose />}>
            <SidePanelTitle>Navigazione</SidePanelTitle>
          </SidePanelHeader>
          <SidePanelBody>Menu</SidePanelBody>
          <SidePanelFooter>Chiudi</SidePanelFooter>
        </SidePanelContent>
      </SidePanel>
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Navigazione");
    expect(screen.getByRole("dialog")).toHaveTextContent("Menu");
  });
});
