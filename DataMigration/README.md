# AMIPEQ CRM Data Migration - Architecture Modulaire

**Date de refactorisation:** 3 mars 2026

## 📋 Vue d'ensemble

Architecture modulaire pour l'import de données Excel vers TWENTY CRM avec:
- ✅ Bibliothèque réutilisable pour traiter une ligne Excel à la fois
- ✅ Script maître paramétrable avec CLI flexible
- ✅ Déduplication automatique (companies, persons, opportunities)
- ✅ Gestion d'erreurs robuste (continue on partial failure)
- ✅ Crash-safe (mappings écrits immédiatement)

---

## 🚀 Usage Rapide

### Script supporté
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
```

### Dry run (validation sans création)
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx" --dry-run
```

### Limite de lignes (testing)
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx" --limit 50
```

### Politique projet
- `import_fichier_suivi_par_onglet.js` est le **seul** script d'import supporté.
- `import-master.js` est **abandonné** et bloque désormais son exécution.
- les anciens scripts d'import restent au mieux comme archive technique, pas comme point d'entrée opérationnel.

---

## 📁 Structure de l'Architecture

```
DataMigration/
├── lib/
│   ├── core/
│   │   ├── http.js              # REST & GraphQL requests + rate limiting
│   │   ├── mappings.js          # Cache mappings.json (crash-safe)
│   │   ├── company-schema.js    # Introspection du schéma Twenty + enums réels
│   │   ├── company-derived.js   # Déduction centralisée type/sous-type/département
│   │   └── rate-limiter.js      # Rate limiting (650ms entre requêtes)
│   │
│   ├── parsers/
│   │   ├── excel.js             # parseExcelDate, getCellColor
│   │   ├── norme.js             # parseNorme (3 types: DUERP, FORMATION, AUDIT)
│   │   ├── departement.js       # extractDepartement (DOM-TOM, Corse, Métropole)
│   │   └── client-classifier.js # classifyClient (type et sous-type)
│   │
│   ├── entities/
│   │   ├── company.js           # ensureCompanyExists (cache + création + sync dérivé)
│   │   ├── person.js            # ensurePersonExists (cache + création)
│   │   └── opportunity.js       # createOpportunity (GraphQL check)
│   │
│   └── import-core.js           # processExcelRow() - fonction principale
│
├── import_fichier_suivi_par_onglet.js  # Seul script d'import supporté
├── import-master.js             # DEPRECATED - bloqué volontairement
├── audit_types_departements.js  # Audit JSON/CSV des sociétés existantes
├── backfill_types_departements.js # Correction contrôlée depuis un audit
│
├── [DEPRECATED] Scripts historiques (conservés pour référence)
│   ├── import_clients.js
│   ├── import_opportunities_only.js
│   ├── import_new_companies_2026.js
│   └── import_opportunities_from_v2.js
│
└── mappings.json                # Cache numeroSociete/contact → UUID TWENTY
```

---

## 🔑 Concepts Clés

### 1. Fonction processExcelRow()

**Signature:**
```javascript
async function processExcelRow(rowData, sheetName, options)
```

**Comportement:**
1. Vérifie si company existe → crée si besoin
2. Vérifie si person existe → crée si besoin
3. Vérifie si opportunity existe → crée si besoin
4. Continue même en cas d'erreur partielle
5. Retourne résultat détaillé pour chaque entité

**Avantages:**
- Atomique: traite UNE ligne à la fois
- Réutilisable: même logique pour tous les imports
- Testable: facile à tester unitairement

### 2. Déduplication

**Companies & Persons:** Cache mappings.json
- Companies: clé = `numeroSociete`
- Persons: clé = `"numeroSociete|contact"`
- Lecture rapide (O(1))
- Les companies déjà présentes dans le cache peuvent maintenant être resynchronisées à la volée pour combler les champs dérivés manquants (`typeClient`, `sousType`, `departement`, `departementNumero`)

**Opportunities:** GraphQL check
- Requête: `opportunities(filter: { numeroDevis: { eq: "..." } })`
- Source de vérité authoritative
- Évite les doublons même si cache perdu

### 3. Rate Limiting

- **650ms minimum entre toutes requêtes API**
- Singleton RateLimiter partagé
- Appliqué automatiquement par http.js

### 4. Gestion d'erreurs

**Continue on Partial Failure:**
- Company échoue → person et opportunity skippées
- Person échoue → opportunity créée quand même (person optionnel)
- Toutes les erreurs loggées dans le résultat

**Pas de rollback:** TWENTY API est RESTful, pas de transactions

### 5. Crash-safe

**Mappings écrits immédiatement:**
- Après chaque company créée → write to file
- Après chaque person créée → write to file
- Overhead: ~2s sur 17 min = 0.2% (négligeable)

**Bénéfice:**
- Si crash → mappings à jour
- Ré-import = déduplication automatique

---

## 📊 Parsing Excel

### Dates
```javascript
parseExcelDate(dateStr, defaultYear)
```
- Support serial numbers Excel (ex: 44929 → 2023-01-02)
- Support format "14-Jan-2023"
- Support ISO "2023-01-14"

### Couleur cellule
```javascript
getCellColor(cell)
```
- VERT: #00FF00, #00B050, #92D050 → Gagné
- GRIS: #D3D3D3, #BFBFBF, #A6A6A6 → Perdu
- BLANC: autre → En attente (ou perdu si > 120 jours)

### Norme
```javascript
parseNorme(norme)
```
- Détecte: DUERP, FORMATION, AUDIT
- **IMPORTANT:** `nature` et `modalite` toujours à `null`
  - TWENTY schema ne supporte pas ces champs
  - Erreur si valeurs envoyées

### Département
```javascript
extractDepartement(cpRaw)
```
- Validation stricte du CP sur 5 chiffres
- DOM-TOM supportés: 971, 972, 973, 974, 976
- Corse: 2A/2B selon CP
- Retourne `numero`, `canonicalCode`, `code`, `normalizedPostcode`
- Les valeurs réellement envoyées à Twenty sont résolues depuis les options live du schéma

### Classification client
```javascript
classifyClient(name)
```
- ETABLISSEMENT_SCOLAIRE: Collège, Lycée, École
- MAIRIE_COLLECTIVITE: mairie, communauté, agglo, métropole, CCAS/CIAS
- AUTRE: association, EHPAD, cas non métiers
- ENTREPRISE_TPE_PME: formes juridiques explicites + fallback contrôlé
- Retourne aussi `confidence`, `reason`, `ruleId` pour l'audit et le backfill

---

## 🧪 Tests

### Test 1: Dry run
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx" --dry-run --limit 50
```
Validation sans création

### Test 2: Import partiel
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx" --limit 50
```
Import limité pour vérification

### Test 3: Ré-import (déduplication)
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
# Puis ré-exécuter la même commande
```
Résultat attendu: 0 créé, tout skippé (déduplication fonctionne)

### Test 4: Import réel
```bash
node import_fichier_suivi_par_onglet.js --sheet 2026 --file "Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx"
```
Import de l'onglet sélectionné uniquement

---

## 🔧 Décisions Techniques

### parseNorme: Version 2
✅ **Utilisé:** 3 types (DUERP, FORMATION, AUDIT)
❌ **Rejeté:** Version 1 avec 6 types + nature/modalite

**Raison:** TWENTY schema ne supporte PAS nature/modalite
- Tests: "Invalid value 'DU' for field naturePrestation"
- Tests: "Invalid value 'DISTANCIEL' for field modalite"
- Documenté: RAPPORT_IMPORT_OPPORTUNITIES.md

### Mappings: Écriture immédiate
✅ **Utilisé:** Write after each creation
❌ **Rejeté:** Periodic writes (every 50 rows)

**Raison:** Crash-safety > performance
- Overhead: 0.2% du temps total
- Survit aux crashes
- Idempotent retries

### Déduplication: Hybride
✅ **Companies/Persons:** Map-based (rapide)
✅ **Opportunities:** GraphQL (authoritative)

**Raison:** Opportunités peuvent exister sans cache
- numeroDevis peut manquer dans mappings.json
- GraphQL = source de vérité

### Error Handling: Continue
✅ **Utilisé:** Continue on partial failure
❌ **Rejeté:** Rollback/transactions

**Raison:** Pas de transactions dans TWENTY API
- Log errors + continue
- Retry manuel possible
- Statistiques détaillées en fin

---

## 📈 Performance

**Estimations:**
- 1 ligne = ~1950ms (3 requêtes × 650ms)
- 1,709 opportunities = ~55 minutes
- Mais: déduplication = skip rapide (~100ms)
- Réalité: 15-18 minutes pour import complet

**Optimisations:**
- Mappings cache (O(1) lookup)
- Rate limiting request-level (pas de sleep inutile)
- Continue on failure (pas de retry exponentiel)

---

## 🚨 Anciennes Erreurs Corrigées

### 1. Doublons (47 numéros en doublon)
✅ **Corrigé:** GraphQL check avant création

### 2. numeroSociete string au lieu de Number
✅ **Corrigé:** `Number(numeroSociete)` dans body

### 3. domainName vide rejeté
✅ **Corrigé:** Omis du body si vide

### 4. Dates Excel serial numbers non parsées
✅ **Corrigé:** parseExcelDate() supporte serial numbers

### 5. nature/modalite invalides
✅ **Corrigé:** Toujours à null

---

## 📚 Documentation Additionnelle

- **Plan complet:** `/Users/bahmanarson/.claude/plans/piped-moseying-neumann.md`
- **Guide erreurs:** `GUIDE_CORRECTION_ERREURS.md`
- **Rapport import V1:** `RAPPORT_IMPORT_OPPORTUNITIES.md`
- **Status migration:** `STATUS_MIGRATION.md`
- **Import V2:** `IMPORT_V2_STATUS.md`

---

## 🎯 Prochaines Étapes

1. ✅ **Refactorisation terminée** (3 mars 2026)
2. ⏳ **Import onglet 2026** (131 nouvelles opportunities)
3. 📝 **Corriger 8 erreurs** (voir GUIDE_CORRECTION_ERREURS.md)
4. ✅ **Validation finale:** 1709 opportunities totales

---

**Développé avec Claude Code**
*Date de refactorisation: 3 mars 2026*
