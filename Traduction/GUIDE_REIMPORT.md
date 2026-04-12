# Guide : Réimporter les traductions sur une nouvelle instance TWENTY

Ce guide explique comment réappliquer vos traductions françaises sur une nouvelle instance TWENTY CRM (par exemple après un déploiement sur Railway).

## Le problème

Les **UUIDs des objets et champs** sont propres à chaque instance PostgreSQL. Si vous déployez TWENTY sur une nouvelle base de données, tous les UUIDs changent, rendant impossible l'import direct d'un ancien fichier de traduction.

## La solution en 3 étapes

### Prérequis

- Node.js v18+
- Packages installés : `npm install xlsx dotenv`
- Fichier `.env` à la racine du projet (`/Users/bahmanarson/projects/AMIPEQ_CRM/.env`) avec :
  ```env
  TWENTY_BASE_URL=https://votre-instance.railway.app/
  TWENTY_API_KEY=votre_clé_api
  ```

---

### Étape 1 : Exporter les métadonnées de la NOUVELLE instance

Depuis le répertoire `Traduction/` :

```bash
node export_metadata.js
```

**Résultat :**
- `twenty_metadata_fr.tsv` — nouveau fichier avec les **bons UUIDs** de la nouvelle instance
- `twenty_metadata_backup.json` — backup JSON

---

### Étape 2 : Fusionner les anciennes traductions avec les nouveaux UUIDs

Si vous avez un ancien fichier ODS/TSV avec vos traductions, utilisez le script de fusion :

```bash
node merge_translations.js twenty_metadata_fr.ods twenty_metadata_fr.tsv twenty_metadata_merged.tsv
```

**Paramètres :**
1. `twenty_metadata_fr.ods` — ancien fichier avec vos traductions FR (mais vieux UUIDs)
2. `twenty_metadata_fr.tsv` — nouveau fichier exporté (nouveaux UUIDs, pas de traductions)
3. `twenty_metadata_merged.tsv` — fichier de sortie fusionné

**Ce que fait le script :**
- Lit les traductions de l'ancien fichier
- Fait correspondre par **nom technique** (stable entre instances)
- Applique les traductions au nouveau fichier avec les bons UUIDs

**Résultat attendu :**
```
📚 115 traductions trouvées dans l'ancien fichier
✅ 347 traductions appliquées
⚠️  108 éléments sans traduction (nouveaux ou non traduits)
```

---

### Étape 3 : Importer les traductions

**IMPORTANT :** Ne pas passer d'arguments au script ! Il doit lire le `.env` automatiquement.

```bash
node import_translations.js
```

⚠️ **NE PAS FAIRE :** ~~`node import_translations.js twenty_metadata_merged.tsv`~~
(Cela cause une erreur "Invalid URL" car le script prend le nom de fichier comme URL)

**Déroulement :**
1. Affiche un aperçu de toutes les modifications
2. Attend votre confirmation (Entrée pour continuer, Ctrl+C pour annuler)
3. Applique les renommages via l'API GraphQL
4. Affiche un résumé (succès/erreurs)

**Résultat attendu :**
```
🏁 Terminé!
   Objets: 2 OK, 0 erreurs
   Champs: 151 OK, 3 erreurs
```

**Erreurs normales :**
- Certains champs système peuvent retourner "Multiple validation errors" — ils ne sont pas modifiables
- Les champs `accountOwner`, `type`, etc. sont parfois protégés

---

## Utilisation du fichier fusionné

Si vous avez déjà un `twenty_metadata_merged.tsv` prêt, vous pouvez modifier le script pour pointer vers ce fichier :

**Option 1 — Renommer le fichier fusionné :**
```bash
cp twenty_metadata_merged.tsv twenty_metadata_fr.tsv
node import_translations.js
```

**Option 2 — Modifier le script temporairement :**
Changez la ligne 21 dans `import_translations.js` :
```javascript
const TSV_FILE = process.argv[4] || 'twenty_metadata_merged.tsv';
```

---

## Bugs corrigés

### Bug "Invalid URL"

**Symptôme :** Toutes les requêtes échouent avec `Invalid URL`

**Cause :** Les arguments du script `import_translations.js` sont dans cet ordre :
1. `TWENTY_URL`
2. `API_KEY`
3. `TSV_FILE`

Si vous passez juste le nom du fichier TSV, le script le prend comme URL.

**Solution :** Ne pas passer d'arguments du tout, laisser le script lire le `.env`

### Bug d'encodage UTF-8

**Symptôme :** Les colonnes comme "Label FR (à modifier)" ne sont pas trouvées, ou les accents sont corrompus (é → Ã©)

**Cause :** La librairie `xlsx` lit les fichiers TSV avec un mauvais encodage, causant une double-encodage UTF-8

**Solution :** Le script `import_translations.js` utilise maintenant `fs.readFileSync()` avec encodage UTF-8 explicite au lieu de `xlsx.readFile()` pour lire les fichiers TSV

---

## Fichiers générés

| Fichier | Description |
|---------|-------------|
| `twenty_metadata_fr.tsv` | Export des métadonnées avec nouveaux UUIDs |
| `twenty_metadata_backup.json` | Backup JSON des métadonnées |
| `twenty_metadata_merged.tsv` | Fichier fusionné prêt à importer |
| `twenty_metadata_fr.ods` | Ancien fichier avec traductions (à conserver) |

---

## Résumé des commandes

```bash
# 1. Exporter depuis la nouvelle instance
node export_metadata.js

# 2. Fusionner les traductions
node merge_translations.js twenty_metadata_fr.ods twenty_metadata_fr.tsv twenty_metadata_merged.tsv

# 3. Importer (sans arguments !)
node import_translations.js
```

---

## Troubleshooting

### "Colonne non trouvée"
- Vérifiez que le fichier TSV a bien les colonnes attendues
- Le script utilise un matching flexible pour gérer les problèmes d'encodage

### "Forbidden resource"
- Vérifiez que `TWENTY_API_KEY` est valide
- Vérifiez que l'URL dans `.env` est correcte

### Les traductions ne s'appliquent pas
- Certains champs standard ne sont pas modifiables
- Seuls les champs custom et certains champs standard acceptent les renommages

---

**Date de création :** 2026-03-01
**Instance cible :** https://twenty-production-7352.up.railway.app/
