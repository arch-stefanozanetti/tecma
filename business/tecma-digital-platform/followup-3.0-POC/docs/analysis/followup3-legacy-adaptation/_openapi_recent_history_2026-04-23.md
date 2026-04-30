# OpenAPI — ultimi commit toccanti (TECMA-BSS)

## Uso nel pack Followup 3.1

- **Ruolo:** estratto **ridotto** (ultimi 5 commit che hanno toccato ciascun file) dal repo `architecture/aws-api-gateway` alla data baseline **2026-04-23**; serve contesto “chi ha mosso cosa” senza sostituire `git log` completo.
- **Limite:** non include commit su altri path dello stesso dominio né MR GitLab; per decisioni gateway usare sempre `git log --follow -- <path>` sul clone aggiornato.
- **Coerenza:** incrociare con `_openapi_hashes_2026-04-23.md` (impronte file) e con `_baseline_git_2026-04-23.md` (commit repo intero).

**Riferimenti pack:** `05-api-contract-alignment-spec.md` (sorgenti di verità raw/public), `07` DoR §8 punto 3 (contratto).

---

## OpenAPI file history (last 5 touches)

### `api/TECMA-BSS/public/tecma-bss-swagger.yaml`
```
3fba562 add request swagger
dbc1f6a update public yaml with projectInfo + route
87030cf First commit
```

### `api/TECMA-BSS/raw/TECMA Digital Platform - Dev-v1-oas30-apigateway.yaml`
```
7a8937a Update main API GW definitions
5fce6fd add /v2/projects routes and update components
87030cf First commit
```

