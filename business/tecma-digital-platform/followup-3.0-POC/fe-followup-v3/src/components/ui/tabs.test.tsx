import { describe, it, expect, render, screen, userEvent } from "../../test-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

describe("Tabs", () => {
  it("rende tab e contenuto", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Contenuto A</TabsContent>
        <TabsContent value="b">Contenuto B</TabsContent>
      </Tabs>
    );
    expect(screen.getByRole("tab", { name: /tab a/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tab b/i })).toBeInTheDocument();
    expect(screen.getByText("Contenuto A")).toBeInTheDocument();
  });

  it("TabsTrigger con icon", () => {
    render(
      <Tabs defaultValue="x">
        <TabsList>
          <TabsTrigger value="x" icon={<span data-testid="icon">I</span>}>
            Con icona
          </TabsTrigger>
        </TabsList>
        <TabsContent value="x">X</TabsContent>
      </Tabs>
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("tab")).toHaveTextContent("Con icona");
  });

  it("cambia contenuto al click su tab", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Solo A</TabsContent>
        <TabsContent value="b">Solo B</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("Solo A")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^b$/i }));
    expect(screen.getByText("Solo B")).toBeInTheDocument();
  });
});
