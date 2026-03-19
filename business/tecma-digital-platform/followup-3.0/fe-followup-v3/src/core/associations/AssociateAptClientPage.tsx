import { FormEvent, useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CheckboxWithLabel } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

interface AssociateAptClientPageProps {
  workspaceId: string;
  projectIds: string[];
  /** Callback per navigare a un'altra sezione (es. "requests" per Trattative). */
  onNavigateToSection?: (section: string) => void;
  /** Valori iniziali (es. da trattativa vinta). */
  initialClientId?: string;
  initialApartmentId?: string;
  initialStatus?: "proposta" | "compromesso" | "rogito";
}

type AssocRow = { _id?: string; apartmentId: string; clientId: string; status: string; projectId?: string };
type DealStatus = "proposta" | "compromesso" | "rogito";

const rank: Record<DealStatus, number> = { proposta: 1, compromesso: 2, rogito: 3 };

const nextStatus = (status: DealStatus): DealStatus => {
  if (status === "proposta") return "compromesso";
  if (status === "compromesso") return "rogito";
  return "rogito";
};

export const AssociateAptClientPage = ({
  workspaceId,
  projectIds,
  onNavigateToSection,
  initialClientId,
  initialApartmentId,
  initialStatus,
}: AssociateAptClientPageProps) => {
  const [clients, setClients] = useState<Array<{ _id: string; fullName: string; email: string }>>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [apartmentId, setApartmentId] = useState(initialApartmentId ?? "");
  const [status, setStatus] = useState<DealStatus>((initialStatus as DealStatus) ?? "proposta");
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
      followupApi.apartments.queryApartments({
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

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
    if (initialApartmentId) setApartmentId(initialApartmentId);
    if (initialStatus && ["proposta", "compromesso", "rogito"].includes(initialStatus)) {
      setStatus(initialStatus as DealStatus);
    }
  }, [initialClientId, initialApartmentId, initialStatus]);

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
          <Button variant="outline" type="button" className="min-h-11" onClick={applyCommand}>
            Applica comando
          </Button>
        </div>

        <div className="association-layout">
          <form className="hc-grid" onSubmit={submit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Progetto</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectIds.map((projectId) => (
                    <SelectItem key={projectId} value={projectId}>
                      {projectId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Cliente</label>
              <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Seleziona cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleziona cliente</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.fullName} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Appartamento</label>
              <Select value={apartmentId || "__none__"} onValueChange={(v) => setApartmentId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Seleziona appartamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleziona appartamento</SelectItem>
                  {apartments.map((apt) => (
                    <SelectItem key={apt._id} value={apt._id}>
                      {apt.name} ({apt.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Stato</label>
              <Select value={status} onValueChange={(v) => setStatus(v as DealStatus)}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposta">proposta</SelectItem>
                  <SelectItem value="compromesso">compromesso</SelectItem>
                  <SelectItem value="rogito">rogito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center">
              <CheckboxWithLabel
                id="createAlsoRequest"
                checked={createAlsoRequest}
                onCheckedChange={(c) => setCreateAlsoRequest(c === true)}
                label="Crea anche una trattativa (vendita, stato Nuova)"
              />
            </div>

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
              <Button variant="outline" type="button" className="min-h-11" onClick={() => setStatus(suggestedStatus)}>
                Usa stato consigliato
              </Button>
              <Button type="submit" className="min-h-11" disabled={!clientId || !apartmentId || isLoading}>
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
                          className="min-h-11"
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
                className="mt-2 min-h-11"
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
