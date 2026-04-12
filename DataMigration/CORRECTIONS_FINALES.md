# Corrections finales pour l'import

## ✅ Ce qui FONCTIONNE (testé avec succès)

### **COMPANY** :
```javascript
{
  name: "...",                    // ✅ OK
  address: {                       // ✅ OK
    addressStreet1: "...",
    addressStreet2: "...",
    addressCity: "...",
    addressPostcode: "...",
    addressCountry: "France"
  },
  numeroSociete: 123,             // ✅ OK
  typeClient: "...",              // ✅ OK
  sousType: "...",                // ✅ OK (peut être null)
  departement: "DEPT_XX_...",     // ✅ OK
  departementNumero: "XX",        // ✅ OK
  prospecteur: "ALEX"             // ✅ OK (ou "CL", ou null)
}
```

## ❌ À CORRIGER dans import_clients.js

### 1. **Company : RETIRER le champ phone**

**Ligne 377 à SUPPRIMER** :
```javascript
phone: companyData.telephone || null,  // ❌ À SUPPRIMER COMPLÈTEMENT
```

### 2. **Person : Corriger emails et phones**

**Lignes 423-433 - AVANT (incorrect)** :
```javascript
const body = {
  name: {
    firstName: firstName || contact,
    lastName: lastName || contact
  },
  email: personData.email || null,        // ❌ Mauvais format
  phone: personData.telephone || null,    // ❌ Mauvais format
  companyId
};
```

**APRÈS (correct)** :
```javascript
const body = {
  name: {
    firstName: firstName || contact,
    lastName: lastName || contact
  },
  emails: {                                // ✅ Pluriel + structure
    primaryEmail: personData.email || null,
    additionalEmails: []
  },
  phones: {                                // ✅ Pluriel + structure
    primaryPhoneNumber: personData.telephone || null,
    primaryPhoneCountryCode: "+33",
    additionalPhones: []
  },
  city: personData.ville || null,         // ✅ Optionnel
  companyId
};
```

## 📝 Changements exacts à faire

### Fichier: `/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/import_clients.js`

#### Correction 1 (ligne ~377) :
```diff
  const body = {
    name: companyData.client,
    domainName: null,
    address: {
      addressStreet1: companyData.adresse1 || null,
      addressStreet2: companyData.adresse2 || null,
      addressCity: companyData.ville || null,
      addressPostcode: companyData.cp || null,
      addressCountry: 'France'
    },
-   phone: companyData.telephone || null,
    numeroSociete: Number(companyData.numeroSociete),
```

#### Correction 2 (lignes ~423-435) :
```diff
  const body = {
    name: {
      firstName: firstName || contact,
      lastName: lastName || contact
    },
-   email: personData.email || null,
-   phone: personData.telephone || null,
+   emails: {
+     primaryEmail: personData.email || null,
+     additionalEmails: []
+   },
+   phones: {
+     primaryPhoneNumber: personData.telephone || null,
+     primaryPhoneCountryCode: "+33",
+     additionalPhones: []
+   },
+   city: personData.ville || null,
    companyId
  };
```

## ✅ Après ces corrections

L'import devrait fonctionner correctement et créer :
- ✅ **1262 companies** avec adresse complète, département, prospecteur
- ✅ **1331 persons** avec email et téléphone au bon format
- ✅ **1598 opportunities** avec prestations, modalité, nature

## 🧪 Test de validation

Après correction, tester avec :
```bash
node test_create_one.js     # Company OK ✅
# Créer test_create_person.js pour valider Person
node import_clients.js      # Import complet
```
