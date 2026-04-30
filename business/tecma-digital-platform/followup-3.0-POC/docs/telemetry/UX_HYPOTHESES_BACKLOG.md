# Backlog ipotesi UX (post-baseline)

Da usare **dopo** 2–4 settimane di baseline telemetry; ogni voce è un candidato a **user story** con misura prima/dopo.

| Priorità | Ipotesi | Segnale telemetry atteso | Nota feature flag |
|----------|---------|---------------------------|-------------------|
| P1 | **Cockpit “oggi”** riduce tempo alla prima azione utile | ↑ correlazione `cockpit.page.view` → `task.client.log_action` nello stesso giorno | Flag su sezione Cockpit / card priorità (PostHog Feature Flags o env FE) |
| P2 | **Empty state con CTA** su liste vuote (clienti, richieste) aumenta attivazione | ↑ click CTA vs bounce `app.route.view` sulla stessa sezione | Flag per mostrare empty state “guidato” |
| P3 | **Micro-feedback** dopo salvataggio azione cliente aumenta ripetizione | ↑ `task.client.log_action` multipli per sessione | Flag copy/toast breve |
| P4 | **Palette comandi** riduce attrito verso azioni frequenti | ↓ tempo tra `app.route.view` e `task.client.log_action` (proxy) | Flag visibilità shortcut / onboarding tooltip |

**Processo:** una ipotesi alla volta per sprint; definire in anticipo metrica primaria e durata test (es. 14 giorni).
