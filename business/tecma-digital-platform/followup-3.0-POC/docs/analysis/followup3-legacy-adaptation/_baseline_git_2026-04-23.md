# Baseline git (post-sync manuale)

## Uso nel pack Followup 3.1

- **Ruolo:** fotografia **locale** dei repository al **2026-04-23** (sync manuale; vedi nota token in `00-context-and-constraints.md`). Non equivale a una build riproducibile da sola: va ricondotta a commit noti su GitLab/GitHub.
- **Perché servono tre repo:** `architecture/aws-api-gateway` è la base TECMA/OpenAPI; `business/.../aws-api-gateway` aggrega TECMA-BSS + Followup; `bss-api-gateway` è un ramo satellite gateway-only — incrociare con `05-api-contract-alignment-spec.md` prima di assumere quale repo riceve la MR.
- **Rigenerazione:** dopo `git fetch && git pull` su ciascun path, aggiornare branch/commit e blocco “Last commits” **in questo stesso file** (policy pack: niente moltiplicazione di baseline `.md` salvo decisione esplicita del team; preferire sovrascrittura + aggiornamento data nel titolo se rinominate).
- **Sicurezza:** non committare URL con token OAuth in chiaro; qui compaiono già mascherati (`***`).

**Riferimenti pack:** `README.md` (Artefatti di baseline), `00-context-and-constraints.md`, `07` §9 (lint gateway), `11` (spike prima di merge).

---

## architecture_aws_api_gateway
path: `/Users/s.zanetti/dev/tecma/architecture/aws-api-gateway`
branch: `main`
commit: `6e9820a0da12b8acc25aeb464a02bdb87d35ac56`
origin: `https://oauth2:***@gitlab.tecmasolutions.com/architecture/aws-api-gateway.git`

### Last commits
```
6e9820a Update API key naming convention in OpenAPI specifications for Quote domain and related configurations to use lowercase 'x-api-key'.
e7b0c64 Add OpenAPI specification for Quote domain, including detailed endpoint definitions, security configurations, and pagination support. Update existing raw API Gateway configuration to align with new OpenAPI standards.
66cdd4a original existing raw for quote gw
26df529 Add OpenAPI specification for Movement domain, including detailed endpoint definitions, security configurations, and pagination support.
64ca133 update movement raw name file
```

## business_aws_api_gateway
path: `/Users/s.zanetti/dev/tecma/business/tecma-digital-platform/aws-api-gateway`
branch: `main`
commit: `2749e05c26c20c3fb55cebd415906124a34525e6`
origin: `https://oauth2:***@gitlab.tecmasolutions.com/business/tecma-digital-platform/aws-api-gateway.git`

### Last commits
```
2749e05 docs: wire developer portal to TECMA-BSS public spec
92ae372 chore: implement OpenAPI aggregation script for TECMA-BSS
e56e2f6 feat(TECMA-BSS): add Postman collection and environment
706d47d test(TECMA-BSS): add OpenAPI spec validation
af15a5b docs(TECMA-BSS): add descriptions and tags to BSS and Followup paths
```

## business_bss_api_gateway
path: `/Users/s.zanetti/dev/tecma/business/tecma-digital-platform/bss-api-gateway`
branch: `codex/bss-platform-wave1`
commit: `e341a658ffffa621379764db8a9d4037d6e11a65`
origin: `https://github.com/arch-stefanozanetti/bss-api-gateway.git`

### Last commits
```
e341a65 feat: add gateway-only client/apartment detail endpoints
d7f5118 test: add gateway ci test suite and eslint flat config
cd2c999 fix: make supabase ssl handling explicit for local runtime
e59cf90 feat: bootstrap bss api gateway request-centric foundation
```

