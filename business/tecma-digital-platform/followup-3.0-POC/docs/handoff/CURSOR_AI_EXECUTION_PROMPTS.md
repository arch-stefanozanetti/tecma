# Cursor / AI Execution Prompts

## Uso
Prompt pronti per accelerare sviluppo post-riunione.  
Copiare prompt e sostituire placeholder (`<...>`).

## Regola base per tutti i prompt
Sempre aggiungere:
```txt
Vincoli:
- Non cambiare API contract pubblici se non richiesto.
- Mantieni compatibilità backward dove indicato.
- Aggiungi test minimi per deny path RBAC.
- Riporta file toccati e motivazione.
```

---

## Prompt 1 — Mappa rapida modulo
```txt
Analizza modulo <backend_or_frontend_path> e produci:
1) data flow
2) access control points
3) dipendenze critiche
4) rischi regressione
5) piano patch minimo in 5 step.
```

## Prompt 2 — Hardening endpoint BE
```txt
Per endpoint <route_path> applica standard:
1) requireAuth
2) requirePermission coerente
3) requireCanAccessWorkspace/Project se resource scoped
4) audit evento mutazioni
5) test integrazione allow/deny.
Mostra diff e rationale.
```

## Prompt 3 — Allineamento FE gating
```txt
Per sezione FE <section_name>:
1) allinea route/menu/azioni con permission backend
2) rimuovi visibility incoerente
3) aggiungi test rendering per ruoli diversi
4) segnala gap backend se FE non può decidere da solo.
```

## Prompt 4 — Migrazione identity key
```txt
Progetta migrazione Mongo da membership userId=email a userId canonico.
Richieste:
- script idempotente
- modalità dry-run e apply
- report JSON
- rollback plan
- check duplicati pre e post migrazione.
```

## Prompt 5 — Verifica isolamento tenant
```txt
Genera test matrix per isolamento workspace:
- utente viewer workspace A
- utente admin workspace B
- tecma_admin
Copri:
1) list endpoint
2) detail endpoint
3) mutazioni
4) cross-workspace denial.
```

## Prompt 6 — Review sicurezza PR
```txt
Esegui review tecnica su diff <branch_or_pr> con focus:
1) bypass authz
2) fallback permissivi
3) mismatch permission naming
4) query non tenant-scoped
5) test mancanti su deny path.
Output: findings ordinati per severità, fix suggerito per ciascuno.
```

## Prompt 7 — DB performance pass
```txt
Partendo da query reali del modulo <module_name>, proponi:
1) indici necessari
2) indici ridondanti da rimuovere
3) impatto su write/read
4) piano rollout indice senza downtime.
```

## Prompt 8 — Backlog sprint auto-assembly
```txt
Da documento <handoff_doc_path> crea backlog sprint 2 settimane:
- task BE, FE, DB, QA
- effort S/M/L
- dipendenze
- definition of done
- test minimi.
Formato pronto per Jira import markdown.
```

---

## Sequenza consigliata team (giorno 1)
1. Prompt 1 su modulo auth/scope.
2. Prompt 2 su route critiche users/workspaces.
3. Prompt 3 su sezione FE admin.
4. Prompt 4 per piano migrazione DB.
5. Prompt 8 per backlog definitivo.
