# Lessons learned

## 2026-03-13

- Quando l'utente chiede una verifica/fix completa, non fermarmi alla diagnosi: devo procedere direttamente con correzione, test end-to-end e validazione finale.
- Nei test React, evitare mock "stretti" di `react-router-dom` che rimuovono export usati dal componente (`useLocation`, `MemoryRouter`, ecc.). Preferire sempre mock parziale con `vi.importActual(...)`.
- Se un componente usa hook condivisi che chiamano API aggiuntive (es. `useWorkflowConfig`), aggiornare i mock del test includendo anche quei metodi per evitare `is not a function`.
