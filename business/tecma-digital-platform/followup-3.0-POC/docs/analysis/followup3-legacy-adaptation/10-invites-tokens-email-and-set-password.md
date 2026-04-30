# Inviti, token, email e `set-password-from-invite` (Followup 3.0 POC)

Documento **molto operativo** sul flusso invito: precondizioni, sequenza scritture DB, email, endpoint pubblico, **edge case di sicurezza** e **problemi d’ordine** nel codice oggi (da correggere in 3.1 se confermati).

Complementare: `08-users-...`, `09-rbac-...`, `07` §2.1–§3.

**Persistenza inviti sul legacy:** il flusso qui è **POC** (`tz_users`, `tz_inviteTokens`). Per 3.1 la persistenza e le API potrebbero essere interamente legacy (opzione A in `11-bss-legacy-bridge-api-and-data-matrix.md` §5.3). Non implementare solo da questo documento senza aver letto `11`.

---

## 1) Sequenza AS-IS (happy path)

### 1.1 Creazione invito (`inviteUser`)

1. Normalizza email; se `emailExistsInAnyUserCollection` → **409**.
2. Se email non configurata (SMTP/SES) e mock non abilitato → **503** con messaggio operativo.
3. `insertOne` su `tz_users` con `status: "invited"`, `project_ids: [projectId]`, `email_verified: false`.
4. `createInviteToken` → inserimento `tz_inviteTokens` con **hash** SHA-256 del token raw, `expiresAt`, `used: false`.
5. Invio email; se fallisce → **rollback**: cancella token + cancella utente, **502**.

Riferimento implementazione:

```91:144:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/users/users-mutations.service.ts
export async function inviteUser(params: {
  email: string;
  projectId: string;
  projectName: string;
  /** URL base del FE per il link nell'email (es. da Origin) */
  appPublicBaseUrl: string;
  /** Label ruolo per l'email (es. "Vendor", "Admin"); default "Membro" */
  roleLabel?: string;
}): Promise<{ userId: string }> {
  const email = normalizeEmail(params.email);
  if (await emailExistsInAnyUserCollection(email)) {
    throw new HttpError("Utente già registrato con questa email", 409);
  }
  // ... email transport check ...
  const _id = new ObjectId();
  await usersColl().insertOne({
    _id,
    email,
    status: "invited",
    project_ids: [params.projectId],
    email_verified: false
  });
  const rawToken = await createInviteToken({
    email,
    role: roleLabel,
    projectId: params.projectId,
    userId: _id.toHexString()
  });
  try {
    await sendInviteEmail({ /* ... */ });
  } catch (err) {
    await deleteInviteTokensForUserId(_id.toHexString());
    await usersColl().deleteOne({ _id });
    // ...
    throw new HttpError(/* 502 */);
  }
  return { userId: _id.toHexString() };
}
```

### 1.2 Token in DB (`tz_inviteTokens`)

```30:65:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/auth/inviteToken.service.ts
export async function createInviteToken(params: {
  email: string;
  role: string;
  projectId: string;
  userId: string;
}): Promise<string> {
  const raw = generateInviteRawToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ENV.INVITE_TOKEN_EXPIRES_HOURS);
  const doc: OptionalId<InviteTokenDoc> = {
    email: params.email.toLowerCase().trim(),
    tokenHash: hashToken(raw),
    role: params.role,
    projectId: params.projectId,
    userId: params.userId,
    expiresAt,
    used: false,
    createdAt: new Date()
  };
  await coll().insertOne(doc as InviteTokenDoc);
  return raw;
}

export async function consumeInviteToken(rawToken: string): Promise<InviteTokenDoc | null> {
  const tokenHash = hashToken(rawToken);
  const doc = await coll().findOneAndUpdate(
    { tokenHash, used: false, expiresAt: { $gt: new Date() } },
    { $set: { used: true } },
    { returnDocument: "before" }
  );
  return doc;
}
```

**Proprietà di sicurezza già presenti:** token raw lungo; persistenza solo hash; scadenza; consumo atomico con `findOneAndUpdate` (mitiga doppio click concorrente **a livello token**).

### 1.3 Accettazione invito (`setPasswordFromInvite`)

```147:192:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/core/users/users-mutations.service.ts
export async function setPasswordFromInvite(
  params: {
    token: string;
    password: string;
  },
  meta: { ipAddress?: string | null; userAgent?: string | null } = {}
): Promise<{ accessToken: string; refreshToken: string; expiresIn: string; user: object }> {
  const invite = await consumeInviteToken(params.token);
  if (!invite) {
    throw new HttpError("Token non valido o scaduto", 400);
  }
  const doc = await findUserById(invite.userId);
  if (!doc) {
    throw new HttpError("Utente non trovato", 400);
  }
  assertPasswordMeetsPolicy(params.password);
  const hash = await bcrypt.hash(params.password, 12);
  await usersColl().updateOne(
    { _id: doc._id },
    { $set: { password: hash, status: "active" as UserStatus, email_verified: true } }
  );
  const updated = { ...doc, password: hash, status: "active" as UserStatus };
  const payload = await buildAccessPayloadForUser(updated as TzUserDoc);
  const accessToken = signAccessToken(payload);
  const refreshToken = await createSession(payload.sub, payload.email);
  // audit + security event ...
  return {
    accessToken,
    refreshToken,
    expiresIn: ENV.AUTH_JWT_EXPIRES_IN,
    user: toAuthSessionUser(payload)
  };
}
```

Route pubblica:

```110:113:tecma/business/tecma-digital-platform/followup-3.0/be-followup-v3/src/routes/v1/public.routes.ts
publicRoutes.post("/auth/set-password-from-invite", authRateLimiter, handleAsync((req) => {
  const body = z.object({ token: z.string().min(1), password: z.string().min(1) }).parse(req.body);
  return setPasswordFromInvite(body, authMeta(req));
}));
```

---

## 2) Use case espliciti (testabili)

| ID | Use case | Input | Esito atteso |
|----|-----------|-------|--------------|
| I-01 | Invito nuovo utente | email libera, progetto valido | 200 + `{ userId }` |
| I-02 | Invito email già presente in candidate | qualsiasi collection | 409 |
| I-03 | Invio email fallisce dopo creazione utente | SMTP errore | 502, **nessun** utente/token residuo |
| I-04 | Set password con token valido | token + password policy OK | access+refresh, user `active` |
| I-05 | Token scaduto / già usato / hash sconosciuto | token | 400 “non valido o scaduto” |
| I-06 | Token valido ma utente cancellato | — | 400 “Utente non trovato” (token **già consumato**) |

---

## 3) Edge case e rischi (sicurezza / prodotto)

### 3.1 **Bug / ordine operazioni — password policy dopo consumo token**

Nel flusso attuale l’ordine è:

1. `consumeInviteToken` → marca `used: true`
2. `findUserById`
3. `assertPasswordMeetsPolicy` → se **fallisce**, il token risulta **già bruciato**

| Impatto | Severità | Mitigazione TO-BE |
|---------|----------|-------------------|
| Utente con password debole “perde” l’invito | **Alta** UX + supporto | Validare password **prima** del consume, oppure consumare in transazione dopo policy OK, oppure ripristinare `used` su fallimento controllato |
| Attaccante può bruciare inviti con password invalide? | Dipende da rate limit | Rate limit su endpoint pubblico + messaggio UX che non distingue troppo (bilanciamento) |

**Story consigliata:** “Invito: policy password prima di consume token” (BE + QA).

### 3.2 Doppio submit e race

- `consumeInviteToken` è atomico: un solo winner. Il secondo riceve `null` → 400. **OK.**

### 3.3 Resend / revoke invito

**AS-IS:** non documentato in questo service come API unica; esistono solo `deleteInviteTokensForUserId` usato in rollback.

| UC | Stato POC | TO-BE |
|----|------------|-------|
| Resend invito stesso utente | manuale / re-invite? | endpoint + policy rate |
| Revoca invito prima accettazione | — | `revoke` + audit (`07` §3.3) |

### 3.4 `role` nel token invite vs ruolo applicativo

`createInviteToken` salva `role` come **label email** (`roleLabel`), non necessariamente allineato a `tz_roleDefinitions`.

| Rischio | Mitigazione |
|---------|-------------|
| Confusione tra “Vendor” label e ruolo workspace | documentare mapping; in 3.1 separare `inviteRoleLabel` da `membershipRole` |

### 3.5 `workspaceId` nel `POST /users`

Il body accetta `workspaceId` ma **`inviteUser` non aggiunge membership**. Vedi `08` E-U-05.

---

## 4) Configurazione e ambienti (operativo)

| Variabile / concetto | Effetto |
|----------------------|---------|
| `INVITE_TOKEN_EXPIRES_HOURS` | TTL token |
| `EMAIL_TRANSPORT`, SES, `EMAIL_FROM` | senza di questi → 503 salvo mock |
| `INVITE_ALLOW_MOCK_EMAIL` | consente invito senza consegna reale in dev |

---

## 5) Audit e tracciabilità

Eventi osservabili nel flusso `setPasswordFromInvite`:

- `logAuthEvent("invite_accepted", ...)`
- `recordSecurityEvent({ action: "auth.invite_password_set", ... })`

**Gap:** correlazione `inviteId` / `workspaceId` se invito diventa workspace-scoped (oggi token non ha `workspaceId`).

---

## 6) Matrice errori HTTP (sintesi implementativa)

| Step | HTTP tipico | Messaggio / code |
|------|-------------|-------------------|
| Invito email duplicata | 409 | Utente già registrato |
| Email non configurata | 503 | Invio email non configurato |
| SMTP fallisce post-insert | 502 | Impossibile inviare email |
| Token invalid/expired/used | 400 | Token non valido o scaduto |
| Utente mancante dopo consume | 400 | Utente non trovato |

---

## 7) Backlog PO (inviti)

### Epic INV-1 — Invito workspace-native + membership atomica

- Story: nuovo `POST /v1/workspaces/{id}/invites` (vedi `07` §3).
- Story: fix ordine policy password vs `consumeInviteToken`.

### Epic INV-2 — Operazioni lifecycle invito

- Story: resend/revoke/list con rate limit e audit.

---

## 8) Riferimenti codice

- `src/core/users/users-mutations.service.ts` — `inviteUser`, `setPasswordFromInvite`
- `src/core/auth/inviteToken.service.ts` — `createInviteToken`, `consumeInviteToken`
- `src/routes/v1/public.routes.ts` — route pubblica set-password
- `src/routes/v1/users.routes.ts` — `POST /users`
- `src/core/email/email.service.ts` — `sendInviteEmail`

## 9) QA, sicurezza e tracciabilità (verso `07`)

- **Bug ordine consume/policy** (cfr. §1–§2 di questo doc): finché aperto, ogni release note deve indicare severità e workaround; il test regressione va referenziato in `07` §9b (es. R-INV-POLICY-01).
- **Rate limit**: stessi limiti logici del login devono applicarsi a `resend` / creazione massiva inviti (`07` §9c); allegare in story screenshot configurazione WAF/API GW se pertinente.
- **Email leak**: verificare che risposte 409/502 non includano indirizzi in chiaro in campi non necessari; allineamento a schema errore TECMA.
- **Correlazione audit**: quando l’invito diventa workspace-scoped, estendere payload audit con `workspaceId` e `inviteId` (`05` + `07` §9a punto 3).
- **Matrice errori §6**: ogni riga dovrebbe avere almeno un test API che asserta `status` + `error.code` atteso (contract stabile per FE).
