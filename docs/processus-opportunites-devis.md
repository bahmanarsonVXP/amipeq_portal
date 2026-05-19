# Processus opportunités / devis / relances — cible AMIPEQ

Document de référence unique (statuts, flux, pilotage multi-devis, widgets, automations, mapping Twenty, UI portail, QA).  
**Règles cibles (vue compacte)** : voir aussi [`regles-cibles-opportunites-devis.md`](./regles-cibles-opportunites-devis.md).  
**Décisions validées** : un `devisPilotageId` par opportunité avec N devis ; variante B (pas de statut « relancé ») ; widget séparé pour prêts à envoyer ; Gagné/Perdu sans preuve v1 + rapport BC manquant ; standby ouvert ; permissions ouvertes v1 avec audit.

---

## 1. Modèle de données

### 1.1 Opportunité

| Champ conceptuel | Type | Règle |
|------------------|------|--------|
| `devisPilotageId` | relation → Devis | Au plus un devis « pilotage » à la fois. **Promotion manuelle** par défaut : un nouveau devis **ne** devient pas pilotage tant que l’utilisateur n’exécute pas l’action « Définir comme devis pilotage ». |
| `derniereRelanceAt` | datetime | Optionnel ; alimenté par les règles de relance. |
| `prochaineRelanceAt` | datetime | Échéance de la prochaine action de relance (si politique calendaire). |
| `nbRelances` | entier | Compteur métier (incrémenté selon R-RELANCE, voir annexe). |
| Statut pipeline | enum | Voir §2 (`OPP_*` cible). |
| `standbyUntil` | date | Optionnel ; date indicative de reprise. |
| `standbyReason` | enum fermé | Motif du standby. |
| **BC v1** | `bonDeCommandeRef` (texte) | **Règle unique rapport v1** : BC considéré « présent » si `bonDeCommandeRef` est non vide après `trim`. Pas d’obligation de PJ en v1. (Champ bool `bonDeCommandePresent` possible en v2 pour simplifier les saisies.) |

### 1.2 Devis (lié à l’opportunité)

| Champ conceptuel | Type | Règle |
|------------------|------|--------|
| `opportunityId` | relation | Obligatoire. |
| `statutDocumentaire` | enum | Liste fermée §3. |
| `sentAt` | datetime | Renseigné à la transition vers `Q_SENT`. |
| `sentChannel` | enum optionnel | email, lien, courrier, autre. |
| `sentReference` | texte optionnel | N° envoi, URL, etc. |
| `variantRole` (optionnel v1) | enum | `OPTION` \| `RETENU` \| `ECARTE` — **facultatif** si `Q_SUPERSEDED` + pilotage suffisent ; utile pour l’UI multi-devis. |

### 1.3 Principes transverses

- **P1 — Source de vérité documentaire** : le workflow **devis** (en particulier le **devis pilotage**) porte la progression rédaction / relecture / envoi.
- **P2 — Miroir opportunité** : les statuts `OPP_QUOTE_PREP` et `OPP_CLIENT_PENDING` sont **dérivés** du pilotage (automatisation), sauf `OPP_STANDBY`, `OPP_WON`, `OPP_LOST` qui sont **prioritaires** une fois posés (avec garde-fous §7).
- **P3 — Anti double vérité client** : lorsqu’un devis **pilotage** passe en `Q_SENT`, tout **autre** devis de la même opportunité encore en `Q_SENT` passe en `Q_SUPERSEDED` (sauf exception documentée rare).

---

## 2. Statuts opportunité (liste fermée — cible)

| Code | Libellé UI (proposé) | Description courte |
|------|----------------------|----------------------|
| `OPP_NEW` | Nouvelle | Création / entrée pipeline. |
| `OPP_QUOTE_PREP` | Devis en cours | Pilotage en rédaction, relecture ou prêt à envoyer (`Q_DRAFT_NEW`, `Q_INTERNAL_REVIEW`, `Q_READY_TO_SEND`). |
| `OPP_CLIENT_PENDING` | Attente retour client | Pilotage `Q_SENT` ; pas de statut séparé « relancé » (variante B). |
| `OPP_STANDBY` | Standby / report | Pause ; pas de relances **automatiques** (défaut §5). |
| `OPP_WON` | Gagné | Deal conclu (sans preuve obligatoire v1). |
| `OPP_LOST` | Perdu | Deal abandonné. |

**Variante B** : pas de statut `OPP_FOLLOWUP` / « Relancé ». Les relances = **tâches** + champs `nbRelances` / dates.

### 2.1 Correspondance indicative — portail actuel (`frontend`)

Le portail utilise aujourd’hui des clés Twenty mappées côté API (`stage`), par ex. `NOUVEAU`, `DEVIS_EN_COURS`, `DEVIS_EN_RELECTURE`, `DEVIS_ENVOYE`, `RELANCE`, `GAGNE`, `PERDU`. La cible `OPP_*` est le **modèle canon** ; lors de l’implémentation, prévoir une **table de correspondance** Twenty ↔ `OPP_*` (ou adoption directe des libellés Twenty alignés sur cette spec).

| Cible | Exemple équivalent actuel (à valider en prod) |
|-------|-----------------------------------------------|
| `OPP_NEW` | `NOUVEAU` |
| `OPP_QUOTE_PREP` | `DEVIS_EN_COURS` / `DEVIS_EN_RELECTURE` (ou un seul stage + détail côté devis) |
| `OPP_CLIENT_PENDING` | `DEVIS_ENVOYE` (sans utiliser `RELANCE` si on abandonne ce stage au profit des tâches) |
| `OPP_STANDBY` | *à créer dans Twenty si absent* |
| `OPP_WON` | `GAGNE` |
| `OPP_LOST` | `PERDU` |

---

## 3. Statuts devis — documentaire (liste fermée)

| Code | Libellé UI |
|------|------------|
| `Q_DRAFT_NEW` | Nouveau en cours |
| `Q_INTERNAL_REVIEW` | Devis en relecture |
| `Q_READY_TO_SEND` | Devis à envoyer |
| `Q_SENT` | Devis envoyé |
| `Q_SUPERSEDED` | Remplacé / obsolète |
| `Q_CANCELLED` | Annulé |

### 3.1 Transitions devis autorisées (résumé)

- `Q_DRAFT_NEW` ↔ `Q_INTERNAL_REVIEW` (itérations).
- `Q_INTERNAL_REVIEW` → `Q_READY_TO_SEND` (validation interne).
- `Q_READY_TO_SEND` → `Q_SENT` (constat d’envoi) ; rollback contrôlé → `Q_INTERNAL_REVIEW` si politique métier l’autorise.
- Tout devis non pilotage ou ancienne version : `Q_SUPERSEDED` ou `Q_CANCELLED`.

---

## 4. Miroir opportunité ← devis pilotage

| Statut pilotage | Opportunité (hors terminaux / standby) |
|-----------------|----------------------------------------|
| `Q_DRAFT_NEW`, `Q_INTERNAL_REVIEW`, `Q_READY_TO_SEND` | `OPP_QUOTE_PREP` |
| `Q_SENT` | `OPP_CLIENT_PENDING` |

**Gel standby** : si opportunité = `OPP_STANDBY`, **ne pas** recalculer le miroir vers `OPP_QUOTE_PREP` / `OPP_CLIENT_PENDING` **tant que** l’on reste en standby (l’opportunité reste `OPP_STANDBY`). À la **sortie** de standby, recalcul immédiat depuis le pilotage (R-RESUME).

**Terminaux** : `OPP_WON` / `OPP_LOST` ne sont pas écrasés par le miroir.

---

## 5. Standby (ouvert)

- **Entrée** : action utilisateur « Mettre en standby » depuis tout état non terminal (règles métier locales).
- **Pendant standby** :
  - **Pas de relances automatiques** (pas de création / pas d’incrément d’échéances auto).
  - Les utilisateurs peuvent tout de même **manuellement** : reprendre le dossier, créer un devis, promouvoir le pilotage, marquer `SENT` selon permissions v1.
- **Sortie** : action « Reprendre » ; exécuter **R-RESUME** (recalcul miroir depuis pilotage).

---

## 6. Multi-devis et pilotage

1. **Création variante** : nouveau devis lié à l’opportunité ; statut initial `Q_DRAFT_NEW` ; **pas** auto-pilotage.
2. **Définir pilotage** : action UI + API ; `devisPilotageId` pointe vers le devis choisi ; **un seul** à la fois.
3. **Changement de pilotage** : si l’ancien pilotage était `Q_SENT` et le nouveau est en cycle interne, après R-RESUME l’opportunité redevient `OPP_QUOTE_PREP` (sauf standby / terminal).
4. **Envoi** : à `Q_SENT` sur le pilotage, appliquer **supersession** des autres devis en `Q_SENT` → `Q_SUPERSEDED` (§1.3 P3).

---

## 7. Relances (variante B)

- Pas de stage « Relancé » sur l’opportunité.
- À la première transition **`Q_READY_TO_SEND` → `Q_SENT`** sur le **pilotage**, créer une **tâche** type `RELANCE_CLIENT` (ou équivalent Twenty) avec échéance **J+X** (X défini métier).
- Relances suivantes : cron / règle métier (R-RELANCE) avec idempotence.
- À `OPP_WON` ou `OPP_LOST` : clôturer les tâches de relance ouvertes liées (R-WON-LOST).

---

## 8. Widgets et dashboards (prédicats)

**Référence** : pilotage seul pour D1, W1, D2 ; D3 basé sur l’opportunité.

| ID | Nom | Prédicat |
|----|-----|------------|
| **D1** | Finalisation devis | `stage ∉ {OPP_WON, OPP_LOST}` ET **non** `OPP_STANDBY` *(option : inclure standby — par défaut exclure standby pour refléter travail actif)* ET pilotage ∈ `{Q_DRAFT_NEW, Q_INTERNAL_REVIEW}` |
| **W1** | Prêts à envoyer (widget séparé) | idem non terminal, exclure `OPP_STANDBY` si politique « pas d’envoi en pause » ; pilotage = `Q_READY_TO_SEND` |
| **D2** | Relecture interne | pilotage = `Q_INTERNAL_REVIEW` |
| **D3** | Attente validation client | `stage = OPP_CLIENT_PENDING` (typiquement pilotage `Q_SENT`) |

Ordre de priorité d’affichage si une ligne pourrait matcher plusieurs intentions : **D2** > **W1** > **D1** > **D3** (ajuster selon UX ; ici D2 et W1 sont disjoints du D1 si `Q_READY_TO_SEND` est exclu de D1).

---

## 9. Gagné / Perdu v1 et rapport BC manquant

- **Transitions** : `WON` / `LOST` **sans preuve obligatoire** en v1.
- **Rapport « BC manquant »** : toutes les opportunités en `OPP_WON` où `bonDeCommandeRef` est vide (après trim).
- **Option portail** : badge ou section sur fiche opportunité « BC non renseigné » si `OPP_WON` et ref vide.

---

## 10. Permissions v1 et audit

- **v1** : tout utilisateur autorisé au module peut : marquer **`Q_SENT`**, passer **`OPP_WON` / `OPP_LOST`**.
- **Audit minimal** : à chaque action sensible, créer une **note** ou une entrée d’**activité** (Twenty) du type : `[AUTO] SENT — user … — devis … — …` ; idem pour `WON`/`LOST`. Si Twenty ne permet pas facilement l’activité structurée, utiliser **note standardisée** + horodatage.

---

## 11. Annexe A — Automations (table-driven, v1)

Chaque règle : **Trigger**, **Guards**, **Actions**, **Idempotence**.

| ID | Trigger | Guards | Actions | Idempotence |
|----|---------|--------|---------|-------------|
| **R-SENT-INIT** | Pilotage : `statutDocumentaire` passe de `Q_READY_TO_SEND` → `Q_SENT` | Opportunité ∉ `{OPP_WON, OPP_LOST}` ; opportunité ≠ `OPP_STANDBY` ; le devis concerné = `devisPilotageId` | 1) `sentAt = now`. 2) Miroir : `OPP_CLIENT_PENDING`. 3) Créer tâche `RELANCE_CLIENT` due `now+X`. 4) `nbRelances := 0` ou `1` selon convention ; `prochaineRelanceAt := due`. 5) Exécuter **P3** : autres devis même opportunité en `Q_SENT` → `Q_SUPERSEDED`. 6) Note audit « SENT … ». | Clé logique : pas de seconde tâche `RELANCE_CLIENT` **ouverte** pour `(opportunityId, devisPilotageId, runId=SENT_INIT)` ; ou flag `relanceInitSentAt` sur opportunité pour ce pilotage. **No-op** si tâche ouverte déjà présente. |
| **R-MIRROR** | Changement `statutDocumentaire` du **pilotage** (hors transition couverte par R-SENT-INIT si déjà géré) | Opportunité ∉ `{OPP_WON, OPP_LOST, OPP_STANDBY}` | Recalcul : si pilotage ∈ {DRAFT, REVIEW, READY} → `OPP_QUOTE_PREP` ; si `Q_SENT` → `OPP_CLIENT_PENDING` | Idempotent : réécrire même valeur stage OK. |
| **R-STANDBY** | Opportunité passe → `OPP_STANDBY` | — | 1) Annuler **ou** geler les échéances auto (ne pas créer de nouvelles tâches relance). 2) Option : clôturer tâches `RELANCE_CLIENT` ouvertes avec motif « standby » — **à choisir** ; défaut doc : **ne pas clôturer** pour ne pas perdre le contexte, mais **suspendre** tout cron relance. | Ne pas re-traiter si déjà en `OPP_STANDBY` (no-op). |
| **R-RESUME** | Sortie de `OPP_STANDBY` vers actif | — | Recalcul **R-MIRROR** depuis pilotage ; réactiver cron relance si applicable | Une fois par transition sortante. |
| **R-WON-LOST** | `OPP_WON` ou `OPP_LOST` | — | Clôturer toutes tâches `RELANCE_CLIENT` **ouvertes** liées à l’opportunité ; `prochaineRelanceAt := null` | Idempotent : reclôture no-op. |
| **R-RELANCE** | Échéance `prochaineRelanceAt` atteinte (cron) | `OPP_CLIENT_PENDING` ; pas `OPP_STANDBY` ; pas terminal ; tâche précédente due / statut attendu | Incrémenter `nbRelances` ; `derniereRelanceAt := now` ; créer nouvelle échéance tâche | Une exécution max par `(opportunityId, dueBucket)` (ex. fenêtre horaire) ou verrou DB. |
| **R-PILOT-CHANGE** | `devisPilotageId` change | Pas terminal | 1) Note audit. 2) Enchaîner **R-MIRROR**. | Idempotent si même pilotage. |

---

## 12. Annexe B — Mapping champs Twenty (proposition)

> Les noms exacts dépendent du modèle Twenty (objet custom « Devis » vs champs sur Opportunity). Ci-dessous : **noms logiques** ; à mapper aux API names Twenty lors de l’implémentation.

| Concept | Implémentation suggérée |
|---------|-------------------------|
| Statut opportunité | Champ pipeline / `stage` Twenty existant ; aligner valeurs sur `OPP_*` ou conserver clés actuelles + table de correspondance (§2.1). |
| `devisPilotageId` | Relation **Opportunity → Devis** (lookup) ou champ texte UUID si pas de relation native. |
| Statut documentaire devis | Select sur objet Devis (`statutDocumentaire`). |
| `sentAt`, `sentChannel`, `sentReference` | Champs datetime / select / text sur Devis. |
| `bonDeCommandeRef` | Champ texte sur **Opportunity** (simple pour le rapport v1). |
| Standby | Option A : stage `OPP_STANDBY` ; Option B : bool `isStandby` + champs motif/date (si stage Twenty limité). |
| Compteurs relance | Champs nombre + dates sur Opportunity **ou** agrégation depuis tâches (préférence champs opportunité pour filtres rapides). |

### 12.1 Moteur d’exécution des règles (décision)

| Option | Quand l’utiliser |
|--------|------------------|
| **Twenty workflows / triggers natifs** | Si couverture suffisante (transitions, conditions, idempotence raisonnable) et observabilité OK. |
| **Backend Railway** ([`backend/`](../backend/)) cron + GraphQL | Si besoin d’idempotence forte, fenêtres cron, rapports BC, logique complexe multi-objets. |
| **Webhooks** ([`backend/src/routes/webhooks.ts`](../backend/src/routes/webhooks.ts)) | Si les changements passent par un outil externe (Fillout) en source ; sinon complément Twenty. |

**Recommandation** : commencer par **Twenty** pour miroir simple + notes audit ; déporter **R-RELANCE** cron + **rapport BC** vers **backend** si Twenty limite l’idempotence ou les agrégats.

---

## 13. Annexe C — Spécification UI portail (`frontend/`)

### 13.1 Fiche opportunité

- **Bloc Devis** : liste des devis liés ; badge **Pilotage** sur la ligne courante `devisPilotageId`.
- **Action** : bouton « **Définir comme devis pilotage** » sur chaque devis non `Q_SUPERSEDED` / non `Q_CANCELLED` ; confirmation si changement alors que pilotage = `Q_SENT`.
- **Avertissement** : si ≥ 2 devis non obsolètes et pas de pilotage défini, bannière « Choisir un devis pilotage ».

### 13.2 Actions devis (selon statut)

- Transitions autorisées alignées §3.1 ; bouton **Marquer envoyé** (`Q_READY_TO_SEND` → `Q_SENT`) — visible pour tous en v1.
- Après `SENT`, afficher `sentAt` (lecture seule ou édition selon politique).

### 13.3 Pages / sections widgets

- **Section D1** : tableau filtré prédicat D1.
- **Section W1** : widget séparé « Prêts à envoyer » (W1).
- **Section D2** : « En relecture ».
- **Section D3** : « Attente retour client ».
- **Rapport BC** : page ou export CSV « Opportunités gagnées — BC manquant » (filtre §9).

### 13.4 Gagné / Perdu

- Boutons accessibles en v1 à tous ; post-action : rafraîchir la ligne et afficher hint « Pensez à renseigner le BC » si `OPP_WON` et ref vide.

---

## 14. Annexe D — Matrice de tests manuels (QA)

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| 1 | **Pilotage manuel** | Créer 2 devis ; ne pas définir pilotage ; définir pilotage sur le 2e | `devisPilotageId` = 2e ; miroir basé sur 2e uniquement. |
| 2 | **Changement de pilotage** | Pilotage A en `Q_SENT` ; promouvoir B en `Q_DRAFT_NEW` | Après R-MIRROR : `OPP_QUOTE_PREP` ; note audit présente. |
| 3 | **Double SENT (idempotence)** | `Q_READY_TO_SEND` → `Q_SENT` ; réexécuter / double clic si UI permet | Une seule tâche `RELANCE_CLIENT` ouverte type INIT ; `nbRelances` cohérent. |
| 4 | **Anti double vérité client** | Devis A (pilotage) `Q_SENT` ; créer B, promouvoir B, passer B `Q_SENT` | A (ex-pilotage ou autre) précédemment `Q_SENT` → `Q_SUPERSEDED` si toujours `Q_SENT` au moment de l’envoi B. |
| 5 | **Standby ouvert** | `OPP_CLIENT_PENDING` → `OPP_STANDBY` ; attendre échéance relance | Aucune nouvelle tâche auto ; sortie standby → R-RESUME recalcule le stage depuis pilotage. |
| 6 | **Nouveau devis puis SENT** | En standby, sortie, nouveau devis, pilotage, cycle jusqu’à `SENT` | Cohérent avec R-MIRROR + P3 ; pas de doublon relance INIT. |
| 7 | **WON sans BC** | Passer `OPP_WON` sans remplir `bonDeCommandeRef` | Opportunité apparaît dans rapport BC manquant ; badge fiche si implémenté. |
| 8 | **WON puis BC** | Saisir `bonDeCommandeRef` après coup | Disparaît du rapport ; données conservées. |
| 9 | **LOST** | `OPP_LOST` depuis `OPP_CLIENT_PENDING` avec tâche relance ouverte | Tâche relance clôturée (R-WON-LOST). |

---

## 15. Glossaire rapide

- **Pilotage** : le devis qui pilote miroir opportunité et règles D1/W1/D2/D3 par défaut.
- **Miroir** : statut opportunité dérivé du pilotage (sauf standby / terminaux).
- **Idempotence** : rejouer un trigger ne crée pas d’effets dupliqués néfastiques.

---

## 16. Suivi d’implémentation (gateway + Twenty)

### 16.1 Déjà couvert côté portail / gateway

- Champ **`devisPortailBundle`** (JSON Twenty) lu en **liste** via GraphQL `customFields(key: "devisPortailBundle")` (aligné détail REST) : widgets et pilotage cohérents entre liste et tiroir.
- **`R-WON-LOST`** : sur `POST /api/opportunities/:id/status` avec `GAGNE` ou `PERDU`, clôture des **tâches liées avec échéance** (même périmètre que les « rappels » portail), resync **`dateRelance`**, note `[Portail] R-WON-LOST`.

### 16.2 Workflows Twenty **optionnels** (doublon / complément)

| Règle | Dans Twenty ? | Remarque |
|-------|----------------|----------|
| **R-WON-LOST** | Optionnel | Déjà exécuté par le gateway ; un workflow Twenty en plus serait redondant (risque double clôture si mal filtré — à éviter). |
| **R-STANDBY** | Difficile / partiel | Le standby métier vit dans le **JSON bundle** (`standby.active`), pas dans un `stage` Twenty dédié. Les triggers « champ mis à jour » sur un sous-chemin JSON sont souvent limités. **Recommandation** : s’appuyer sur le portail (routes `…/standby`) + **cron backend** pour geler les relances auto si besoin ; si vous ajoutez un booléen miroir `standbyActif` sur l’opportunité, un workflow « quand `standbyActif` = true » devient faisable. |

### 16.3 Champs Twenty encore à aligner (selon modèle)

- Créer / vérifier les champs Twenty manquants (`bonDeCommandeRef`, `devisPortailBundle`, etc.).
- Migrer les stages existants (`RELANCE` → tâches) si adoption stricte variante B.
