import { ArrowRight, Building2, CalendarDays, Handshake, Home, Plug, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { Section } from "../config/routes";

type HowItWorksPageProps = {
  onSectionChange: (section: Section) => void;
};

const saleFlow = [
  "Crea o importa il primo appartamento.",
  "Aggiungi il cliente interessato.",
  "Apri una trattativa collegata all'unita'.",
  "Gestisci proposta e passaggi operativi.",
  "Chiudi il contratto e continua il follow-up.",
];

const rentFlow = [
  "Inserisci l'appartamento e prepara il listino.",
  "Imposta prezzi e disponibilita' se lavori per date o short stay.",
  "Aggiungi il cliente o l'inquilino.",
  "Crea la trattativa e fissa gli appuntamenti.",
  "Conferma il contratto e monitora la relazione.",
];

const sectionGuide: Array<{ title: string; description: string; icon: typeof Home }> = [
  {
    title: "Home",
    description: "Ti aiuta a capire cosa fare oggi: priorita', task e prossimi appuntamenti.",
    icon: Home,
  },
  {
    title: "Clienti",
    description: "Raccoglie le persone interessate a comprare, vendere o affittare.",
    icon: Users,
  },
  {
    title: "Appartamenti",
    description: "Contiene le unita' immobiliari del progetto e il loro stato.",
    icon: Building2,
  },
  {
    title: "Trattative",
    description: "Collega clienti e appartamenti dentro un flusso operativo chiaro.",
    icon: Handshake,
  },
  {
    title: "Calendario",
    description: "Ti mostra visite, appuntamenti e attivita' da gestire nel tempo.",
    icon: CalendarDays,
  },
  {
    title: "Integrazioni",
    description: "Configura connettori, automazioni, API e canali come ZEUS.",
    icon: Plug,
  },
];

const StepList = ({ items }: { items: string[] }) => (
  <ol className="space-y-3">
    {items.map((item, index) => (
      <li key={item} className="flex items-start gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {index + 1}
        </span>
        <span className="pt-1 text-sm text-muted-foreground">{item}</span>
      </li>
    ))}
  </ol>
);

export const HowItWorksPage = ({ onSectionChange }: HowItWorksPageProps) => {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Orientamento prodotto</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">FollowUp ti accompagna dal dato iniziale alla chiusura della trattativa.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Non serve imparare tutto insieme: inizia da progetto, appartamenti, clienti e trattative. Il resto serve per rendere il flusso piu'
              veloce, piu' leggibile e piu' ripetibile.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="gap-2" onClick={() => onSectionChange("cockpit")}>
              Apri Home
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => onSectionChange("projects")}>
              Vai ai Progetti
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => onSectionChange("integrations")}
            >
              Apri Integrazioni
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Flusso vendita</h3>
          <p className="mt-1 text-sm text-muted-foreground">Il percorso minimo per partire bene senza perdersi nella piattaforma.</p>
          <div className="mt-5">
            <StepList items={saleFlow} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Flusso affitto</h3>
          <p className="mt-1 text-sm text-muted-foreground">Stesso principio, con piu' attenzione a prezzi, disponibilita' e appuntamenti.</p>
          <div className="mt-5">
            <StepList items={rentFlow} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Dove trovi cosa</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ogni schermata dovrebbe rispondere a una domanda semplice. Questa e' la mappa rapida per orientarsi.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sectionGuide.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-border bg-background/80 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-muted/20 p-6">
        <h3 className="text-lg font-semibold text-foreground">Ordine consigliato per partire</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => onSectionChange("projects")}
            className="rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">1. Configura il contesto</p>
            <p className="mt-2 text-sm font-medium text-foreground">Progetti e workspace</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Definisci dove lavori e quali dati stai gestendo.</p>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange("apartments")}
            className="rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">2. Carica l'inventario</p>
            <p className="mt-2 text-sm font-medium text-foreground">Appartamenti</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Inserisci o importa le unita' da gestire.</p>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange("requests")}
            className="rounded-xl border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">3. Metti in moto il CRM</p>
            <p className="mt-2 text-sm font-medium text-foreground">Clienti e trattative</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Apri le prime opportunita' e segui il workflow operativo.</p>
          </button>
        </div>
      </section>
    </div>
  );
};
