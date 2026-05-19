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

# ★ Import complet d'un onglet (Company + Person + Opportunity)
node import_fichier_suivi_par_onglet.js --sheet 2026
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/MON_FICHIER.xlsx"
node import_fichier_suivi_par_onglet.js --sheet 2026 --dry-run  # validation sans écriture
node import_fichier_suivi_par_onglet.js --sheet 2026 --limit 10  # test 10 lignes

# IMPORTANT
# import_fichier_suivi_par_onglet.js est le seul point d'entrée supporté.
# import-master.js est abandonné et ne doit plus être utilisé.

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
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/NOUVEAU.xlsx"
```

La déduplication GraphQL sur `numeroDevis` ignore automatiquement les doublons.

---

## Architecture de l'import

```
import_fichier_suivi_par_onglet.js  ← seul CLI d'import supporté
└── lib/import-core.js              ← processExcelRow() : company → person → opportunity
    ├── lib/entities/company.js      ← ensureCompanyExists() avec cache mappings.json
    ├── lib/entities/person.js       ← ensurePersonExists() avec cache mappings.json
    └── lib/entities/opportunity.js  ← createOpportunity() avec dédup GraphQL

lib/core/http.js          ← restRequest() + graphqlRequest() avec rate limit 650ms
lib/core/mappings.js      ← cache UUID crash-safe (écriture immédiate à chaque création)
lib/core/company-schema.js← introspection du schéma Twenty + options réelles
lib/core/company-derived.js← déduction centralisée type/sous-type/département
lib/parsers/
  ├── excel.js            ← parseExcelDate(), getCellColor()
  ├── departement.js      ← extractDepartement() → numero + code canonique
  ├── client-classifier.js← classifyClient() → typeClient + sousType + confiance
  └── norme.js            ← parseNorme() → prestation (DUERP/FORMATION/AUDIT)
```

**Stratégie en cas d'échec partiel :** si company échoue → person + opportunity skippées. Si person échoue → opportunity créée quand même (person est optionnelle).

---

## Mapping colonnes Excel

| Col | Index | Champ | Utilisé pour |
|-----|-------|-------|-------------|
| C | 2 | N° Sté | `numeroSociete` (clé company) |
| D | 3 | CLIENTS | `nom` (company name) |
| E | 4 | Titre | `titre` (civilité contact) |
| F | 5 | CONTACT | `contact` (person name) |
| H | 7 | N° DEVIS | `numeroDevis` |
| I | 8 | Date Devis | `dateDevis`, `createdAt` |
| J | 9 | OFFRE N°1 | `offre1` |
| K | 10 | OFFRE N°2 | `offre2` |
| L | 11 | NORME | `norme` |
| S | 18 | CP | `cp` / `cpRaw` |
| T | 19 | VILLE | `ville` |
| U | 20 | TELEPHONE | `telephone` |
| W | 22 | E-mail | `email` |
| X | 23 | Date Docs Envoyés | `dateDocsEnvoyes` |

**Note :** le chemin supporté utilise bien le CP réel (col S) et la civilité (col E).

---

## API TWENTY — Priorité GraphQL sur REST

**Toujours utiliser GraphQL (`graphqlRequest`) en priorité pour toute opération sur TWENTY CRM.**

L'API REST (`/rest/...`) est instable et retourne des erreurs 500 "No data sources found" sur certains types d'objets (notamment `Person`). GraphQL est l'interface officielle et fiable.

```js
// ✅ Correct
const { graphqlRequest } = require('./lib/core/http');
await graphqlRequest(`mutation { updatePerson(id: "...", data: { ... }) { id } }`);

// ❌ À éviter — REST peut échouer silencieusement sur Person
const { restRequest } = require('./lib/core/http');
await restRequest('PATCH', '/rest/people/...', { ... });
```

---

## Contraintes du schéma TWENTY (bugs historiques résolus)

Ces champs **n'existent pas** dans le schéma TWENTY actuel — ne pas les envoyer :
- `sousTypeClient` sur company
- `naturePrestation` sur opportunity
- `modalite` sur opportunity

Les champs company utilisés pour le rattrapage actuel sont :
- `typeClient`
- `sousType`
- `departement`
- `departementNumero`

Important :
- ne pas deviner les valeurs API des enums à la main ;
- introspecter le schéma live avant les corrections massives ;
- l'instance actuelle utilise par exemple `COMMUNAUTE_COMMUNES` pour le sous-type "Communauté de communes" ;
- certaines valeurs API de `departement` reflètent la normalisation des labels accentués, elles doivent donc être résolues via `lib/core/company-schema.js`.

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
