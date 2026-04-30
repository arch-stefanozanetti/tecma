import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { DataTable } from "./DataTable";

const columns = [
  { key: "name", title: "Nome", render: (r: { name: string }) => r.name },
  { key: "id", title: "ID", render: (r: { id: string }) => r.id }
];

describe("DataTable", () => {
  it("rende title e search box", () => {
    render(
      <DataTable
        title="Elenco"
        searchText=""
        onSearchTextChange={vi.fn()}
        columns={columns}
        rows={[]}
        total={0}
        isLoading={false}
        error={null}
      />
    );
    expect(screen.getByRole("heading", { name: /elenco/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cerca/i)).toBeInTheDocument();
  });

  it("mostra caricamento quando isLoading", () => {
    render(
      <DataTable
        title="T"
        searchText=""
        onSearchTextChange={vi.fn()}
        columns={columns}
        rows={[]}
        total={0}
        isLoading
        error={null}
      />
    );
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("mostra errore quando error è valorizzato", () => {
    render(
      <DataTable
        title="T"
        searchText=""
        onSearchTextChange={vi.fn()}
        columns={columns}
        rows={[]}
        total={0}
        isLoading={false}
        error="Errore di rete"
      />
    );
    expect(screen.getByText("Errore di rete")).toBeInTheDocument();
  });

  it("mostra Nessun risultato quando rows vuoto e non loading", () => {
    render(
      <DataTable
        title="T"
        searchText=""
        onSearchTextChange={vi.fn()}
        columns={columns}
        rows={[]}
        total={0}
        isLoading={false}
        error={null}
      />
    );
    expect(screen.getByText(/nessun risultato/i)).toBeInTheDocument();
  });

  it("rende righe e totale", () => {
    const rows = [{ id: "1", name: "Mario" }, { id: "2", name: "Luigi" }];
    render(
      <DataTable
        title="T"
        searchText=""
        onSearchTextChange={vi.fn()}
        columns={columns}
        rows={rows}
        total={2}
        isLoading={false}
        error={null}
      />
    );
    expect(screen.getByText("Mario")).toBeInTheDocument();
    expect(screen.getByText("Luigi")).toBeInTheDocument();
    expect(screen.getByText(/totale: 2/i)).toBeInTheDocument();
  });

  it("chiama onSearchTextChange al cambio ricerca", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DataTable
        title="T"
        searchText=""
        onSearchTextChange={onChange}
        columns={columns}
        rows={[]}
        total={0}
        isLoading={false}
        error={null}
      />
    );
    await user.type(screen.getByPlaceholderText(/cerca/i), "x");
    expect(onChange).toHaveBeenCalled();
  });
});
