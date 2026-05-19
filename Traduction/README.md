# Twenty CRM — Renommage en masse des labels (FR)

## Prérequis
- Node.js installé (v18+)
- Accès à ton instance Twenty avec une clé API

## Étape 1 — Exporter les métadonnées

```bash
node export_metadata.js https://twenty-production-7352.up.railway.app "TA_CLE_API"
```

Ça génère :
- `twenty_metadata_fr.tsv` → le fichier à modifier
- `twenty_metadata_backup.json` → backup des métadonnées actuelles

## Étape 2 — Modifier dans Excel

1. Ouvre `twenty_metadata_fr.tsv` dans Excel (File → Open, sélectionne "All Files")
2. Excel détecte automatiquement les tabulations comme séparateur
3. Modifie la **colonne F "Label FR (à modifier)"** :
   - Pour les **OBJETS** : format `Singulier / Pluriel` (ex: `Entreprise / Entreprises`)
   - Pour les **champs** : juste le label (ex: `Prénom`)
4. Les traductions pré-remplies sont des suggestions — modifie-les si besoin
5. Les lignes avec la colonne FR vide seront ignorées (pas de modification)
6. **Sauvegarde** en format TSV :
   - File → Save As → choisir "Text (Tab delimited) (*.txt)"
   - Renomme en `.tsv` si nécessaire

> 💡 **Astuce** : Les champs marqués "Système? = Oui" ne sont pas toujours modifiables.
> Concentre-toi sur les champs non-système.

## Étape 3 — Appliquer les traductions

```bash
node import_translations.js https://twenty-production-7352.up.railway.app "TA_CLE_API" twenty_metadata_fr.tsv
```

Le script :
1. Affiche un aperçu de toutes les modifications
2. Attend ta confirmation (Entrée pour continuer, Ctrl+C pour annuler)
3. Applique les renommages un par un via l'API Metadata GraphQL
4. Affiche un résumé (succès/erreurs)

## En cas de problème

Le backup JSON (`twenty_metadata_backup.json`) contient tous les labels originaux.
Tu peux restaurer manuellement dans Settings → Data model, ou adapter le script d'import
pour relire le JSON et remettre les labels anglais.

## Structure du TSV

| Colonne | Description |
|---------|-------------|
| Type | `OBJET` ou `champ` |
| Objet ID | UUID de l'objet Twenty |
| Champ ID | UUID du champ (vide pour les objets) |
| Nom technique | Nom interne (ne pas modifier) |
| Label actuel (EN) | Label affiché actuellement |
| Label FR (à modifier) | **← C'est ici que tu mets la traduction** |
| Description | Description du champ |
| Type de champ | TEXT, NUMBER, DATE, RELATION, etc. |
| Custom? | Oui = objet/champ personnalisé |
| Actif? | Oui = visible dans l'interface |
| Système? | Oui = champ système (souvent non modifiable) |
