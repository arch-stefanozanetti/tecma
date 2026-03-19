import { FormEvent, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { followupApi } from "../../api/followupApi";
import type { ApartmentCreateInput } from "../../types/domain";

const CreateApartmentFormSchema = z.object({
  name: z.string(),
  code: z.string(),
  price: z.string(),
  deposit: z.string(),
  floor: z.string(),
  surfaceMq: z.string(),
  planimetryUrl: z.string(),
  mode: z.enum(["RENT", "SELL"]),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED"]),
});

const CreateApartmentSessionSchema = z.object({
  step: z.number().min(1).max(3),
  form: CreateApartmentFormSchema,
});
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

interface CreateApartmentPageProps {
  workspaceId: string;
  projectIds: string[];
  onCreated?: (apartmentId: string) => void;
}

type WizardStep = 1 | 2 | 3; // 1=dati base, 2=dati dettaglio, 3=esito

type CreateApartmentForm = {
  name: string;
  code: string;
  price: string;
  deposit: string;
  floor: string;
  surfaceMq: string;
  planimetryUrl: string;
  mode: "RENT" | "SELL";
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
};

const initialForm: CreateApartmentForm = {
  name: "",
  code: "",
  price: "",
  deposit: "",
  floor: "",
  surfaceMq: "",
  planimetryUrl: "",
  mode: "SELL" as const,
  status: "AVAILABLE" as const
};

const SESSION_KEY = "followup.create-apartment.session";

export const CreateApartmentPage = ({ workspaceId, projectIds, onCreated }: CreateApartmentPageProps) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState(initialForm);
  const [createdApartmentId, setCreatedApartmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);

  const projectId = useMemo(() => projectIds[0] ?? "", [projectIds]);
  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = CreateApartmentSessionSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        setForm({ ...initialForm, ...parsed.data.form });
        setStep(parsed.data.step as WizardStep);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    void followupApi
      .queryApartments({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      })
      .then((result) => setExistingNames(result.data.map((apartment) => apartment.name.toLowerCase().trim())))
      .catch(() => setExistingNames([]));
  }, [workspaceId, projectIds]);

  const validate = (): string | null => {
    if (!form.name.trim() || !form.code.trim() || !form.planimetryUrl.trim()) {
      return "Nome, codice e planimetria sono obbligatori";
    }
    if (existingNames.includes(form.name.trim().toLowerCase())) {
      return "Esiste già un appartamento con questo nome nel progetto";
    }
    if (Number.isNaN(Number(form.price || 0)) || Number(form.price || 0) < 0) {
      return "Prezzo non valido";
    }
    if (Number.isNaN(Number(form.floor || 0)) || Number(form.floor || 0) < 0) {
      return "Piano non valido";
    }
    return null;
  };

  const goToStep2 = () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError("Nome e codice sono obbligatori");
      return;
    }
    setError(null);
    setStep(2);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload: ApartmentCreateInput = {
        workspaceId,
        projectId,
        name: form.name.trim(),
        code: form.code.trim(),
        price: Number(form.price || 0),
        floor: Number(form.floor || 0),
        surfaceMq: Number(form.surfaceMq || 0),
        planimetryUrl: form.planimetryUrl.trim(),
        mode: form.mode,
        status: form.status
      };
      if (form.mode === "RENT" && form.deposit.trim() !== "") {
        const d = Number(form.deposit);
        if (!Number.isNaN(d) && d >= 0) payload.deposit = d;
      }
      const response = await followupApi.createApartment(payload);
      setCreatedApartmentId(response.apartmentId);
      setStep(3); // esito
      sessionStorage.removeItem(SESSION_KEY);
      onCreated?.(response.apartmentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore creazione appartamento");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setCreatedApartmentId(null);
    setForm(initialForm);
    setError(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const saveSession = () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        step,
        form
      })
    );
  };

  return (
    <section className="hc-shell">
      <div className="hc-card">
        <div className="hc-head">
          <h3>Crea Appartamento</h3>
          <p>Wizard operativo in 3 step con validazioni progetto e ripristino sessione.</p>
        </div>

        <div className="hc-progress">
          <div className="hc-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="hc-stepper">
          <span className={step >= 1 ? "active" : ""}>1. Dati base</span>
          <span className={step >= 2 ? "active" : ""}>2. Dettaglio</span>
          <span className={step >= 3 ? "active" : ""}>3. Esito</span>
        </div>

        {step === 1 && (
          <form className="hc-grid" onSubmit={(e) => { e.preventDefault(); goToStep2(); }}>
            <label>
              Nome appartamento *
              <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className="w-full" required />
            </label>
            <label>
              Codice *
              <Input value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} className="w-full" required />
            </label>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Modalità</label>
              <Select value={form.mode} onValueChange={(v) => setForm((s) => ({ ...s, mode: v as "RENT" | "SELL" }))}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELL">Vendita</SelectItem>
                  <SelectItem value="RENT">Affitto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={saveSession}>
                Salva sessione
              </Button>
              <Button type="submit">
                Avanti
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form className="hc-grid" onSubmit={submit}>
            <div className="col-span-full rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p><span className="text-muted-foreground">Nome:</span> {form.name}</p>
              <p><span className="text-muted-foreground">Codice:</span> {form.code}</p>
              <p><span className="text-muted-foreground">Modalità:</span> {form.mode === "RENT" ? "Affitto" : "Vendita"}</p>
            </div>
            <label>
              {form.mode === "RENT" ? "Canone mensile (€)" : "Prezzo vendita (€)"}
              <Input value={form.price} onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))} className="w-full" />
            </label>
            {form.mode === "RENT" && (
              <label>
                Deposito (€, opzionale)
                <Input value={form.deposit} onChange={(e) => setForm((s) => ({ ...s, deposit: e.target.value }))} className="w-full" type="number" min={0} />
              </label>
            )}
            <label>
              Piano
              <Input value={form.floor} onChange={(e) => setForm((s) => ({ ...s, floor: e.target.value }))} className="w-full" />
            </label>
            <label>
              Superficie mq
              <Input value={form.surfaceMq} onChange={(e) => setForm((s) => ({ ...s, surfaceMq: e.target.value }))} className="w-full" />
            </label>
            <label>
              URL planimetria *
              <Input value={form.planimetryUrl} onChange={(e) => setForm((s) => ({ ...s, planimetryUrl: e.target.value }))} className="w-full" required />
            </label>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Stato</label>
              <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED" }))}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Disponibile</SelectItem>
                  <SelectItem value="RESERVED">Riservato</SelectItem>
                  <SelectItem value="SOLD">Venduto</SelectItem>
                  <SelectItem value="RENTED">Affittato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="hc-actions">
              <Button variant="outline" type="button" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creazione in corso..." : "Crea appartamento"}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="hc-result ok">
            <h4>Appartamento creato</h4>
            <p>ID: {createdApartmentId}</p>
            <p>
              Prossimo step consigliato: <strong>Crea Appartamento HC</strong>
            </p>
            <Button variant="outline" type="button" onClick={reset}>
              Crea un altro appartamento
            </Button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
};
