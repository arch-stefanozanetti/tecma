import { useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { CompleteFlowPayload, ConfigurationTemplateSchema, HCMasterEntityRecord } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { INPUT_LIKE_CLASSES } from "../../lib/ds-form-classes";
import { cn } from "../../lib/utils";

interface CompleteFlowPageProps {
  workspaceId: string;
  projectIds: string[];
}

type DealStatus = "proposta" | "compromesso" | "rogito";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const toNumber = (value: string) => Number(value || 0);
const keyFromCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const initialForm = {
  apartmentName: "",
  apartmentCode: "",
  apartmentPrice: "",
  apartmentFloor: "",
  apartmentSurfaceMq: "",
  apartmentMode: "SELL" as "SELL" | "RENT",
  apartmentStatus: "AVAILABLE" as "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED",
  apartmentPlanimetryUrl: "",
  sectionCodes: [] as string[],
  formValues: {} as Record<string, number>,
  associationClientId: "",
  associationStatus: "proposta" as DealStatus
};

const getFieldsForSection = (template: ConfigurationTemplateSchema | null, sectionCode: string): string[] => {
  if (!template) return [`${keyFromCode(sectionCode)}_mq`, `${keyFromCode(sectionCode)}_count`];
  const normalized = sectionCode.toLowerCase();
  const hit = template.sections.find((section) => {
    const id = section.id.toLowerCase();
    const title = section.title.toLowerCase();
    return id === normalized || id.includes(normalized) || title.includes(normalized);
  });
  if (!hit || hit.fields.length === 0) return [`${keyFromCode(sectionCode)}_mq`, `${keyFromCode(sectionCode)}_count`];
  return hit.fields.map((field) => field.key);
};

export const CompleteFlowPage = ({ workspaceId, projectIds }: CompleteFlowPageProps) => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [form, setForm] = useState(initialForm);
  const [sections, setSections] = useState<HCMasterEntityRecord[]>([]);
  const [clients, setClients] = useState<Array<{ _id: string; fullName: string; email: string }>>([]);
  const [template, setTemplate] = useState<ConfigurationTemplateSchema | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [executeResult, setExecuteResult] = useState<string>("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const projectId = projectIds[0] ?? "";

  useEffect(() => {
    void Promise.all([
      followupApi.queryHCMaster("section", {
        workspaceId,
        projectIds,
        page: 1,
        perPage: 300,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      followupApi.queryClientsLite(workspaceId, projectIds),
      followupApi.getTemplateConfiguration(projectId).catch(() => ({ template: null as ConfigurationTemplateSchema | null }))
    ])
      .then(([sectionRows, clientRows, tpl]) => {
        setSections(sectionRows.data);
        setClients(clientRows.data);
        setTemplate(tpl.template);
      })
      .catch(() => {
        setSections([]);
        setClients([]);
        setTemplate(null);
      });
  }, [workspaceId, projectIds, projectId]);

  const selectedClient = useMemo(() => clients.find((client) => client._id === form.associationClientId), [clients, form.associationClientId]);

  const sectionFieldMatrix = useMemo(
    () =>
      form.sectionCodes.map((sectionCode) => ({
        code: sectionCode,
        fields: getFieldsForSection(template, sectionCode)
      })),
    [form.sectionCodes, template]
  );

  const payload = useMemo((): CompleteFlowPayload => {
    return {
      workspaceId,
      projectId,
      apartment: {
        name: form.apartmentName,
        code: form.apartmentCode,
        price: toNumber(form.apartmentPrice),
        floor: toNumber(form.apartmentFloor),
        mode: form.apartmentMode,
        status: form.apartmentStatus,
        surfaceMq: toNumber(form.apartmentSurfaceMq),
        planimetryUrl: form.apartmentPlanimetryUrl
      },
      hc: {
        selectedSectionCodes: form.sectionCodes,
        selectedSectionIds: [],
        formValues: form.formValues,
        finishesPrices: []
      },
      association: {
        clientId: form.associationClientId,
        status: form.associationStatus
      }
    };
  }, [workspaceId, projectId, form]);

  const canProceed = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(form.apartmentName && form.apartmentCode && form.apartmentPlanimetryUrl);
    }
    if (currentStep === 2) {
      return true;
    }
    if (currentStep === 3) {
      return form.sectionCodes.length > 0;
    }
    if (currentStep === 4) {
      return sectionFieldMatrix.every((section) => section.fields.every((field) => Number.isFinite(form.formValues[field])));
    }
    if (currentStep === 5) {
      return true;
    }
    if (currentStep === 6) {
      return Boolean(form.associationClientId);
    }
    if (currentStep === 7) {
      return Boolean(form.associationStatus);
    }
    return true;
  }, [currentStep, form, sectionFieldMatrix]);

  const safeSetStep = (step: number) => setCurrentStep(Math.max(1, Math.min(9, step)) as Step);

  const onNext = () => {
    if (!canProceed && currentStep < 8) {
      setError("Completa i campi richiesti prima di procedere");
      return;
    }
    setError(null);
    if (currentStep < 9) safeSetStep(currentStep + 1);
  };

  const onBack = () => {
    setError(null);
    if (currentStep > 1) safeSetStep(currentStep - 1);
  };

  const toggleSection = (sectionCode: string) => {
    setForm((prev) => ({
      ...prev,
      sectionCodes: prev.sectionCodes.includes(sectionCode)
        ? prev.sectionCodes.filter((code) => code !== sectionCode)
        : [...prev.sectionCodes, sectionCode]
    }));
  };

  const doPreview = async () => {
    setIsLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const response = await followupApi.previewCompleteFlow(payload);
      setPreview(JSON.stringify(response, null, 2));
      setWarnings(response.warnings ?? []);
      setCurrentStep(8);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore preview");
    } finally {
      setIsLoading(false);
    }
  };

  const doExecute = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await followupApi.executeCompleteFlow(payload);
      setExecuteResult(JSON.stringify(response, null, 2));
      setCurrentStep(9);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore execute");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="hc-shell complete-flow-shell">
      <div className="hc-card">
        <div className="hc-head">
          <h3>Configura Flusso Completo</h3>
          <p>Wizard enterprise a 9 step con validazioni, preview e execute finale.</p>
        </div>

        <div className="hc-progress">
          <div className="hc-progress-bar" style={{ width: `${(currentStep / 9) * 100}%` }} />
        </div>

        <div className="hc-stepper long">
          <span className={currentStep >= 1 ? "active" : ""}>1 Apartment</span>
          <span className={currentStep >= 2 ? "active" : ""}>2 Process Apt</span>
          <span className={currentStep >= 3 ? "active" : ""}>3 HC Sections</span>
          <span className={currentStep >= 4 ? "active" : ""}>4 HC Form</span>
          <span className={currentStep >= 5 ? "active" : ""}>5 Process HC</span>
          <span className={currentStep >= 6 ? "active" : ""}>6 Client</span>
          <span className={currentStep >= 7 ? "active" : ""}>7 Deal Status</span>
          <span className={currentStep >= 8 ? "active" : ""}>8 Preview</span>
          <span className={currentStep >= 9 ? "active" : ""}>9 Execute</span>
        </div>

        <div className="complete-flow-layout">
          <div className="complete-flow-main">
            {currentStep === 1 && (
              <div className="hc-grid two">
                <label>
                  Nome appartamento
                  <Input value={form.apartmentName} onChange={(e) => setForm((s) => ({ ...s, apartmentName: e.target.value }))} className="w-full" />
                </label>
                <label>
                  Codice appartamento
                  <Input value={form.apartmentCode} onChange={(e) => setForm((s) => ({ ...s, apartmentCode: e.target.value }))} className="w-full" />
                </label>
                <label>
                  Prezzo
                  <Input value={form.apartmentPrice} onChange={(e) => setForm((s) => ({ ...s, apartmentPrice: e.target.value }))} className="w-full" />
                </label>
                <label>
                  Piano
                  <Input value={form.apartmentFloor} onChange={(e) => setForm((s) => ({ ...s, apartmentFloor: e.target.value }))} className="w-full" />
                </label>
                <label>
                  Superficie
                  <Input value={form.apartmentSurfaceMq} onChange={(e) => setForm((s) => ({ ...s, apartmentSurfaceMq: e.target.value }))} className="w-full" />
                </label>
                <label>
                  Planimetria URL
                  <Input
                    value={form.apartmentPlanimetryUrl}
                    onChange={(e) => setForm((s) => ({ ...s, apartmentPlanimetryUrl: e.target.value }))}
                    className="w-full"
                  />
                </label>
              </div>
            )}

            {currentStep === 2 && (
              <div className="hc-processing">
                <div className="hc-dot-loader" />
                <p>Step 2: elaborazione dati appartamento pronta. Procedi al modulo HC.</p>
              </div>
            )}

            {currentStep === 3 && (
              <div className="hc-section-box">
                <h4>Selezione sezioni HC</h4>
                <div className="hc-chips">
                  {sections.map((section) => (
                    <button
                      key={section._id ?? section.code}
                      className={`hc-chip ${form.sectionCodes.includes(section.code) ? "active" : ""}`}
                      type="button"
                      onClick={() => toggleSection(section.code)}
                    >
                      {section.name} ({section.code})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="hc-grid">
                {sectionFieldMatrix.map((section) => (
                  <div key={section.code} className="hc-section-box">
                    <h4>{section.code}</h4>
                    <div className="hc-grid two">
                      {section.fields.map((field) => (
                        <label key={field}>
                          {field}
                          <Input
                            type="number"
                            value={form.formValues[field] ?? 0}
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                formValues: {
                                  ...s.formValues,
                                  [field]: Number(e.target.value || 0)
                                }
                              }))
                            }
                            className="w-full"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStep === 5 && (
              <div className="hc-processing">
                <div className="hc-dot-loader" />
                <p>Step 5: processing HC completato. Puoi procedere alla selezione cliente.</p>
              </div>
            )}

            {currentStep === 6 && (
              <div className="hc-grid">
                <label>
                  Cliente
                  <select
                    className={cn(INPUT_LIKE_CLASSES)}
                    value={form.associationClientId}
                    onChange={(e) => setForm((s) => ({ ...s, associationClientId: e.target.value }))}
                  >
                    <option value="">Seleziona cliente</option>
                    {clients.map((client) => (
                      <option key={client._id} value={client._id}>
                        {client.fullName} ({client.email})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {currentStep === 7 && (
              <div className="hc-grid">
                <label>
                  Stato trattativa
                  <select
                    className={cn(INPUT_LIKE_CLASSES)}
                    value={form.associationStatus}
                    onChange={(e) => setForm((s) => ({ ...s, associationStatus: e.target.value as DealStatus }))}
                  >
                    <option value="proposta">proposta</option>
                    <option value="compromesso">compromesso</option>
                    <option value="rogito">rogito</option>
                  </select>
                </label>
              </div>
            )}

            {currentStep === 8 && (
              <div className="hc-grid">
                <div className="hc-preview-box">
                  <h4>Preview Result</h4>
                  <pre>{preview || "Esegui preview per visualizzare il risultato"}</pre>
                </div>
                {warnings.length > 0 && (
                  <div className="hc-result warn">
                    <h4>Warnings</h4>
                    <ul>
                      {warnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {currentStep === 9 && (
              <div className="hc-grid">
                <div className="hc-result ok">
                  <h4>Execute completato</h4>
                  <p>Il flusso completo e stato eseguito.</p>
                </div>
                <div className="hc-preview-box">
                  <h4>Execute Result</h4>
                  <pre>{executeResult || "Nessun risultato disponibile"}</pre>
                </div>
              </div>
            )}

            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={onBack} disabled={currentStep === 1 || isLoading}>
                Back
              </Button>
              {currentStep < 8 && (
                <Button type="button" onClick={onNext} disabled={isLoading}>
                  Next
                </Button>
              )}
              {currentStep <= 8 && (
                <Button variant="outline" type="button" onClick={doPreview} disabled={isLoading}>
                  Preview
                </Button>
              )}
              {currentStep >= 8 && (
                <Button type="button" onClick={doExecute} disabled={isLoading}>
                  Execute
                </Button>
              )}
            </div>
          </div>

          <aside className="complete-flow-side">
            <h4>Flow Summary</h4>
            <div className="insight ok">
              <strong>Apartment</strong>
              <p>
                {form.apartmentName || "-"} ({form.apartmentCode || "-"})
              </p>
            </div>
            <div className="insight ok">
              <strong>HC</strong>
              <p>
                {form.sectionCodes.length} sezioni, {Object.keys(form.formValues).length} campi
              </p>
            </div>
            <div className="insight ok">
              <strong>Cliente</strong>
              <p>{selectedClient ? `${selectedClient.fullName} (${selectedClient.email})` : "Non selezionato"}</p>
            </div>
            <div className={`insight ${warnings.length > 0 ? "warn" : "ok"}`}>
              <strong>Warnings</strong>
              <p>{warnings.length > 0 ? `${warnings.length} warning in preview` : "Nessun warning"}</p>
            </div>

            <div className="hc-preview-box">
              <h4>Payload corrente</h4>
              <pre>{JSON.stringify(payload, null, 2)}</pre>
            </div>
          </aside>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
};
