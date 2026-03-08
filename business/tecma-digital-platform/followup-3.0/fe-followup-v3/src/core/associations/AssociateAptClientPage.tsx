import { FormEvent, useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { INPUT_LIKE_CLASSES } from "../../lib/ds-form-classes";
import { cn } from "../../lib/utils";

interface AssociateAptClientPageProps {
  workspaceId: string;
  projectIds: string[];
  /** Callback per navigare a un'altra sezione (es. "requests" per Trattative). */
  onNavigateToSection?: (section: string) => void;
}

type AssocRow = { _id?: string; apartmentId: string; clientId: string; status: string; projectId?: string };
type DealStatus = "proposta" | "compromesso" | "rogito";

const rank: Record<DealStatus, number> = { proposta: 1, compromesso: 2, rogito: 3 };

const nextStatus = (status: DealStatus): DealStatus => {
  if (status === "proposta") return "compromesso";
  if (status === "compromesso") return "rogito";
  return "rogito";
};

export const AssociateAptClientPage = ({ workspaceId, projectIds, onNavigateToSection }: AssociateAptClientPageProps) => {
  const [clients, setClients] = useState<Array<{ _id: string; fullName: string; email: string }>>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [apartmentId, setApartmentId] = useState("");
  const [status, setStatus] = useState<DealStatus>("proposta");
  const [createAlsoRequest, setCreateAlsoRequest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [associations, setAssociations] = useState<AssocRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectIds[0] ?? "");
  const [searchText, setSearchText] = useState("");
  const [commandText, setCommandText] = useState("associa");

  const activeProjectIds = useMemo(() => (selectedProjectId ? [selectedProjectId] : projectIds), [selectedProjectId, projectIds]);

  const reload = async () => {
    const [c, a, assoc] = await Promise.all([
      followupApi.queryClientsLite(workspaceId, projectIds),
      followupApi.queryApartments({
        workspaceId,
        projectIds: activeProjectIds,
        page: 1,
        perPage: 300,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      followupApi.queryAssociations({
        workspaceId,
        projectIds: activeProjectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      })
    ]);

    setClients(c.data);
    setApartments(a.data);
    setAssociations(assoc.data as AssocRow[]);
  };

  useEffect(() => {
    void reload().catch(() => {
      setClients([]);
      setApartments([]);
      setAssociations([]);
    });
  }, [workspaceId, projectIds, activeProjectIds]);

  const clientMap = useMemo(() => new Map(clients.map((row) => [row._id, row])), [clients]);
  const apartmentMap = useMemo(() => new Map(apartments.map((row) => [row._id, row])), [apartments]);

  const selectedClient = clientMap.get(clientId);
  const selectedApartment = apartmentMap.get(apartmentId);

  const existingForApartment = useMemo(() => associations.find((row) => row.apartmentId === apartmentId), [associations, apartmentId]);

  const suggestedStatus = useMemo<DealStatus>(() => {
    if (!existingForApartment) return "proposta";
    const current = existingForApartment.status as DealStatus;
    if (!current) return "proposta";
    return nextStatus(current);
  }, [existingForApartment]);

  const riskFlags = useMemo(
    () => ({
      conflict: Boolean(existingForApartment && existingForApartment.clientId !== clientId),
      downgrade: Boolean(existingForApartment && rank[status] < rank[(existingForApartment.status as DealStatus) ?? "proposta"]),
      missingData: !clientId || !apartmentId
    }),
    [existingForApartment, status, clientId, apartmentId]
  );

  const filteredAssociations = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return associations;
    return associations.filter((row) => {
      const c = clientMap.get(row.clientId);
      const a = apartmentMap.get(row.apartmentId);
      return `${c?.fullName ?? ""} ${a?.name ?? ""} ${a?.code ?? ""} ${row.status}`.toLowerCase().includes(needle);
    });
  }, [associations, searchText, clientMap, apartmentMap]);

  const applyCommand = () => {
    const parts = commandText.trim().split(/\s+/);
    if (parts.length < 4 || parts[0] !== "associa") {
      setMessage("Comando non valido. Usa: associa <clientId> <apartmentId> <proposta|compromesso|rogito>");
      return;
    }

    const nextClientId = parts[1];
    const nextApartmentId = parts[2];
    const nextState = parts[3] as DealStatus;
    if (!["proposta", "compromesso", "rogito"].includes(nextState)) {
      setMessage("Status non valido nel comando");
      return;
    }

    setClientId(nextClientId);
    setApartmentId(nextApartmentId);
    setStatus(nextState);
    setMessage("Command applicato al form");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId || !apartmentId) {
      setMessage("Seleziona cliente e appartamento");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      if (existingForApartment && existingForApartment.clientId !== clientId) {
        throw new Error("Questo appartamento e gia associato a un altro cliente");
      }

      if (existingForApartment && rank[status] < rank[(existingForApartment.status as DealStatus) ?? "proposta"]) {
        const proceed = window.confirm(`Downgrade stato da ${existingForApartment.status} a ${status}. Confermi?`);
        if (!proceed) {
          setIsLoading(false);
          return;
        }
      }

      await followupApi.createAssociation({
        workspaceId,
        projectId: selectedProjectId || projectIds[0],
        apartmentId,
        clientId,
        status,
        forceDowngrade: true
      });

      if (createAlsoRequest) {
        await followupApi.createRequest({
          workspaceId,
          projectId: selectedProjectId || projectIds[0],
          clientId,
          apartmentId,
          type: "sell",
          status: "new"
        });
        setMessage("Associazione e trattativa create con successo. Vai a Trattative per i dettagli.");
      } else {
        setMessage("Associazione completata con successo");
      }
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore associazione");
    } finally {
      setIsLoading(false);
    }
  };

  const removeAssociation = async (associationId: string) => {
    try {
      await followupApi.deleteAssociation(associationId);
      setMessage("Associazione rimossa");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore eliminazione associazione");
    }
  };

  return (
    <section className="hc-shell association-ai-shell">
      <div className="hc-card">
        <div className="hc-head">
          <h3>Associa Apt/Cliente</h3>
          <p>Action-first: seleziona, verifica rischi, esegui o pilotala da command input.</p>
        </div>

        <div className="association-command">
          <Input value={commandText} onChange={(e) => setCommandText(e.target.value)} className="flex-1" />
          <Button variant="outline" type="button" onClick={applyCommand}>
            Applica comando
          </Button>
        </div>

        <div className="association-layout">
          <form className="hc-grid" onSubmit={submit}>
            <label>
              Progetto
              <select className={cn(INPUT_LIKE_CLASSES)} value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                {projectIds.map((projectId) => (
                  <option key={projectId} value={projectId}>
                    {projectId}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cliente
              <select className={cn(INPUT_LIKE_CLASSES)} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Seleziona cliente</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.fullName} ({client.email})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Appartamento
              <select className={cn(INPUT_LIKE_CLASSES)} value={apartmentId} onChange={(e) => setApartmentId(e.target.value)}>
                <option value="">Seleziona appartamento</option>
                {apartments.map((apt) => (
                  <option key={apt._id} value={apt._id}>
                    {apt.name} ({apt.code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Stato
              <select className={cn(INPUT_LIKE_CLASSES)} value={status} onChange={(e) => setStatus(e.target.value as DealStatus)}>
                <option value="proposta">proposta</option>
                <option value="compromesso">compromesso</option>
                <option value="rogito">rogito</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createAlsoRequest}
                onChange={(e) => setCreateAlsoRequest(e.target.checked)}
                className="rounded border-border"
              />
              <span>Crea anche una trattativa (vendita, stato Nuova)</span>
            </label>

            <div className="hc-summary-grid">
              <div>
                <strong>Cliente:</strong> {selectedClient?.fullName ?? "-"}
              </div>
              <div>
                <strong>Appartamento:</strong> {selectedApartment?.name ?? "-"}
              </div>
              <div>
                <strong>Status consigliato:</strong> {suggestedStatus}
              </div>
            </div>

            <div className="association-actions">
              <Button variant="outline" type="button" onClick={() => setStatus(suggestedStatus)}>
                Usa stato consigliato
              </Button>
              <Button type="submit" disabled={!clientId || !apartmentId || isLoading}>
                Associa
              </Button>
            </div>
          </form>

          <aside className="association-insights">
            <h4>Signal Board</h4>
            <div className={`insight ${riskFlags.missingData ? "warn" : "ok"}`}>
              <strong>Input completeness</strong>
              <p>{riskFlags.missingData ? "Mancano cliente o appartamento" : "Input completo"}</p>
            </div>
            <div className={`insight ${riskFlags.conflict ? "error" : "ok"}`}>
              <strong>Conflitto associazione</strong>
              <p>{riskFlags.conflict ? "Appartamento gia assegnato ad altro cliente" : "Nessun conflitto rilevato"}</p>
            </div>
            <div className={`insight ${riskFlags.downgrade ? "warn" : "ok"}`}>
              <strong>Rischio downgrade</strong>
              <p>{riskFlags.downgrade ? "Lo stato scelto e inferiore a quello corrente" : "Nessun downgrade"}</p>
            </div>
          </aside>
        </div>

        <div className="table-clients hc-table">
          <div className="tecma-table-toolbar">
            <div className="actions-container">
              <div className="table-toolbar-title">
                <span className="title-main">Associazioni correnti</span>
                <span className="title-sub">{filteredAssociations.length} elementi</span>
              </div>
              <Input placeholder="Filtra associazioni" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="min-w-[200px]" />
            </div>
          </div>
          <div className="clients-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Appartamento</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredAssociations.length === 0 && (
                  <tr>
                    <td colSpan={4}>Nessuna associazione attiva</td>
                  </tr>
                )}
                {filteredAssociations.map((association, index) => {
                  const client = clientMap.get(association.clientId);
                  const apt = apartmentMap.get(association.apartmentId);
                  return (
                    <tr key={`${association.apartmentId}-${association.clientId}-${index}`}>
                      <td>{client?.fullName ?? association.clientId}</td>
                      <td>{apt?.name ?? association.apartmentId}</td>
                      <td>{association.status}</td>
                      <td>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => association._id && removeAssociation(association._id)}
                          disabled={!association._id}
                        >
                          Disassocia
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {message && (
          <div className="generic-table-feedback">
            <p>{message}</p>
            {onNavigateToSection && (
              <Button
                type="button"
                variant="default"
                className="mt-2"
                onClick={() => onNavigateToSection("requests")}
              >
                Vai a Trattative
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
