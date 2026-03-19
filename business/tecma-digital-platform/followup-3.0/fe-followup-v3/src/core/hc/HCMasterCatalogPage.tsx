import { useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { HCMasterEntity, HCMasterEntityRecord } from "../../types/domain";
import { useIsMobile } from "../shared/useIsMobile";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";

interface HCMasterCatalogPageProps {
  workspaceId: string;
  projectIds: string[];
}

const entities: Array<{ id: HCMasterEntity; label: string }> = [
  { id: "section", label: "Sections" },
  { id: "mood", label: "Moods" },
  { id: "finish", label: "Finishes" },
  { id: "specification", label: "Specifications" },
  { id: "optional", label: "Optionals" }
];

export const HCMasterCatalogPage = ({ workspaceId, projectIds }: HCMasterCatalogPageProps) => {
  const isMobile = useIsMobile();
  const [entity, setEntity] = useState<HCMasterEntity>("section");
  const [rows, setRows] = useState<HCMasterEntityRecord[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [searchText, setSearchText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = async () => {
    const result = await followupApi.queryHCMaster(entity, {
      workspaceId,
      projectIds,
      page: 1,
      perPage: 500,
      searchText,
      sort: { field: "updatedAt", direction: -1 }
    });
    setRows(result.data);
  };

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [entity, workspaceId, projectIds, searchText]);

  const canCreate = useMemo(() => Boolean(code.trim() && name.trim()), [code, name]);

  const create = async () => {
    setMessage(null);
    try {
      await followupApi.createHCMaster(entity, {
        workspaceId,
        projectId: projectIds[0],
        code: code.trim(),
        name: name.trim(),
        description: description.trim()
      });
      setCode("");
      setName("");
      setDescription("");
      setMessage("Elemento creato");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Errore creazione");
    }
  };

  const startEdit = (row: HCMasterEntityRecord) => {
    setEditingId(row._id ?? null);
    setEditName(row.name);
    setEditDescription(row.description ?? "");
  };

  const saveEdit = async (id: string) => {
    try {
      await followupApi.updateHCMaster(entity, id, { name: editName.trim(), description: editDescription.trim() });
      setEditingId(null);
      setMessage("Elemento aggiornato");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Errore aggiornamento");
    }
  };

  const remove = async (id: string) => {
    try {
      await followupApi.deleteHCMaster(entity, id);
      await load();
      setMessage("Elemento eliminato");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  return (
    <section className="hc-shell">
      <div className="hc-card">
        <div className="hc-head">
          <h3>Catalogo HC</h3>
          <p>CRUD completo per Sections, Moods, Finishes, Specifications, Optionals.</p>
        </div>

        <div className="tab-pills">
          {entities.map((item) => (
            <button key={item.id} type="button" className={cn("tab-pill min-h-11", item.id === entity && "active")} onClick={() => setEntity(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="project-access-form">
          <Input placeholder="Search" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="min-w-[200px]" />
          <Button variant="outline" type="button" className="min-h-11" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="hc-grid">
          <label>
            Code
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="w-full" />
          </label>
          <label>
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </label>
          <label>
            Description
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
          </label>
          <div className="hc-actions">
            <Button type="button" className="min-h-11" onClick={create} disabled={!canCreate}>
              Crea elemento
            </Button>
          </div>
        </div>

        {/* Vista card su mobile */}
        {isMobile && (
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div key={row._id} className="rounded-ui border border-border bg-card p-4 shadow-sm">
                <p className="font-medium text-foreground">{row.code}</p>
                {editingId === row._id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-2 w-full" />
                    <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="mt-2 w-full" />
                    <div className="mt-3 flex gap-2">
                      <Button type="button" className="min-h-11" onClick={() => row._id && saveEdit(row._id)}>Salva</Button>
                      <Button variant="outline" type="button" className="min-h-11" onClick={() => setEditingId(null)}>Annulla</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mt-0.5">{row.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{row.description ?? "-"}</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" type="button" className="min-h-11" onClick={() => startEdit(row)}>Modifica</Button>
                      {row._id && (
                        <Button variant="outline" type="button" className="min-h-11" onClick={() => remove(row._id!)}>Elimina</Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={cn("table-clients hc-table", isMobile && "hidden md:block")}>
          <div className="clients-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.code}</td>
                    <td>
                      {editingId === row._id ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full" />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td>
                      {editingId === row._id ? (
                        <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full" />
                      ) : (
                        row.description ?? "-"
                      )}
                    </td>
                    <td>
                      <div className="project-access-form">
                        {editingId === row._id ? (
                          <Button type="button" className="min-h-11" onClick={() => row._id && saveEdit(row._id)}>
                            Save
                          </Button>
                        ) : (
                          <Button variant="outline" type="button" className="min-h-11" onClick={() => startEdit(row)}>
                            Edit
                          </Button>
                        )}
                        {row._id && (
                          <Button variant="outline" type="button" className="min-h-11" onClick={() => remove(row._id!)}>
                            Elimina
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {message && <p className="generic-table-feedback">{message}</p>}
      </div>
    </section>
  );
};
