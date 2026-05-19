# Règles cibles — opportunités, devis pilotage, tâches, widgets

Document **court** : règles métier et techniques à respecter pour le portail et les vues type dashboard.  
Pour le contexte complet (UX, QA, mapping Twenty détaillé, variantes) : **[`processus-opportunites-devis.md`](./processus-opportunites-devis.md)**.

---

## 1. Principes (P1–P3)

| ID | Règle |
|----|--------|
| **P1** | La **progression documentaire** est portée par les **devis** ; le **devis pilotage** fait foi pour le cycle rédaction / relecture / envoi. |
| **P2** | Le **stage opportunité** Twenty (`NOUVEAU`, `DEVIS_EN_COURS`, …) est un **miroir** du pilotage, sauf **standby** (dans le bundle), **GAGNE**, **PERDU** (non écrasés par le miroir). |
| **P3** | Quand le **pilotage** passe en **envoyé** (`Q_SENT`), tout **autre** devis de la même opportunité encore en `Q_SENT` → **`Q_SUPERSEDED`**. |

---

## 2. Statuts opportunité (canon `OPP_*`)

| Code | Rôle |
|------|------|
| `OPP_NEW` | Entrée pipeline |
| `OPP_QUOTE_PREP` | Pilotage en `Q_DRAFT_NEW` / `Q_INTERNAL_REVIEW` / `Q_READY_TO_SEND` |
| `OPP_CLIENT_PENDING` | Pilotage `Q_SENT` |
| `OPP_STANDBY` | Pause métier (souvent modélisée dans le **bundle** ; stage Twenty peut rester aligné ou figé selon politique) |
| `OPP_WON` | Gagné |
| `OPP_LOST` | Perdu |

**Variante B** : pas de statut « relancé » sur l’opportunité — les **relances = tâches** (+ `dateRelance` / compteurs si utilisés).

**Portail actuel** : clés Twenty `stage` (ex. `NOUVEAU`, `DEVIS_EN_COURS`, `DEVIS_ENVOYE`, `GAGNE`, `PERDU`) — voir table de correspondance dans le doc processus §2.1.

---

## 3. Statuts devis (documentaire)

| Code | Sens |
|------|------|
| `Q_DRAFT_NEW` | Brouillon |
| `Q_INTERNAL_REVIEW` | Relecture interne |
| `Q_READY_TO_SEND` | Prêt à envoyer |
| `Q_SENT` | Envoyé |
| `Q_SUPERSEDED` | Remplacé |
| `Q_CANCELLED` | Annulé |

**Pilotage** : au plus un `pilotageId` dans le bundle ; **promotion manuelle** par défaut (un nouveau devis ne devient pas pilotage tout seul).

---

## 4. Miroir stage ← pilotage

Hors **GAGNE** / **PERDU** et hors **standby actif** dans le bundle :

| Pilotage | Stage miroir (logique portail / Twenty aligné) |
|----------|-----------------------------------------------|
| `Q_DRAFT_NEW`, `Q_READY_TO_SEND` | Préparation devis (ex. `DEVIS_EN_COURS`) |
| `Q_INTERNAL_REVIEW` | Relecture (ex. `DEVIS_EN_RELECTURE`) |
| `Q_SENT` | Attente client (ex. `DEVIS_ENVOYE`) |
| `Q_SUPERSEDED`, `Q_CANCELLED` | Comportement « préparation » par défaut côté code miroir |

*Référence code :* `gateway/src/lib/opportunityPortailBundle.ts` — `mirrorStageFromPilot`.

---

## 5. Standby (bundle)

- Champ **`standby.active`** (et optionnellement `until`, `reason`) dans **`devisPortailBundle`** (JSON Twenty).
- **Actif** : pas de **tâche R-SENT-INIT** automatique ; le portail peut quand même autoriser des actions manuelles (envoi, pilotage) selon spec.
- **Levée** : recalcul miroir (**R-RESUME**).

---

## 6. Widgets / filtres « dashboard » (D1, W1, D2, D3)

Prédicats sur **une ligne opportunité** (pilotage + `stage` + bundle). Utilisables pour **Metabase**, listes filtrées, ou badges UI.

| ID | Intitulé | Condition (résumé) |
|----|----------|----------------------|
| **D1** | Finalisation | Non terminal, pas standby, pilotage ∈ `{Q_DRAFT_NEW, Q_INTERNAL_REVIEW}` |
| **W1** | Prêt à envoyer | Non terminal, pas standby, pilotage = `Q_READY_TO_SEND` |
| **D2** | Relecture | Non terminal, pas standby, pilotage = `Q_INTERNAL_REVIEW` |
| **D3** | Attente client | Non terminal, pas standby, `stage` « devis envoyé » ou pilotage `Q_SENT` |

*Note UX* : en `Q_INTERNAL_REVIEW`, D1 et D2 peuvent être vrais ensemble ; ordre d’affichage conseillé **D2 > W1 > D1 > D3** (voir spec §8).

*Référence code :* `gateway/src/lib/opportunityPortailBundle.ts` — `effectiveWidgetFlags`, `legacyWidgetFlags` ; miroir frontend `frontend/src/lib/portailBundle.ts`.

---

## 7. Automations (règles cibles)

| ID | Déclencheur | Effet principal |
|----|--------------|-----------------|
| **R-MIRROR** | Changement statut devis **pilotage** | Met à jour le `stage` Twenty (REST) sauf terminaux / standby |
| **R-SENT-INIT** | `Q_READY_TO_SEND` → `Q_SENT` sur le pilotage | P3, miroir, tâche relance init (si pas standby), note ; idempotence via `lastSentInitQuoteId` |
| **R-STANDBY** | Entrée standby | Gel relances auto (cron / Twenty) ; défaut : **ne pas** supprimer les tâches existantes |
| **R-RESUME** | Fin standby | R-MIRROR |
| **R-WON-LOST** | `GAGNE` ou `PERDU` | Clôturer tâches rappel **avec échéance** liées, resync `dateRelance`, note *(implémenté gateway : `POST /api/opportunities/:id/status`)* |
| **R-RELANCE** | Échéance atteinte (cron) | Nouvelle tâche / incrément ; hors scope gateway court |
| **R-PILOT-CHANGE** | Changement de pilotage | Note + miroir |

---

## 8. Bon de commande (v1)

- **BC manquant** : `stage === GAGNE` et `bonDeCommandeRef` vide (après trim).
- **Rapport** : `GET /api/opportunities/reports/bc-manquant`.

---

## 9. Stockage Twenty (portail)

| Clé | Usage |
|-----|--------|
| `devisPortailBundle` | JSON : `version`, `pilotageId`, `quotes[]`, `standby`, `lastSentInitQuoteId` |
| `bonDeCommandeRef` | Texte référence BC |

*API bundle :* préfixe `/api/opportunities/:id/portail-bundle` (voir `gateway/src/routes/opportunities.ts`).

---

## 10. Liens utiles

| Ressource | Chemin |
|-----------|--------|
| Spec longue | [`docs/processus-opportunites-devis.md`](./processus-opportunites-devis.md) |
| Moteur bundle / miroir / widgets | `gateway/src/lib/opportunityPortailBundle.ts` |
| Routes portail + statut + R-WON-LOST | `gateway/src/routes/opportunities.ts` |
| Requête liste GraphQL (bundle en liste) | `gateway/src/lib/queries.ts` — `GET_OPPORTUNITIES` |
