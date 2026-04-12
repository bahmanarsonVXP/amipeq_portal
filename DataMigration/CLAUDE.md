# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Contexte

Migration de données Excel → **TWENTY CRM** (instance Railway).
- TWENTY CRM : https://twenty-production-7352.up.railway.app
- API key + base URL dans `/AMIPEQ_CRM/.env` (`TWENTY_API_KEY`, `TWENTY_BASE_URL`)
- Tous les scripts sont dans `DataMigration/` — `node_modules` déjà installé

---

## Commandes principales

```bash
cd DataMigration

# Import de nouvelles lignes (création uniquement, dédup automatique)
node import-master.js --file "Fichiers de suivi/MON_FICHIER.xlsx" --sheets 2026

# Import multi-onglets
node import-master.js --file "..." --sheets "2025,2026"

# Dry-run (validation sans écriture)
node import-master.js --file "..." --sheets 2026 --dry-run

# Mise à jour des statuts (script one-shot à adapter)
node update_statuts_2025_2026.js

# Mise à jour des montants (script one-shot à adapter)
node update_montants_2026.js
```

---

## Workflow de mise à jour périodique

Quand un nouveau fichier `SUIVIS_CLIENTS_AAAA_AAAAMMJJ.xlsx` arrive, suivre cette séquence :

### 1. Analyser les différences

Comparer le nouveau fichier avec l'ancien (`SUIVIS CLIENTS 2026_V2.xlsx`) pour détecter :
- **Changements de couleur de cellule** (col H = `dateDevis`) → changements de stage
- **Nouveaux N° DEVIS** (col H) absents de l'ancien fichier → nouvelles opportunités
- **Changements d'offre1/offre2** (cols J/K) → montants à mettre à jour

Outil de comparaison : lire les deux fichiers avec `xlsx` (`raw: true, cellStyles: true`) et comparer par `N° DEVIS`.

**Périmètre temporel :** ne modifier que les données à partir du **1er janvier 2025**. Les données antérieures à cette date ne doivent pas être touchées.

### 2. Mettre à jour les statuts (stage + statutDevis)

Pour chaque devis dont la **couleur de cellule** a changé, PATCHer dans TWENTY :

```
VERT  → stage: GAGNE,        statutDevis: GAGNE
GRIS  → stage: PERDU,        statutDevis: PERDU
BLANC → stage: DEVIS_ENVOYE, statutDevis: EN_ATTENTE
```

Trouver l'ID via GraphQL (`filter: { numeroDevis: { eq: "..." } }`), puis `PATCH /rest/opportunities/:id`.

### 3. Mettre à jour les montants réels

Patcher uniquement les devis où `offre1` ou `offre2` a **vraiment changé de valeur** (pas juste offre2 = offre1 → null, qui n'affecte pas le montant final).

### 4. Importer les nouveaux devis

```bash
node import-master.js --file "Fichiers de suivi/NOUVEAU.xlsx" --sheets 2026
```

La déduplication GraphQL sur `numeroDevis` ignore automatiquement les doublons.

---

## Architecture de l'import

```
import-master.js          ← orchestration CLI
└── lib/import-core.js    ← processExcelRow() : company → person → opportunity
    ├── lib/entities/company.js      ← ensureCompanyExists() avec cache mappings.json
    ├── lib/entities/person.js       ← ensurePersonExists() avec cache mappings.json
    └── lib/entities/opportunity.js  ← createOpportunity() avec dédup GraphQL

lib/core/http.js          ← restRequest() + graphqlRequest() avec rate limit 650ms
lib/core/mappings.js      ← cache UUID crash-safe (écriture immédiate à chaque création)
lib/parsers/
  ├── excel.js            ← parseExcelDate(), getCellColor()
  ├── departement.js      ← extractDepartement() → code enum TWENTY
  ├── client-classifier.js← classifyClient() → typeClient
  └── norme.js            ← parseNorme() → prestation (DUERP/FORMATION/AUDIT)
```

**Stratégie en cas d'échec partiel :** si company échoue → person + opportunity skippées. Si person échoue → opportunity créée quand même (person est optionnelle).

---

## Mapping colonnes Excel

| Col | Index | Champ | Utilisé pour |
|-----|-------|-------|-------------|
| C | 2 | N° Sté | `numeroSociete` (clé company) |
| D | 3 | CLIENTS | `nom` (company name) |
| E | 4 | Titre | `cpRaw` ← **ATTENTION** : c'est "Titre" (civilité), pas le CP réel |
| F | 5 | CONTACT | `contact` (person name) |
| H | 7 | N° DEVIS | `numeroDevis` ET `telephone` ← **bug historique dans import-master.js** |
| I | 8 | Date Devis | `dateDevis`, `createdAt` |
| J | 9 | OFFRE N°1 | `offre1` |
| K | 10 | OFFRE N°2 | `offre2` |
| L | 11 | NORME | `norme` |
| S | 18 | CP | CP réel — **non utilisé par import-master.js** (utilise col E à la place) |
| T | 19 | VILLE | `ville` |
| W | 22 | E-mail | email réel — **non utilisé** |
| X | 23 | Date Docs Envoyés | `dateDocsEnvoyes` |

**Note :** la détection du département se base sur `cpRaw` (col E = Titre), souvent non numérique. Si invalide, `extractDepartement` retourne `null` et le champ est omis — sans erreur.

---

## Contraintes du schéma TWENTY (bugs historiques résolus)

Ces champs **n'existent pas** dans le schéma TWENTY actuel — ne pas les envoyer :
- `sousTypeClient` sur company
- `naturePrestation` sur opportunity
- `modalite` sur opportunity

Le champ `departement` attend le format enum complet : `DEPT_62_PAS_DE_CALAIS` (pas `'62'`). Le parser `extractDepartement()` retourne déjà ce format depuis avril 2026.

---

## Cache mappings.json

`DataMigration/mappings.json` (~242 KB) contient tous les UUIDs TWENTY déjà créés :
```json
{
  "companies": { "109153": "uuid...", ... },
  "persons": { "109153|Jean Dupont": "uuid...", ... }
}
```

Si une société existe dans TWENTY mais pas dans `mappings.json`, la prochaine tentative de création retournera une erreur 400/409. Dans ce cas, ajouter manuellement l'UUID dans `mappings.json` via `mappings.saveCompany(numero, id)`.

---

## Erreurs connues (migration initiale)

8 opportunités non importées lors de la migration initiale (mars 2026) :
- `105081-CL-23343` : date invalide ("BAIE MAHAULT" dans un champ date)
- `108496`, `108497`, `108498`, `105718`, `104925` : numeroDevis = numéro seul sans suffixe `-CL-XXXXX`
- Companies `108621` et `108673` : absentes du fichier source

---

## Rate limiting

650ms minimum entre chaque appel API (géré automatiquement par `lib/core/rate-limiter.js`). Pour 60 nouvelles opportunités : ~5 minutes. Pour 600 : ~40 minutes.
