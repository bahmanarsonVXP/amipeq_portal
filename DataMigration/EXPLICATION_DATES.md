# Explication : Utilisation des dates dans l'import

## 📊 Colonnes du fichier Excel

| Colonne | Index | Nom dans le script | Usage |
|---------|-------|-------------------|-------|
| **B** | 1 | `date` | Date de **fallback** (utilisée si colonne I vide) |
| **I** | 8 | `dateDevis` | Date **principale** du devis |

## 🔄 Logique de lecture (ligne 250-257)

```javascript
date: row[1] || '',          // Colonne B - Date secondaire
dateDevis: row[8] || '',     // Colonne I - Date principale
```

## 📈 Utilisation pour le tri (lignes 293-294)

Lors du dédoublonnage, les données sont triées par date :

```javascript
const dateA = a.dateDevis || a.date || '2023-01-01';
const dateB = b.dateDevis || b.date || '2023-01-01';
```

**Priorité :**
1. ✅ `dateDevis` (colonne I) si présente
2. ✅ `date` (colonne B) si colonne I vide
3. ✅ `'2023-01-01'` si les deux sont vides

## 💼 Création de l'Opportunity (ligne 478)

```javascript
dateDevis: oppData.dateDevis || null
```

⚠️ **Important :** Seule `dateDevis` est envoyée à TWENTY, mais elle peut contenir :
- La valeur de la colonne I (si non vide)
- OU la valeur de la colonne B (si colonne I vide, grâce au tri)

## 🐛 Problème actuel

Les dates dans les colonnes sont au format Excel texte :
- `"1-Aug"` (1er Août)
- `"14-Jan"` (14 Janvier)
- `"19-Jun"` (19 Juin)

TWENTY attend le format ISO-8601 :
- `"2026-08-01T00:00:00Z"`
- `"2026-01-14T00:00:00Z"`
- `"2026-06-19T00:00:00Z"`

## 🔧 Solution

Ajouter une fonction de parsing avant l'envoi à TWENTY :

```javascript
function parseExcelDate(dateStr) {
  if (!dateStr) return null;

  // Si déjà au format ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr;
  }

  // Parser "1-Aug", "14-Jan", etc.
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  const match = dateStr.match(/^(\d+)-([A-Za-z]+)$/);
  if (match) {
    const [, day, monthStr] = match;
    const month = months[monthStr];
    if (month) {
      // Déterminer l'année selon le mois
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${month}-${day.padStart(2, '0')}T00:00:00Z`;
    }
  }

  return null;
}
```

Puis modifier ligne 478 :
```javascript
dateDevis: parseExcelDate(oppData.dateDevis) || null,
```

## 📝 Résumé

**Colonne B** = Date de fallback
**Colonne I** = Date principale
**Priorité** : I → B → null
**Problème** : Format texte Excel (`"1-Aug"`)
**Solution** : Parser vers ISO-8601 (`"2026-08-01T00:00:00Z"`)
