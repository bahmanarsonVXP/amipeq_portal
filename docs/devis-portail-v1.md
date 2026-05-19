# Devis portail — spécification V1

Document de référence pour l’implémentation V1 (bundle multi-devis, montants, documents R2, sync Twenty).

Voir aussi : [`regles-cibles-opportunites-devis.md`](./regles-cibles-opportunites-devis.md).

---

## 1. Modèle

- **Entité** : entrée dans `devisPortailBundle.quotes[]` (champ JSON Twenty sur **Opportunity**).
- **Numéro** : `{racine}-{Lettre}` avec racine = `numeroDevis` sans suffixe `-A`…`-Z` ; lettres `A`…`Z` = prochaine libre.
- **Fichier Word** : stocké dans **Cloudflare R2** ; métadonnées `documentKey`, `documentFileName`, `documentUploadedAt` dans le devis (JSON CRM). Téléchargement via `GET /api/opportunities/:id/portail-bundle/quotes/:quoteId/document`.

### Champs devis (`PortailQuote`)

| Champ | Description |
|-------|-------------|
| `id` | UUID interne |
| `numero` | Ex. `105081-CL-23343-A` |
| `label` | Libellé affiché |
| `statut` | `Q_*` documentaire (figé après `Q_SENT`) |
| `statutCommercial` | `EN_ATTENTE` \| `GAGNE` \| `PERDU` |
| `sentAt` | Date envoi client |
| `montantBrutEur` | OFFRE 1 |
| `tauxRemise` | % saisi (0, 5, 10, 15, 20 ou libre) |
| `montantNetEur` | OFFRE 2 = `round(brut × (1 − %/100), 2)` half-up |
| `remiseTexte` | Texte interne optionnel (jamais client) |
| `prestations` | Liste enum (même vocabulaire que `opportunity.prestation`) |
| `documentKey` | Clé R2 |
| `documentFileName` | Nom fichier original |

### Montants Twenty (opportunité)

| Champ | Rôle |
|-------|------|
| `amount` | Montant **remisé** (net) du **devis pilotage** |
| `montantRemise` | Montant de la remise en **€** (brut − net) |
| `tauxRemise` | % du pilotage |

**Brut** = `amount` + `montantRemise` (dérivé, pas de 3ᵉ champ obligatoire).

**Sync pilotage → opp.** : immédiate, sans confirmation ; prestations vides → `prestation: []` sur l’opp.

---

## 2. Statuts

### Documentaire (`Q_*`) — avant / jusqu’à envoi

`Q_DRAFT_NEW` → `Q_INTERNAL_REVIEW` → `Q_READY_TO_SEND` → `Q_SENT`.

Après **`Q_SENT`** : le `Q_*` **n’est plus modifié** ; l’affaire suit `statutDevis` sur l’opportunité.

### Commercial

- **Opportunité** : `statutDevis` = `EN_ATTENTE` \| `GAGNE` \| `PERDU`.
- **GAGNE** : devis retenu = pilotage ; ce devis → `statutCommercial: GAGNE` ; les autres → `PERDU`.
- **PERDU** (opp.) : **tous** les devis → `statutCommercial: PERDU` (y compris pilotage).

---

## 3. API portail (gateway)

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/:id/portail-bundle` | Bundle (+ backfill legacy si vide) |
| POST | `/:id/portail-bundle/quotes` | Nouveau devis (numéro auto) |
| PATCH | `/:id/portail-bundle/quotes/:quoteId` | Label, `Q_*`, montants, prestations, remise |
| PATCH | `/:id/portail-bundle/pilotage` | Changer pilotage + sync opp. |
| POST | `/:id/portail-bundle/mark-sent` | Envoi pilotage |
| POST | `/:id/portail-bundle/mark-won` | `{ quoteId }` → GAGNE + sync |
| PUT | `…/quotes/:quoteId/document` | Upload `.docx` (écrase) |
| GET | `…/quotes/:quoteId/document` | Téléchargement |

---

## 4. Stockage R2

- Binding Workers : `DEVIS_DOCUMENTS`
- Chemin : `opportunities/{opportunityId}/quotes/{quoteId}/devis.docx`
- Note Twenty à l’upload (lien portail / nom devis).

---

## 5. Parcours UI (portail)

Deux niveaux dans le **tiroir opportunité** (`OpportunityDrawer`) :

### Niveau 1 — Synthèse

- **Cadre Montant** : à gauche, montant net + brut/remise du **devis pilotage** ; à droite, liste des devis (`DevisListCompact`, lignes `★ Devis A : prestations — brut / net`) et bouton **+ Nouveau Devis**.
- Prestations opportunité (sync pilotage), contact, notes, relances ; BC si gagné (bloc séparé).
- Chaque ligne devis ouvre le layer en **édition** ; **+ Nouveau Devis** ouvre le layer en **création**.

Pas de bloc « Pilotage et devis » (D1/W1/D2/D3, standby, formulaires inline) dans le tiroir.

### Niveau 2 — Layer devis (`DevisLayer`)

- Panneau latéral nested (`z-[65]`, overlay `z-[64]`) au-dessus du tiroir (`z-50`).
- **Création** : `POST …/quotes` à l’ouverture (numéro auto) ; brouillon local jusqu’à **Ok**.
- **Édition** : formulaire unique (libellé, `Q_*` si non figé, brut, remise %, prix remisé calculé, note remise, tags prestations, import `.docx`).
- **Étoile** : bascule pilotage (`PATCH …/pilotage`) à l’enregistrement si demandé.
- **Ok** : `PATCH …/quotes/:id` + upload document en attente (`PUT …/document`) ; **Annuler** : ferme sans PATCH.
- Actions secondaires : marquer envoyé (pilotage, `Q_READY_TO_SEND`), retenir / gagné (`mark-won`).

État bundle partagé via `usePortailBundle(opportunityId)`. Échap : ferme d’abord le layer, puis le tiroir.

---

## 6. Migration legacy

Script `DataMigration/backfill_portail_bundle_legacy.js` : pour chaque opp. sans `quotes[]`, créer un devis `-A` avec reprise `numeroDevis`, montants, `Q_*` / `statutCommercial` dérivés de `stage` / `statutDevis`.

---

## 7. V2 (hors scope)

Génération automatique Word (templates Docxtemplater).
