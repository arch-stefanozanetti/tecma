# ADR — Project Detail legacy overrides: scope ridotto senza merge `rawProject`

- **Stato**: accettato
- **Data**: 2026-05-05
- **Owner**: Tecma Platform
- **Contesto**: Milestone M3 — Project Detail POC-plus (`feat/project-detail-poc-plus`)

## Contesto

Il POC `followup-3.0-POC` implementa un meccanismo di "legacy overrides" che riceve in input un
intero documento legacy (`legacyPayload.rawProject`) e lo mergia nei progetti correnti. Questo
introduce due problemi:

1. **Debito tecnico legacy importato**: il merge di `rawProject` ricicla schemi non normalizzati
   con campi opachi e nomi non camelCase, propagandoli in produzione.
2. **Sicurezza & audit**: il payload legacy può contenere campi sensibili o non controllati;
   un'override globale via merge raw aggira la validazione zod e i permessi per-sezione.

## Decisione

In M3 introduciamo **`tz_project_legacy_overrides`** con schema esplicito e ridotto:

- `identityFields: Record<string, unknown>` — solo i campi identity legacy effettivamente
  necessari (es. `legacyHostId`, `legacyAssetKey`).
- `advancedOverrides: Array<{ path: string; valueType: 'string'|'number'|'boolean'|'json'; value }>` —
  ogni voce documenta esplicitamente il path, il tipo atteso e il valore.

**Non** importiamo `legacyPayload.rawProject` né alcun merge raw. Le sezioni native del Project
Detail (Branding, Policies, Marketing, Workflow, EmailConfig, EmailTemplates, PdfTemplates) sono
sorgente unica di verità per i campi corrispondenti; gli overrides servono **solo** ai casi
d'uso che non hanno ancora una sezione nativa e che richiedono migrazione esplicita campo per
campo.

## Conseguenze

- **+ Maturità contract**: schema zod severo, validazione 400 su `valueType` non riconosciuto,
  audit `project.legacy-overrides.updated` ad ogni PUT.
- **+ Migrazione tracciata**: il team deve dichiarare ogni override (path/type) invece di
  affidarsi al merge invisibile.
- **− Costo migrazione**: i progetti che si appoggiavano a `rawProject` richiedono una
  conversione esplicita. Per il greenfield non è bloccante (M3 non ha backfill obbligatorio).
- **− Compatibilità POC**: i tool di import/export legacy del POC vanno riscritti in chiave
  "Project Detail nativo". Nessun consumer downstream dipende oggi dal merge raw.

## Esclusioni esplicite

- Non viene esposto un endpoint `POST /v1/projects/:projectId/legacy-overrides:apply` che mergia
  raw payload nei progetti. Qualsiasi importazione legacy passa per script controllati e
  versionati lato `services/api/scripts/*` con review.
- Non vengono accettati `path` con sintassi prototype-pollution (`__proto__`, `constructor`)
  nelle prossime iterazioni: rimane TODO documentato in `tasks/lessons.md` per evolvere la
  validazione zod (`refine` su `path`).

## Riferimenti

- `services/api/src/modules/projects/detailRoutes.ts` (sezione legacy-overrides).
- `services/api/tests/integration/project-detail.integration.test.ts` (test 400 valueType, 200
  PUT/GET).
- Plan: `.cursor/plans/poc-plus_parity_3_milestones_*.plan.md` § M3.A / M3.D.
