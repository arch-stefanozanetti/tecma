/**
 * Dati strutturati assessment COIMA / BTS vs Tecma Followup 3.0.
 * Fonte: docs/deliverables/COIMA_BTS_TECMA_GAP_ASSESSMENT.md
 */
export type CoimaStatus = "si" | "parziale" | "no" | "misto";

export interface CoimaRow {
  n: number;
  title: string;
  status: CoimaStatus;
  note: string;
  extra?: string;
}

export interface CoimaPhase {
  id: string;
  /** Breve etichetta UI */
  shortLabel: string;
  title: string;
  subtitle: string;
  accent: string;
  rows: CoimaRow[];
}

function row(
  n: number,
  title: string,
  status: CoimaStatus,
  note: string,
  extra?: string
): CoimaRow {
  return { n, title, status, note, extra };
}

/**
 * Contesto da posizione COIMA (es. interlocuzione commerciale): il complesso è inquadrato come
 * mixed-use in contesto sicuro, con intenzione di concentrare priorità su build-to-sell.
 */
export const COIMA_PROJECT_CONTEXT = {
  title: "Contesto progetto",
  summary:
    "Progetto **mixed-use** in contesto **sicuro**; da parte COIMA la priorità operativa e commerciale dichiarata è **build-to-sell** — concentrare risorse e racconto sul canale vendita.",
  scopeNote:
    "L’assessment e i requisiti mappati seguono il perimetro **vendita / ciclo cliente BTS**; altre destinazioni o canali restano fuori focus in questo documento salvo estensione esplicita.",
} as const;

export const COIMA_PHASES: CoimaPhase[] = [
  {
    id: "prospect",
    shortLabel: "Prospect",
    title: "Prospect",
    subtitle: "Iscrizione, lead, prima trattativa",
    accent: "from-cyan-500/20 to-teal-600/30",
    rows: [
      row(1, "Dati personali anagrafici", "si", "Clienti `tz_clients`: nome, contatti, stato, storico.", "Matching cliente–unità; duplicati email per workspace."),
      row(2, "Privacy / consensi", "parziale", "Flag profilazione, trattamento, marketing e documentazione GDPR in `docs/`.", "Attribution marketing (UTM/gclid) per analytics."),
      row(3, "Residenza / indirizzo", "parziale", "Città e dati famiglia dove presenti; indirizzo completo se in `additionalInfo` / estensioni."),
      row(4, "Fonte contatto", "si", "Campo `source` su cliente."),
      row(5, "Tipologie di appartamento di interesse", "si", "Unità selezionate / interessate collegate al cliente.", "Catalogo appartamenti multi-progetto."),
      row(6, "Primi riferimenti di budget", "si", "Campo `budget` (cliente)."),
      row(7, "Gestione appuntamenti", "si", "Calendario (eventi per workspace/progetto)."),
      row(8, "Feedback appuntamenti", "parziale", "Tracciabile con note su cliente o evento; non un questionario standard post-visita in prodotto."),
      row(9, "Gestione richieste (pipeline)", "si", "Trattative `tz_requests` + workflow configurabile.", "Stati terminali, lock unità dove configurato."),
      row(10, "Materiale fornito e inviato", "parziale", "Comunicazioni e allegati dove previsti dal flusso; non un “DMAT” unico numerato.", "Connettori verso strumenti di invio (roadmap)."),
      row(11, "Scambio ulteriore di informazioni", "parziale", "Note, thread comunicazioni, allegati.", "AI suggestion / cockpit (dove abilitato)."),
      row(12, "Consulente commerciale che ha gestito il caso", "si", "Assegnazione entità (`tz_entity_assignments`) e ruoli.", "RBAC granulare per modulo/azione."),
      row(13, "Nuovi appuntamenti", "si", "Calendario."),
      row(14, "Raccolta documenti", "parziale", "Documenti cliente dove il modulo è attivo (`client-documents`); copertura dipende da deploy/permessi."),
      row(15, "Procedura AML", "no", "Nessun modulo AML dedicato in Followup 3.0."),
    ],
  },
  {
    id: "preliminare",
    shortLabel: "Preliminare",
    title: "Cliente — Preliminare",
    subtitle: "Contratto preliminare e condizioni economiche",
    accent: "from-violet-500/20 to-fuchsia-600/25",
    rows: [
      row(1, "Intestatari del preliminare", "parziale", "Trattativa e soggetti collegabili a cliente/unità; struttura “intestatari multipli” se non modellata 1:1 col legale."),
      row(2, "Prima o seconda casa (IVA)", "parziale", "Tracciabile in metadati / note / preventivo in evoluzione."),
      row(3, "Prezzo", "misto", "Prezzo in trattativa/quote dove presente; FASE2 preventivo digitale per completezza."),
      row(4, "Importo caparra e acconti", "parziale", "Voci economiche in evoluzione (quote); non contabilità completa."),
      row(5, "Termini di consegna", "parziale", "Milestone / date in progetto o note; non Gantt cantiere nativo."),
      row(6, "Unità, cantina, box", "si", "Appartamenti e associazioni cliente–unità.", "Planimetrie / asset S3 dove configurato."),
      row(7, "Capitolato", "parziale", "Allegati e testi su trattativa/progetto; non editor capitolato dedicato."),
      row(8, "Clausole adeguamento prezzo (es. ISTAT)", "no", "Non motore clausole legali."),
      row(9, "Penali per ritardi", "parziale", "Note / campo custom se introdotto; non calcolo automatico."),
      row(10, "Termini personalizzazioni vs avanzamento lavori", "parziale", "HC e milestone “soft”; vincolo stretto cantiere → No come automazione nativa.", "Home Configurator (varianti)."),
      row(11, "Rilascio fideiussioni (es. L. 210)", "no", "Workflow legale/assicurativo esterno."),
      row(12, "Registrazione del preliminare", "no", "Adempimento notarile/registro esterno."),
      row(13, "Gestione pagamenti / assegni", "no", "Nessun modulo tesoreria/pagamenti incassati."),
      row(14, "Rilascio quietanza", "no", "Documento contabile esterno."),
      row(15, "Area riservata cliente (web/app) con storico “vita immobiliare”", "parziale", "CRM interno completo; portale cliente unico tipo “tutto il ciclo” in roadmap a pezzi (magic link, quote, doc — vedi piano).", "Stesso dato su trattativa per team interno."),
    ],
  },
  {
    id: "vita",
    shortLabel: "Vita fino a consegna",
    title: "Vita immobiliare (fino a consegna)",
    subtitle: "Cantiere, personalizzazioni, consegna",
    accent: "from-amber-500/20 to-orange-600/25",
    rows: [
      row(1, "Richieste varie", "si", "Trattative + task/comunicazioni.", "Workflow personalizzabile per workspace."),
      row(2, "Planning pagamenti acconti", "parziale", "Promemoria/calendario; non pianificazione finanziaria integrata."),
      row(3, "Planning e pre-avviso", "parziale", "Calendario + notifiche dove attive.", "FASE5 sync calendario esterno (roadmap)."),
      row(4, "Solleciti", "parziale", "Reminder/inbox in evoluzione; FASE7 contratto inbox."),
      row(5, "Aggiornamento DB “flag pagato”", "no", "Non contabilità; eventuale campo custom manuale."),
      row(6, "Eventuali pre-contenziosi", "parziale", "Note e stati; non case legal management."),
      row(7, "Personalizzazioni layout (std / custom architetto)", "parziale", "HC e varianti; custom con architetto = processo + allegati.", "Editor planimetrie / sperimentalità (es. Pascal) dove in roadmap."),
      row(8, "Preventivi – approvazione – pagamenti", "parziale", "Offerte/quote in evoluzione (FASE2); pagamenti → No."),
      row(9, "Interazione team progetto / impresa (tempi, certificazioni, aggiornamento esecutivo)", "parziale", "Comunicazioni e allegati; non PLM/BIM integrato."),
      row(10, "Scelta finiture (mood / a la carte)", "parziale", "HC finiture dove configurato per progetto.", "Cataloghi e template HC."),
      row(11, "Negoziazione set varianti in gara (mark-up)", "no", "Logica economica offerta vs impresa non nativa."),
      row(12, "Home configurator + showroom partner", "parziale", "HC sì; gestione fisica showroom → processo."),
      row(13, "Aggiornamenti periodici, newsletter, auguri, eventi", "parziale", "Automazioni email / connettori (Mailchimp, ActiveCampaign) in roadmap FASE6."),
      row(14, "Gestione complain / pre-contenzioso / contenzioso", "parziale", "Tracciamento leggero su trattativa; non ticketing legale."),
      row(15, "Informazioni su tempistiche effettive di consegna", "parziale", "Date/milestone a livello progetto o comunicazione; non campo “data certa” automatica da cantiere."),
      row(16, "Regolamento condominio", "parziale", "Allegato/documento sì; processo condominiale → No."),
      row(17, "Misurazioni vani per arredo", "no", "Non strumento misurazione; allegati manuali."),
      row(18, "Pre-consegna: pulizia, visita, verbale NC", "parziale", "Verbale come doc/checklist se definita in progetto; workflow dedicato NC → Parziale/No."),
      row(19, "Condivisione stato risoluzione NC con cliente", "parziale", "Portale limitato; internamente note/allegati."),
      row(20, "Consegna: pulizia finale, verbale, variazione intestatari", "parziale", "Dati anagrafici e note; variazione intestatari = adempimento notarile esterno.", "Associazioni `future` (demo)."),
      row(21, "Appuntamenti notaio, preventivi", "parziale", "Calendario + note; integrazione notai No."),
      row(22, "Pagamento corrispettivo / contabilità", "no", "—"),
      row(23, "Prima tranche spese condominiali", "no", "—"),
      row(24, "Consegna chiavi, telecomandi, manuali SW, regolamento SW", "parziale", "Checklist/documenti se modellati; non gestione inventario fisico."),
      row(25, "Attivazione cablaggi / WiFi", "no", "Operativo/telco."),
      row(26, "Selezione amministratore e integrazione suoi applicativi", "no", "—", "Integrazioni generiche in roadmap."),
      row(27, "Partecipazione assemblee", "no", "—"),
      row(28, "Budget spese, contratti manutenzione", "no", "—"),
      row(29, "Selezione personale front-end (concierge)", "no", "HR/operativo."),
    ],
  },
  {
    id: "post",
    shortLabel: "Post consegna",
    title: "Vita immobiliare (post consegna)",
    subtitle: "After-sales, facility, contenzioso leggero",
    accent: "from-rose-500/15 to-slate-700/40",
    rows: [
      row(1, "Ripristino NC post rogito", "parziale", "Ticket leggeri solo se modellati come richieste/note; non FM completo."),
      row(2, "Presa appuntamenti, verbali esecuzione opere", "parziale", "Come sopra."),
      row(3, "Mappatura no-show o ritardi impresa", "no", "—"),
      row(4, "Presidio COIMA in loco", "no", "Attività fisica."),
      row(5, "Presidio impresa in loco", "no", "—"),
      row(6, "Gestione urgenze (perdite, HVAC, …)", "no", "Call center / facility."),
      row(7, "Social media, complain, monitoraggio", "no", "Listening nativo assente; export verso tool esterni possibile in astratto."),
      row(8, "Coordinamento traslochi", "no", "—"),
      row(9, "Monitoraggio condominio e spese", "no", "ERP condominio esterno."),
      row(10, "Check impianti stagionali", "no", "—"),
      row(11, "Complain formali, pre-contenzioso, contenzioso", "parziale", "Stati/note su relazione commerciale; non legal case management."),
    ],
  },
];

export const COIMA_EXTRAS_TECMA: string[] = [
  "Multi-workspace / multi-progetto con RBAC e assegnazioni",
  "Workflow vendita/affitto configurabile (`tz_workflow_*`) e lock unità",
  "Home Configurator e asset S3 dove attivi",
  "Matching cliente–unità (endpoint dedicati)",
  "Cockpit e AI suggestions per priorità operative",
  "Big Data / analytics (es. GA4) dove configurato",
  "API esposte (openapi, platform key) per integrare siti e terzi",
  "Report ed export; roadmap dashboard condivisibili (FASE4)",
];

export const COIMA_RISKS: { title: string; body: string }[] = [
  {
    title: "Confine di prodotto, non “ritardo”",
    body: "Le celle «No» indicano attività fuori dal perimetro nativo del CRM (tesoreria, legal pesante, presidio fisico, social listening): si gestiscono con processo o integrazione.",
  },
  {
    title: "Ogni «Parziale» va validato in workshop",
    body: "Si decide se il modello attuale (note, workflow, HC, allegati) basta o se serve una FASE prodotto (preventivo digitale, inbox, portale) o un connettore verso sistemi specialistici.",
  },
  {
    title: "Vivere documento",
    body: "Aggiornare l’assessment quando una voce passa da Parziale a Sì in una release, per tracciare maturità commerciale.",
  },
];

/** Mermaid: percorso cliente sintetico (storytelling, non timeline reale). */
export const COIMA_GANTT_JOURNEY = `gantt
    title Percorso vita cliente — visione COIMA (macro-fasi)
    dateFormat  YYYY-MM-DD

    section Prospect
    Lead qualifica e CRM        :p1, 2026-01-01, 45d

    section Preliminare
    Preliminare e condizioni    :p2, after p1, 60d

    section Vita
    Cantiere e personalizzazioni :p3, after p2, 270d

    section Post
    After-sales e assistenza    :p4, after p3, 90d
`;

/** Roadmap Tecma citata nel documento (indicativa). */
export const COIMA_GANTT_ROADMAP = `gantt
    title Roadmap Tecma — FASI citate nell’assessment
    dateFormat  YYYY-MM-DD

    section Prodotto
    FASE2 Digital quote / preventivo    :f2, 2026-02-01, 150d
    FASE5 Sync calendario esterno       :f5, after f2, 120d
    FASE6 Connettori (email/marketing)  :f6, after f5, 150d
    FASE7 Inbox / contratto             :f7, after f6, 120d
    FASE4 Dashboard condivisibili       :f4, 2026-06-01, 180d
`;

export function statusLabel(s: CoimaStatus): string {
  switch (s) {
    case "si":
      return "Sì";
    case "parziale":
      return "Parziale";
    case "no":
      return "No";
    case "misto":
      return "Sì / Parziale";
    default:
      return s;
  }
}

/** Per gli stack chart: misto conta come parziale. */
export function rowCounts(phase: CoimaPhase): { si: number; parziale: number; no: number; total: number } {
  let si = 0;
  let parziale = 0;
  let no = 0;
  for (const r of phase.rows) {
    if (r.status === "si") si += 1;
    else if (r.status === "parziale" || r.status === "misto") parziale += 1;
    else no += 1;
  }
  return { si, parziale, no, total: phase.rows.length };
}

export function globalTotals(): {
  si: number;
  parziale: number;
  no: number;
  total: number;
  pctSi: number;
  pctParziale: number;
  pctNo: number;
} {
  let si = 0;
  let parziale = 0;
  let no = 0;
  let total = 0;
  for (const p of COIMA_PHASES) {
    const c = rowCounts(p);
    si += c.si;
    parziale += c.parziale;
    no += c.no;
    total += c.total;
  }
  return {
    si,
    parziale,
    no,
    total,
    pctSi: total ? Math.round((si / total) * 1000) / 10 : 0,
    pctParziale: total ? Math.round((parziale / total) * 1000) / 10 : 0,
    pctNo: total ? Math.round((no / total) * 1000) / 10 : 0,
  };
}
