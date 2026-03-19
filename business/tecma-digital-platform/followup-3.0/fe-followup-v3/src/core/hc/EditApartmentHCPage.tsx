import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow, HCApartmentConfig } from "../../types/domain";
import { useIsMobile } from "../shared/useIsMobile";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { INPUT_LIKE_CLASSES } from "../../lib/ds-form-classes";
import { cn } from "../../lib/utils";

interface EditApartmentHCPageProps {
  workspaceId: string;
  projectIds: string[];
  /** Se fornito, salta lo step 1 e carica direttamente la config di questo appartamento */
  initialApartmentId?: string;
}

export const EditApartmentHCPage = ({ workspaceId, projectIds, initialApartmentId }: EditApartmentHCPageProps) => {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apartmentId, setApartmentId] = useState("");
  const [hcRows, setHcRows] = useState<HCApartmentConfig[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [sectionCodes, setSectionCodes] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const initialLoadDone = useRef(false);

  const loadRows = async () => {
    const [hcResult, aptResult] = await Promise.all([
      followupApi.queryHCApartments({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      followupApi.apartments.queryApartments({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      })
    ]);
    setHcRows(hcResult.data);
    setApartments(aptResult.data);
  };

  useEffect(() => {
    void loadRows().catch(() => {
      setHcRows([]);
      setApartments([]);
    });
  }, [workspaceId, projectIds]);

  useEffect(() => {
    if (!initialApartmentId) {
      initialLoadDone.current = false;
      return;
    }
    if (apartments.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true;
      void loadConfig(initialApartmentId);
    }
  }, [initialApartmentId, apartments.length]);

  const apartmentMap = useMemo(() => new Map(apartments.map((a) => [a._id, a])), [apartments]);

  const filteredRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return hcRows;
    return hcRows.filter((row) => {
      const apt = apartmentMap.get(row.apartmentId);
      return `${row.apartmentId} ${apt?.name ?? ""} ${apt?.code ?? ""}`.toLowerCase().includes(needle);
    });
  }, [hcRows, apartmentMap, searchText]);

  const selectedRow = useMemo(() => hcRows.find((row) => row.apartmentId === apartmentId), [hcRows, apartmentId]);
  const selectedApartment = apartmentMap.get(apartmentId);

  const loadConfig = async (targetApartmentId?: string) => {
    const id = targetApartmentId ?? apartmentId;
    if (!id) return;

    setMessage(null);
    try {
      const response = await followupApi.getHCApartment(id);
      const config = response.config;
      setApartmentId(id);
      setSectionCodes(config.selectedSectionCodes ?? []);
      setFormValues(config.formValues ?? {});
      setStep(2);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Config HC non trovata");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apartmentId) {
      setMessage("Seleziona appartamento");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      await followupApi.patchHCApartment(apartmentId, {
        workspaceId,
        projectId: projectIds[0],
        selectedSectionCodes: sectionCodes,
        formValues
      });

      setStep(3);
      setMessage("Configurazione HC aggiornata");
      await loadRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore aggiornamento");
    } finally {
      setIsLoading(false);
    }
  };

  const upsertField = (key: string, value: number) => {
    setFormValues((rows) => ({ ...rows, [key]: value }));
  };

  const removeField = (key: string) => {
    setFormValues((rows) => {
      const next = { ...rows };
      delete next[key];
      return next;
    });
  };

  const addField = () => {
    const key = `custom_${Date.now()}`;
    upsertField(key, 0);
  };

  return (
    <section className={cn("hc-shell hc-like-source", isMobile && "pb-24")}>
      <div className="hc-card">
        <div className="hc-head">
          <h3>Modifica Appartamento HC</h3>
          <p>Seleziona una configurazione esistente, modifica i valori e salva.</p>
        </div>

        <div className="hc-progress">
          <div className="hc-progress-bar" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        <div className="hc-stepper">
          <span className={step >= 1 ? "active" : ""}>1. Selezione</span>
          <span className={step >= 2 ? "active" : ""}>2. Modifica</span>
          <span className={step >= 3 ? "active" : ""}>3. Conferma</span>
        </div>

        {step === 1 && (
          <div className="hc-grid">
            <label>
              Cerca configurazione
              <Input placeholder="Apt id/nome/codice" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full" />
            </label>

            <div className="hc-card-grid">
              {filteredRows.map((row) => {
                const apt = apartmentMap.get(row.apartmentId);
                const sectionCount = row.selectedSectionCodes?.length ?? 0;
                const fieldCount = Object.keys(row.formValues ?? {}).length;
                return (
                  <button
                    key={row.apartmentId}
                    type="button"
                    className={`hc-apartment-card ${row.legacyIncomplete ? "warning" : ""}`}
                    onClick={() => {
                      setApartmentId(row.apartmentId);
                      void loadConfig(row.apartmentId);
                    }}
                  >
                    <strong>{apt?.name ?? row.apartmentId}</strong>
                    <span>{apt?.code ?? "-"}</span>
                    <small>
                      {sectionCount} sezioni - {fieldCount} campi {row.legacyIncomplete ? "- legacy" : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <form className="hc-grid" onSubmit={submit}>
            <div className="hc-summary-grid">
              <div>
                <strong>Appartamento:</strong> {selectedApartment?.name ?? apartmentId}
              </div>
              <div>
                <strong>Codice:</strong> {selectedApartment?.code ?? "-"}
              </div>
              <div>
                <strong>Stato HC:</strong> {selectedRow?.legacyIncomplete ? "Legacy incompleto" : "Completo"}
              </div>
            </div>

            {selectedRow?.legacyIncomplete && (
              <p className="generic-table-feedback">Record legacy incompleto: verifica manualmente i valori prima del salvataggio.</p>
            )}

            <div className="hc-section-box">
              <h4>Section codes</h4>
              <div className="hc-chips">
                {sectionCodes.map((code) => (
                  <button
                    key={code}
                    className="hc-chip active"
                    type="button"
                    onClick={() => setSectionCodes((rows) => rows.filter((value) => value !== code))}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <div className="project-access-form">
                <input
                  className={cn(INPUT_LIKE_CLASSES)}
                  placeholder="Aggiungi code e premi invio"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const target = e.target as HTMLInputElement;
                    const value = target.value.trim();
                    if (!value) return;
                    setSectionCodes((rows) => (rows.includes(value) ? rows : [...rows, value]));
                    target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="hc-section-box">
              <h4>Form values</h4>
              <div className="hc-grid two">
                {Object.entries(formValues).map(([key, value]) => (
                  <div className="hc-inline-grid" key={key}>
                    <Input value={key} disabled />
                    <Input type="number" value={value} onChange={(e) => upsertField(key, Number(e.target.value || 0))} />
                    <Button variant="outline" type="button" onClick={() => removeField(key)} className="min-h-11">
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" type="button" onClick={addField} className="min-h-11">
                Aggiungi campo
              </Button>
            </div>

            <div className="hc-preview-box">
              <h4>Preview payload patch</h4>
              <pre>
{JSON.stringify(
  {
    apartmentId,
    selectedSectionCodes: sectionCodes,
    formValues
  },
  null,
  2
)}
              </pre>
            </div>

            <div className={cn("hc-actions", isMobile && "fixed bottom-0 left-0 right-0 z-10 flex gap-2 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]")}>
              <Button variant="outline" type="button" onClick={() => setStep(1)} className="min-h-11">
                Torna alla lista
              </Button>
              <Button type="submit" disabled={isLoading} className="min-h-11">
                Salva aggiornamenti HC
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="hc-result ok">
            <h4>Aggiornamento completato</h4>
            <p>
              Appartamento: <strong>{selectedApartment?.name ?? apartmentId}</strong>
            </p>
            <p>
              Sezioni: <strong>{sectionCodes.length}</strong> - Campi: <strong>{Object.keys(formValues).length}</strong>
            </p>
            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={() => setStep(1)} className="min-h-11">
                Modifica un altro HC
              </Button>
            </div>
          </div>
        )}

        {message && <p className="generic-table-feedback">{message}</p>}
      </div>
    </section>
  );
};
