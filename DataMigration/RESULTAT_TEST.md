# Résultat du test d'import (10 companies)

## ✅ Réussites

- **10 companies créées** avec succès
  - ✅ Nom
  - ✅ Adresse complète (rue, ville, CP, pays)
  - ✅ N° Société
  - ✅ Type client
  - ✅ Département + N° département
  - ✅ Prospecteur

- **8 persons créées** (sur 14 tentatives)
  - ✅ Nom (firstName/lastName)
  - ✅ Email (format correct)
  - ✅ Téléphone avec code pays FR
  - ✅ Ville
  - ✅ Lien vers company

## ❌ Problèmes détectés

### 1. Persons (6 doublons + 1 erreur de format)

**Doublons** (6 entries) :
- Erreur : `"A duplicate entry was detected"`
- Cause : Même person dans plusieurs lignes Excel
- Impact : Mineur - person créée une seule fois

**Email mal formaté** (1 entry) :
```
Email: "cecile.coutand@ac-guyane.fr / adelaide.tine@ac-guyane.fr"
Erreur: Invalid string value for email field
```
- Cause : Cellule Excel contient plusieurs emails séparés par `/`
- **Solution requise** : Prendre seulement le premier email

### 2. Opportunities (15 erreurs sur 15)

**Format de date invalide** :
```
Date: "1-Aug", "1-Feb", "14-Jan", "19-Jun"
Erreur: Invalid value for date-time field "dateDevis"
Format attendu: 'YYYY-MM-DDTHH:mm:ssZ'
```
- Cause : Excel exporte les dates au format texte court
- **Solution requise** : Parser et convertir au format ISO-8601

## 🔧 Corrections nécessaires

### 1. Parser les emails multiples

**Fichier** : `import_clients.js` ligne ~421

```javascript
// AVANT
emails: {
  primaryEmail: personData.email || null,
  additionalEmails: []
}

// APRÈS
emails: {
  primaryEmail: personData.email ? personData.email.split('/')[0].trim() : null,
  additionalEmails: []
}
```

### 2. Parser les dates du format Excel

**Fichier** : `import_clients.js` - fonction `createOpportunity`

Ajouter une fonction de parsing de dates :

```javascript
function parseExcelDate(dateStr) {
  if (!dateStr) return null;

  // Si déjà au format ISO, retourner tel quel
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr;
  }

  // Parser format "1-Aug", "14-Jan", etc.
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
      const year = new Date().getFullYear(); // Année courante par défaut
      return `${year}-${month}-${day.padStart(2, '0')}T00:00:00Z`;
    }
  }

  return null;
}
```

Puis utiliser :
```javascript
dateDevis: parseExcelDate(oppData.dateDevis),
```

## 📊 Statistiques finales

```
Créations réussies : 18 / 39 (46%)
  - Companies: 10 / 10 (100%) ✅
  - Persons:    8 / 14 (57%)  ⚠️
  - Opportunities: 0 / 15 (0%) ❌

Erreurs :
  - Doublons: 6
  - Format email: 1
  - Format date: 15
```

## ✅ Prochaines étapes

1. Appliquer les corrections de parsing (email + date)
2. Relancer le test avec 10 companies
3. Vérifier 100% de succès
4. Lancer l'import complet (1262 companies)
