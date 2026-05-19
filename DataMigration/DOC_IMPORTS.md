# Documentation — Imports AMIPEQ vers TWENTY CRM

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Scripts principaux](#scripts-principaux)
3. [Mapping colonnes Excel](#mapping-colonnes-excel)
4. [Workflow type — nouveau fichier SUIVIS](#workflow-type--nouveau-fichier-suivis)
5. [Déduplication](#déduplication)
6. [Gestion des erreurs](#gestion-des-erreurs)
7. [Rate limiting et temps d'exécution](#rate-limiting-et-temps-dexécution)

---

## Vue d'ensemble

L'import suit toujours l'ordre : **Company → Person → Opportunity**

```
Fichier Excel (SUIVIS CLIENTS)
         │
         ▼
import_fichier_suivi_par_onglet.js
         │
         ▼
lib/import-core.js  →  processExcelRow()
    ├── lib/entities/company.js     ensureCompanyExists()
    ├── lib/entities/person.js      ensurePersonExists()
    └── lib/entities/opportunity.js createOpportunity()
         │
         ▼
TWENTY CRM (REST + GraphQL)
```

### Déduplication à deux niveaux

| Niveau | Mécanisme | Fichier |
|--------|-----------|---------|
| Company | Clé `numeroSociete` dans `mappings.json` | `lib/core/mappings.js` |
| Person | Clé `numeroSociete\|contact` dans `mappings.json` | `lib/core/mappings.js` |
| Opportunity | Requête GraphQL sur `numeroDevis` avant création | `lib/entities/opportunity.js` |

Le script est **idempotent** : safe à relancer plusieurs fois sur le même fichier.

### mappings.json

Cache local (~242 KB) des UUIDs TWENTY déjà créés :
```json
{
  "companies": { "109197": "3e50561f-285d-4cb3-86ca-d355da37e3e2", ... },
  "persons":   { "109197|GUILLAUME Karine": "uuid...", ... }
}
```
Écrit immédiatement après chaque création (crash-safe).

---

## Scripts principaux

### `import_fichier_suivi_par_onglet.js` — Import complet par onglet

**Le script à utiliser pour tout nouvel import.**

```bash
node import_fichier_suivi_par_onglet.js --sheet 2026
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/MON_FICHIER.xlsx"
node import_fichier_suivi_par_onglet.js --sheet 2026 --dry-run
node import_fichier_suivi_par_onglet.js --sheet 2026 --limit 10
```

| Argument | Obligatoire | Description |
|----------|-------------|-------------|
| `--sheet` | Oui | Nom de l'onglet Excel (ex. `2026`, `2025`) |
| `--file` | Non | Chemin du fichier (défaut: `Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx`) |
| `--dry-run` | Non | Valide sans écrire dans TWENTY |
| `--limit N` | Non | Traite seulement les N premières lignes |

**Prérequis :** la colonne Y (Statut) doit être remplie pour **toutes** les lignes. Le script vérifie cela avant tout import et s'arrête en listant les lignes incomplètes si ce n'est pas le cas.

---

### `import-master.js` — Import multi-onglets (historique)

**Abandonné. Ne plus utiliser.**

Ce script a servi à la migration initiale, mais il n'est plus un point d'entrée supporté.
Son exécution est désormais bloquée volontairement pour forcer l'usage de `import_fichier_suivi_par_onglet.js`.

---

### Scripts de mise à jour (`update_*`)

Scripts one-shot pour mettre à jour des données existantes suite à un nouveau fichier SUIVIS :

| Script | Rôle |
|--------|------|
| `update_statuts_20260413.js` | Met à jour stage + statutDevis des opps dont la couleur a changé |
| `update_montants_20260413.js` | Met à jour amount, tauxRemise, montantRemise |
| `update_prestations_20260413.js` | Met à jour le champ prestation (NORME) |

Ces scripts **ne créent pas** de nouvelles companies, persons ou opportunities.

---

## Mapping colonnes Excel

Indexation 0-based (`row[0]` = colonne A).

| Lettre | Index | En-tête | Champ TWENTY | Notes |
|--------|-------|---------|--------------|-------|
| A | 0 | Prosp | — | Non utilisé |
| B | 1 | DATE | `date` | Date prospection |
| C | 2 | N° Sté | `numeroSociete` | Clé de déduplication company |
| D | 3 | CLIENTS | `nom` | Nom de la company |
| E | 4 | Titre | `titre` | Civilité du contact |
| F | 5 | CONTACT | `contact` | Prénom + Nom du contact |
| G | 6 | CIAL | — | Commercial (non utilisé) |
| H | 7 | N° DEVIS | `numeroDevis` | Clé de déduplication opportunity |
| I | 8 | Date Devis | `dateDevis` | Date du devis |
| J | 9 | OFFRE N°1 | `offre1` | Montant brut |
| K | 10 | OFFRE N°2 | `offre2` | Montant remisé (optionnel) |
| L | 11 | NORME | `norme` | Prestation (DUERP, PPMS, RPS…) |
| Q | 16 | Adresse Ligne 1 | `adresse1` | Rue |
| S | 18 | CP | `cp` / `cpRaw` | Code postal (5 chiffres) |
| T | 19 | VILLE | `ville` | Ville |
| U | 20 | TELEPHONE | `telephone` | Téléphone du contact |
| W | 22 | E-mail | `email` | Email du contact |
| X | 23 | Date Docs Envoyés | `dateDocsEnvoyes` | Date envoi documents |
| Y | 24 | Statut | `couleurDevis` | **Obligatoire** — voir tableau ci-dessous |

### Valeurs de la colonne Y

| Valeur Excel | stage TWENTY | statutDevis |
|---|---|---|
| `Gagné` | `GAGNE` | `GAGNE` |
| `Perdu` | `PERDU` | `PERDU` |
| `Devis envoyé` | `DEVIS_ENVOYE` | `EN_ATTENTE` |
| vide | → ERREUR, import bloqué | — |

### Montant importé

- Si `offre2` est renseignée : montant principal = `offre2`, remise calculée = `offre1 - offre2`
- Sinon : montant principal = `offre1`

---

## Workflow type — nouveau fichier SUIVIS

### Cas 1 : Nouveau fichier avec de nouvelles lignes

```
SUIVIS_CLIENTS_2026_YYYYMMDD.xlsx
```

**Étape 1 — Préparer la colonne Y dans Excel**
- Renseigner `Gagné`, `Perdu` ou `Devis envoyé` pour chaque ligne de l'onglet à importer

**Étape 2 — Dry-run (validation)**
```bash
cd DataMigration
node import_fichier_suivi_par_onglet.js --sheet 2026 \
  --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_YYYYMMDD.xlsx" \
  --dry-run
```
Vérifier : aucune erreur bloquante, nombre de lignes attendu.

**Étape 3 — Import réel**
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 \
  --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_YYYYMMDD.xlsx"
```

---

### Cas 2 : Mise à jour d'un fichier existant (statuts/montants)

Utiliser les scripts `update_*` adaptés à la période :

```bash
# 1. Identifier les changements
node analyze_diff_20260413.js

# 2. Mettre à jour les statuts
node update_statuts_20260413.js

# 3. Mettre à jour les montants
node update_montants_20260413.js

# 4. Importer les nouvelles lignes (si présentes)
node import_fichier_suivi_par_onglet.js --sheet 2026 \
  --file "Fichiers de suivi/NOUVEAU.xlsx"
```

---

## Déduplication

### Company
1. Cherche `numeroSociete` dans `mappings.json`
2. Si trouvé → réutilise l'UUID existant (aucun appel API)
3. Si absent → crée dans TWENTY, sauvegarde dans `mappings.json`

### Person (contact)
1. Cherche `numeroSociete|contact` dans `mappings.json`
2. Si trouvé → réutilise l'UUID existant
3. Si absent ET colonne F non vide → crée dans TWENTY, sauvegarde
4. Si colonne F vide → skippé (opportunity créée quand même sans contact)

Le nom du contact est désormais parsé via `lib/parsers/contact-name.js`, avec prise en charge des formats source de type `NOM Prénom`.

### Opportunity
1. Requête GraphQL : `filter: { numeroDevis: { eq: "..." } }`
2. Si `totalCount > 0` → doublon, skip
3. Si absent → crée avec `companyId` + `pointOfContactId`

**Si une company échoue** → person et opportunity sont skippées pour cette ligne.
**Si une person échoue** → opportunity est quand même tentée (contact optionnel).

---

## Gestion des erreurs

### Erreur 400/409 — Company déjà dans TWENTY mais absente de mappings.json

La company a peut-être été créée manuellement ou lors d'une migration antérieure.

**Solution :** ajouter manuellement l'UUID dans `mappings.json` :
```json
{
  "companies": {
    "109197": "3e50561f-285d-4cb3-86ca-d355da37e3e2"
  }
}
```

### Erreur — Champ non supporté par le schéma TWENTY

Les champs suivants **n'existent pas** dans TWENTY — ne jamais les envoyer :
- `sousTypeClient` sur company
- `naturePrestation` sur opportunity
- `modalite` sur opportunity

En revanche, les champs company suivants sont bien exploités par le flux actuel et les scripts de rattrapage :
- `typeClient`
- `sousType`
- `departement`
- `departementNumero`

### Département et enums live

Ne pas supposer les valeurs API des enums à partir des labels métier.

Pour `sousType` et `departement`, utiliser l'introspection live du schéma Twenty avant toute écriture massive. Exemple constaté sur l'instance actuelle :
- `sousType` "Communauté de communes" → valeur API `COMMUNAUTE_COMMUNES`
- certains départements utilisent des valeurs API dérivées des labels accentués, pas toujours le slug "attendu" à la main

Le script `audit_types_departements.js` capture ces options réelles dans son rapport JSON avant toute correction.

---

## Rate limiting et temps d'exécution

Le module `lib/core/rate-limiter.js` impose **650 ms minimum** entre chaque appel API.

Chaque ligne génère au maximum 3 appels (company + person + opportunity).
En pratique, company et person sont souvent déjà dans `mappings.json` → 1 seul appel (opportunity).

| Lignes | Appels estimés | Temps estimé |
|--------|---------------|--------------|
| 50 | 50–150 | ~30 s – 2 min |
| 200 | 200–600 | 2 – 7 min |
| 600 | 600–1800 | 7 – 20 min |
| 1500 | 1500–4500 | 17 – 50 min |
