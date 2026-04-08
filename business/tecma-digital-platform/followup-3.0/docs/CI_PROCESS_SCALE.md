# Processo: sicurezza avanzata, carico e scalabilità (Followup 3.0)

Questo documento integra il piano “test parity” con **processi** che non si riducono a job verdi in CI.

---

## Pentest periodico

- **Scopo:** trovare classi di vulnerabilità che SAST/SCA non coprono (business logic, sessioni, autorizzazioni).
- **Frequenza tipica:** annuale o a ogni major release / cambio superficie esposta (nuovi endpoint pubblici, SSO).
- **Playbook:** [PENTEST_EXECUTION.md](PENTEST_EXECUTION.md)  
- **Handoff fornitore:** [PENTEST_VENDOR_HANDOFF.md](PENTEST_VENDOR_HANDOFF.md)  
- **Remediation:** tracciare finding su issue tracker con severità e scadenza; retest prima di chiudere.

La pipeline [followup-3.0-security.yml](../../../../.github/workflows/followup-3.0-security.yml) (Semgrep, OSV, Trivy) **non** sostituisce un pentest.

---

## Load test e SLO

- **Quando:** prima di aumentare istanze o traffico; dopo refactor di path critici (liste, query, realtime).
- **Come:** ambiente **staging** o stack dedicato; strumenti e convenzioni in [LOAD_TEST.md](LOAD_TEST.md).
- **SLO / osservabilità:** obiettivi di latenza ed error rate in [OBSERVABILITY_SLO.md](OBSERVABILITY_SLO.md) e [RUNBOOK_OBSERVABILITY.md](RUNBOOK_OBSERVABILITY.md).

---

## Scalabilità (oltre i test)

Validare esplicitamente:

- API stateless dove possibile; sessioni e WebSocket documentati.
- Job/worker separati dal web process se il carico di background cresce.
- MongoDB: indici, limiti di query, connection pool (vedi configurazione driver in `be-followup-v3`).

Non esiste un singolo “test di scalabilità” in CI: si combinano load test, metriche e revisione architetturale.
