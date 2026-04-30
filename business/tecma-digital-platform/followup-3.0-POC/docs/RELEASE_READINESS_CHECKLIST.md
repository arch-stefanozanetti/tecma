# Release readiness — FollowUp 3.0 (checklist cliente)

One-pager per go/no-go verso **cliente esterno** (non uso interno o singolo pilota informale).  
Aggiornare stato e owner prima di ogni rilascio significativo.

**Legenda stato:** `OK` = soddisfatto per questo rilascio · `PARZ` = accettabile con risk acceptance scritta · `GAP` = non pronto / da completare · `N/A` = non in scope contrattuale.

| # | Requisito | Stato tipico oggi* | Owner (da assegnare) | Bloccante** |
|---|-----------|-------------------|----------------------|-------------|
| 1 | **Scope funzionale firmato** (cosa include / esclude vs legacy; riferimento PIANO_GLOBALE + allegato gap) | GAP / PARZ | Product + Sales | Sì |
| 2 | **Identity per ambiente cliente** (JWT nativo vs BSS vs Keycloak — una strategia documentata e testata) | PARZ | Platform / Infra | Sì |
| 3 | **Tenant isolation** verificata sulle route in scope (guard + smoke su workspace/progetto) | OK (con CI route-guards) | Backend | Sì |
| 4 | **Staging = parità prod** (stessi flag, CORS, secrets pattern; no “solo locale”) | PARZ | DevOps | Sì |
| 5 | **Test automatici CI** (BE/FE come in ACCEPTANCE_GATES) verdi sul commit/tag di release | OK | Engineering | Sì |
| 6 | **Journey critici su backend reale** (non solo E2E con API mockate): login, CRM core, permessi viewer/admin) | GAP / PARZ | QA + Backend | Sì*** |
| 7 | **Smoke post-deploy** (`scripts/post-release-verify.sh` o workflow equivalente) | OK | DevOps | Sì |
| 8 | **Secrets & config** (nessun segreto in repo; env prod completi; rotazione documentata) | PARZ | DevOps + Security | Sì |
| 9 | **Rate limit / abuse** (auth + API esposte; Redis in multi-replica se applicabile) | OK (codice presente; verificare env) | Backend | Parziale |
|10 | **Dipendenze runtime** (nessun high+ non mitigato su policy team; v. SECURITY_RUNBOOK §3/§7) | PARZ | Security + Eng | Parziale |
|11 | **Pentest o equivalente** (ultimo report chiuso o risk acceptance su staging) | GAP (procedure in PENTEST_*) | Security | Sì**** |
|12 | **Backup Mongo / RTO-RPO** (chi esegue, frequenza, restore testato almeno una volta) | PARZ | Ops + Cliente | Sì |
|13 | **Monitoring & allerta** (log, health, metriche; contatto per incidenti) | PARZ | Ops | Parziale |
|14 | **DPA / GDPR** (ruoli, export/cancellazione, sottoprocessori, registri — via Legal) | GAP / PARZ | Legal + DPO | Sì***** |
|15 | **Connettori in contratto** (Twilio, Google/Meta, ecc.: config staging → prod + fallback se terzo giù) | PARZ / Mistato | Integrations | Parziale |
|16 | **Entitlement commerciale** (cosa è attivabile; chi approva; coerenza con FASE02) | PARZ | Product + Ops | Parziale |
|17 | **Supporto cliente** (SLA risposta, canale, escalation, orari) | GAP | Customer success / Ops | Parziale |

\* *Stato tipico oggi* riflette l’analisi interna marzo 2026 (executive + piano + acceptance gates); va ricalibrato per ogni release.  
\** *Bloccante* = senza questo non si consiglia go-live **generico**; *Parziale* = richiede risk acceptance esplicita.  
\*** Journey su BE reale: gli E2E core documentati usano mock; per cliente esterno serve almeno un set su staging.  
\**** Per pilota singolo con contratto che esclude pentest formale: risk acceptance firmata.  
\***** Per cliente senza dati personali di terzi: valutare N/A con Legal.

## Uso rapido

1. Compilare colonna **Owner** e aggiornare **Stato** per il tag di release.  
2. Ogni riga **Bloccante = Sì** con stato **GAP** → **no-go** fino a mitigazione o accettazione scritta.  
3. Allegare questa tabella (o export) al ticket di release / Confluence “Go-live cliente X”.

## Riferimenti

- [ACCEPTANCE_GATES.md](./ACCEPTANCE_GATES.md)  
- [SECURITY_RUNBOOK.md](./SECURITY_RUNBOOK.md)  
- [PENTEST_EXECUTION.md](./PENTEST_EXECUTION.md)  
- [COMPLIANCE_BACKUP_DR.md](./COMPLIANCE_BACKUP_DR.md)  
- [executive/06-risks-open-decisions.md](./executive/06-risks-open-decisions.md)  
- [PIANO_GLOBALE_FOLLOWUP_3.md](./PIANO_GLOBALE_FOLLOWUP_3.md)
