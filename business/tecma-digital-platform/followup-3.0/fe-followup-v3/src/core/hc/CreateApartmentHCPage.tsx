import { useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow, ConfigurationTemplateSchema, HCApartmentConfig, HCMasterEntityRecord } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { INPUT_LIKE_CLASSES } from "../../lib/ds-form-classes";
import { cn } from "../../lib/utils";

interface CreateApartmentHCPageProps {
  workspaceId: string;
  projectIds: string[];
}

type Step = 1 | 2 | 3 | 4 | 5;
type StageStatus = "pending" | "running" | "done" | "error";

interface ProcessingStage {
  key: string;
  label: string;
  status: StageStatus;
}

const createInitialStages = (): ProcessingStage[] => [
  { key: "validate", label: "Validazione payload HC", status: "pending" },
  { key: "build", label: "Costruzione configurazione", status: "pending" },
  { key: "save", label: "Salvataggio su backend", status: "pending" },
  { key: "verify", label: "Verifica consistenza", status: "pending" }
];

const toKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toTitle = (value: string): string => value.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());

const getTemplateFields = (template: ConfigurationTemplateSchema | null, sectionCode: string): string[] => {
  if (!template) {
    return [`${toKey(sectionCode)}_mq`, `${toKey(sectionCode)}_count`];
  }

  const normalized = sectionCode.toLowerCase();
  const hit = template.sections.find((section) => {
    const id = section.id.toLowerCase();
    const title = section.title.toLowerCase();
    return id === normalized || id.includes(normalized) || title.includes(normalized);
  });

  if (!hit || hit.fields.length === 0) {
    return [`${toKey(sectionCode)}_mq`, `${toKey(sectionCode)}_count`];
  }

  return hit.fields.map((field) => field.key);
};

export const CreateApartmentHCPage = ({ workspaceId, projectIds }: CreateApartmentHCPageProps) => {
  const [step, setStep] = useState<Step>(1);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [sections, setSections] = useState<HCMasterEntityRecord[]>([]);
  const [template, setTemplate] = useState<ConfigurationTemplateSchema | null>(null);
  const [existingConfigs, setExistingConfigs] = useState<HCApartmentConfig[]>([]);
  const [search, setSearch] = useState("");
  const [selectedApartmentId, setSelectedApartmentId] = useState("");
  const [selectedSectionCodes, setSelectedSectionCodes] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>(createInitialStages());

  const projectId = projectIds[0] ?? "";

  const loadData = async () => {
    const [apartmentRows, sectionRows, hcRows] = await Promise.all([
      followupApi.queryApartments({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      followupApi.queryHCMaster("section", {
        workspaceId,
        projectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      followupApi.queryHCApartments({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      })
    ]);

    setApartments(apartmentRows.data);
    setSections(sectionRows.data);
    setExistingConfigs(hcRows.data);

    try {
      const templateResponse = await followupApi.getTemplateConfiguration(projectId);
      setTemplate(templateResponse.template);
    } catch {
      setTemplate(null);
    }
  };

  useEffect(() => {
    void loadData().catch(() => {
      setApartments([]);
      setSections([]);
      setExistingConfigs([]);
      setTemplate(null);
    });
  }, [workspaceId, projectIds, projectId]);

  const hcByApartment = useMemo(() => new Map(existingConfigs.map((row) => [row.apartmentId, row])), [existingConfigs]);

  const filteredApartments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return apartments;
    return apartments.filter((apt) => `${apt.name} ${apt.code}`.toLowerCase().includes(needle));
  }, [apartments, search]);

  const incompleteApartments = useMemo(
    () =>
      filteredApartments.filter((apt) => {
        const config = hcByApartment.get(apt._id);
        if (!config) return false;
        return config.legacyIncomplete || Object.keys(config.formValues ?? {}).length === 0;
      }),
    [filteredApartments, hcByApartment]
  );

  const newApartments = useMemo(
    () => filteredApartments.filter((apt) => !hcByApartment.has(apt._id)),
    [filteredApartments, hcByApartment]
  );

  const selectedApartment = useMemo(() => apartments.find((apt) => apt._id === selectedApartmentId), [apartments, selectedApartmentId]);
  const selectedApartmentConfig = selectedApartmentId ? hcByApartment.get(selectedApartmentId) : undefined;

  useEffect(() => {
    if (!selectedApartmentConfig) {
      return;
    }
    if (selectedApartmentConfig.selectedSectionCodes?.length > 0) {
      setSelectedSectionCodes(selectedApartmentConfig.selectedSectionCodes);
    }
    if (selectedApartmentConfig.formValues && Object.keys(selectedApartmentConfig.formValues).length > 0) {
      setFormValues(selectedApartmentConfig.formValues);
    }
  }, [selectedApartmentConfig]);

  const sectionFieldMatrix = useMemo(() => {
    return selectedSectionCodes.map((sectionCode) => {
      const fields = getTemplateFields(template, sectionCode);
      return { sectionCode, fields };
    });
  }, [template, selectedSectionCodes]);

  const canGoStep2 = Boolean(selectedApartmentId);
  const canGoStep3 = selectedSectionCodes.length > 0;
  const canGoStep4 = sectionFieldMatrix.every((item) => item.fields.every((field) => Number.isFinite(formValues[field])));

  const setStageStatus = (key: string, status: StageStatus) => {
    setProcessingStages((rows) => rows.map((row) => (row.key === key ? { ...row, status } : row)));
  };

  const toggleSection = (code: string) => {
    setSelectedSectionCodes((rows) => (rows.includes(code) ? rows.filter((value) => value !== code) : [...rows, code]));
  };

  const handleProcess = async () => {
    if (!selectedApartmentId) {
      setMessage("Seleziona un appartamento");
      return;
    }

    setMessage(null);
    setIsLoading(true);
    setStep(4);
    setProcessingStages(createInitialStages());

    try {
      setStageStatus("validate", "running");
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setStageStatus("validate", "done");

      setStageStatus("build", "running");
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      setStageStatus("build", "done");

      setStageStatus("save", "running");
      await followupApi.upsertHCApartment({
        workspaceId,
        projectId,
        apartmentId: selectedApartmentId,
        selectedSectionCodes,
        selectedSectionIds: [],
        formValues,
        finishesPrices: []
      });
      setStageStatus("save", "done");

      setStageStatus("verify", "running");
      const verify = await followupApi.getHCApartment(selectedApartmentId);
      if (!verify.config) {
        throw new Error("Verifica backend fallita");
      }
      setStageStatus("verify", "done");

      setStep(5);
      setMessage("Configurazione HC completata con successo");
      await loadData();
    } catch (error) {
      setStageStatus("save", "error");
      setStageStatus("verify", "error");
      setMessage(error instanceof Error ? error.message : "Errore durante configurazione HC");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedApartmentId("");
    setSelectedSectionCodes([]);
    setFormValues({});
    setMessage(null);
    setProcessingStages(createInitialStages());
  };

  return (
    <section className="hc-shell hc-like-source">
      <div className="hc-card">
        <div className="hc-head">
          <h3>Crea Appartamento HC</h3>
          <p>Seleziona appartamento, imposta sezioni HC, completa il form dinamico e salva.</p>
        </div>

        <div className="hc-progress">
          <div className="hc-progress-bar" style={{ width: `${(step / 5) * 100}%` }} />
        </div>

        <div className="hc-stepper long">
          <span className={step >= 1 ? "active" : ""}>1. Apartment</span>
          <span className={step >= 2 ? "active" : ""}>2. Sections</span>
          <span className={step >= 3 ? "active" : ""}>3. Dynamic Form</span>
          <span className={step >= 4 ? "active" : ""}>4. Processing</span>
          <span className={step >= 5 ? "active" : ""}>5. Completed</span>
        </div>

        {step === 1 && (
          <div className="hc-grid">
            <label>
              Cerca appartamento
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome o codice" className="w-full" />
            </label>

            {incompleteApartments.length > 0 && (
              <div className="hc-section-box">
                <h4>Completa Upload Finishes ({incompleteApartments.length})</h4>
                <div className="hc-card-grid">
                  {incompleteApartments.map((apt) => (
                    <button
                      className={`hc-apartment-card ${selectedApartmentId === apt._id ? "selected warning" : "warning"}`}
                      key={apt._id}
                      type="button"
                      onClick={() => setSelectedApartmentId(apt._id)}
                    >
                      <strong>{apt.name}</strong>
                      <span>{apt.code}</span>
                      <small>HC incompleto</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="hc-section-box">
              <h4>Crea Nuova Configurazione HC ({newApartments.length})</h4>
              <div className="hc-card-grid">
                {newApartments.map((apt) => (
                  <button
                    className={`hc-apartment-card ${selectedApartmentId === apt._id ? "selected" : ""}`}
                    key={apt._id}
                    type="button"
                    onClick={() => setSelectedApartmentId(apt._id)}
                  >
                    <strong>{apt.name}</strong>
                    <span>{apt.code}</span>
                    <small>{apt.status}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="hc-actions">
              <Button type="button" disabled={!canGoStep2} onClick={() => setStep(2)}>
                Continua
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="hc-grid">
            <div className="hc-section-box">
              <h4>Seleziona sezioni</h4>
              <div className="hc-chips">
                {sections.map((section) => (
                  <button
                    key={section._id ?? section.code}
                    type="button"
                    className={`hc-chip ${selectedSectionCodes.includes(section.code) ? "active" : ""}`}
                    onClick={() => toggleSection(section.code)}
                  >
                    {section.name} ({section.code})
                  </button>
                ))}
              </div>
            </div>

            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button type="button" disabled={!canGoStep3} onClick={() => setStep(3)}>
                Continua al form
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="hc-grid">
            {sectionFieldMatrix.map((sectionBlock) => (
              <div key={sectionBlock.sectionCode} className="hc-section-box">
                <h4>{sectionBlock.sectionCode}</h4>
                <div className="hc-grid two">
                  {sectionBlock.fields.map((fieldKey) => (
                    <label key={fieldKey}>
                      {toTitle(fieldKey)}
                      <input
                        className={cn(INPUT_LIKE_CLASSES)}
                        type="number"
                        value={formValues[fieldKey] ?? 0}
                        onChange={(e) =>
                          setFormValues((rows) => ({
                            ...rows,
                            [fieldKey]: Number(e.target.value || 0)
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="hc-preview-box">
              <h4>Preview configurazione</h4>
              <pre>
{JSON.stringify(
  {
    apartmentId: selectedApartmentId,
    selectedSectionCodes,
    formValues
  },
  null,
  2
)}
              </pre>
            </div>

            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={() => setStep(2)}>
                Indietro
              </Button>
              <Button type="button" disabled={!canGoStep4} onClick={handleProcess}>
                Avvia processing
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="hc-grid">
            {processingStages.map((stage) => (
              <div key={stage.key} className={`hc-stage-row ${stage.status}`}>
                <span>{stage.label}</span>
                <strong>{stage.status}</strong>
              </div>
            ))}
            <div className="hc-processing">
              <div className="hc-dot-loader" />
              <p>{isLoading ? "Elaborazione configurazione HC in corso..." : "Processing completato"}</p>
            </div>
            {!isLoading && (
              <div className="hc-actions">
                <Button type="button" onClick={() => setStep(5)}>
                  Vai al riepilogo
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="hc-result ok">
            <h4>Configurazione HC salvata</h4>
            <p>
              Appartamento: <strong>{selectedApartment?.name ?? selectedApartmentId}</strong>
            </p>
            <p>
              Sezioni: <strong>{selectedSectionCodes.length}</strong>
            </p>
            <p>
              Campi compilati: <strong>{Object.keys(formValues).length}</strong>
            </p>
            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={reset}>
                Nuova configurazione HC
              </Button>
            </div>
          </div>
        )}

        {message && <p className="generic-table-feedback">{message}</p>}
      </div>
    </section>
  );
};
