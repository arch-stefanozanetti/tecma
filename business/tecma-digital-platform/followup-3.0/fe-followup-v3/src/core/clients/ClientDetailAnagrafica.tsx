import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { STATUS_FILTER_OPTIONS } from "./constants";
import type { AdditionalInfoRow } from "../../types/domain";

export interface ClientDetailAnagraficaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formFullName: string;
  setFormFullName: (v: string) => void;
  formEmail: string;
  setFormEmail: (v: string) => void;
  formPhone: string;
  setFormPhone: (v: string) => void;
  formCity: string;
  setFormCity: (v: string) => void;
  formStatus: string;
  setFormStatus: (v: string) => void;
  formAdditionalInfo: Record<string, unknown>;
  setFormAdditionalInfo: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  additionalInfos: AdditionalInfoRow[];
  onEditSubmit: (e: React.FormEvent) => void;
  formSaving: boolean;
  formSubmitError: string | null;
}

export default function ClientDetailAnagrafica({
  open,
  onOpenChange,
  formFullName,
  setFormFullName,
  formEmail,
  setFormEmail,
  formPhone,
  setFormPhone,
  formCity,
  setFormCity,
  formStatus,
  setFormStatus,
  formAdditionalInfo,
  setFormAdditionalInfo,
  additionalInfos,
  onEditSubmit,
  formSaving,
  formSubmitError,
}: ClientDetailAnagraficaProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="sm:max-w-md">
        <DrawerHeader actions={<DrawerCloseButton />}>
          <DrawerTitle>Modifica cliente</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={onEditSubmit} className="flex flex-col flex-1 min-h-0">
          <DrawerBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Nome *</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                required
                placeholder="Nome e cognome"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                className="min-h-11 rounded-lg border-border"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@esempio.it"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Telefono</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+39 ..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Città</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Città"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="min-h-11 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.filter((o) => o.value !== "all").map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {additionalInfos
              .filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo" && ai.active !== false)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((ai) => (
                <div key={ai._id}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {ai.label}
                    {ai.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  {ai.type === "radio" && ai.options && ai.options.length > 0 ? (
                    <Select
                      value={String(formAdditionalInfo[ai.name] ?? "")}
                      onValueChange={(v) => setFormAdditionalInfo((prev) => ({ ...prev, [ai.name]: v }))}
                    >
                      <SelectTrigger className="min-h-11 rounded-lg border-border">
                        <SelectValue placeholder={`Seleziona ${ai.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {ai.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="min-h-11 rounded-lg border-border"
                      type={ai.type === "number" ? "number" : "text"}
                      value={String(formAdditionalInfo[ai.name] ?? "")}
                      onChange={(e) =>
                        setFormAdditionalInfo((prev) => ({
                          ...prev,
                          [ai.name]:
                            ai.type === "number"
                              ? e.target.value
                                ? Number(e.target.value)
                                : ""
                              : e.target.value,
                        }))
                      }
                      placeholder={ai.label}
                    />
                  )}
                </div>
              ))}
            {formSubmitError && <p className="text-sm text-destructive">{formSubmitError}</p>}
          </DrawerBody>
          <DrawerFooter>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-h-11"
              >
                Annulla
              </Button>
              <Button type="submit" disabled={formSaving} className="min-h-11">
                {formSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
