# Rapport d'analyse des champs - Import AMIPEQ

## 📦 COMPANY (Entreprise)

### Champs utilisés dans l'import actuel :
```javascript
{
  name: "...",              // ✅ TEXT - OK
  domainName: null,         // ✅ LINKS - OK
  address: {                // ✅ ADDRESS - OK (type composé)
    addressStreet1: "...",
    addressStreet2: "...",
    addressCity: "...",
    addressPostcode: "...",
    addressCountry: "France"
  },
  phone: "...",             // ❌ N'EXISTE PAS
  numeroSociete: 123,       // ✅ NUMBER (custom) - OK
  typeClient: "...",        // ✅ SELECT (custom) - OK
  sousType: "...",          // ✅ SELECT (custom) - OK
  departement: "...",       // ✅ SELECT (custom) - OK
  departementNumero: "...", // ❌ MANQUE dans le schéma !
  prospecteur: "..."        // ❌ MANQUE dans le schéma !
}
```

### Champs manquants à créer dans Company :
- ❌ **departementNumero** (TEXT ou NUMBER) - N'existe pas, à créer
- ❌ **prospecteur** (SELECT ou TEXT) - N'existe pas, à créer

### Champs à RETIRER de l'import Company :
- ❌ **phone** - N'existe pas dans Company (les phones sont dans Person)

---

## 👤 PERSON (Contact)

### Champs utilisés dans l'import actuel :
```javascript
{
  name: {                   // ✅ FULL_NAME - OK (mais mauvaise structure !)
    firstName: "...",
    lastName: "..."
  },
  email: "...",             // ❌ Mauvaise structure (singulier)
  phone: "...",             // ❌ Mauvaise structure (singulier)
  companyId: "..."          // ✅ OK
}
```

### Structure CORRECTE pour Person :
```javascript
{
  name: {                   // ✅ FULL_NAME
    firstName: "...",
    lastName: "..."
  },
  emails: {                 // ✅ EMAILS (pluriel !)
    primaryEmail: "...",
    additionalEmails: []
  },
  phones: {                 // ✅ PHONES (pluriel !)
    primaryPhoneNumber: "...",
    primaryPhoneCountryCode: "+33",
    additionalPhones: []
  },
  companyId: "...",         // ✅ RELATION
  city: "...",              // ✅ TEXT (optionnel)
  jobTitle: "..."           // ✅ TEXT (optionnel)
}
```

---

## 💼 OPPORTUNITY (Opportunité)

### Champs customs disponibles :
- ✅ modalite (SELECT)
- ✅ prestation (MULTI_SELECT)
- ✅ dateDevis (DATE_TIME)
- ✅ normeOriginale (TEXT)
- ✅ naturePrestation (SELECT)
- ✅ numeroDevis (TEXT)
- ✅ anneeDevis (NUMBER)
- ✅ montantRemise (CURRENCY)
- ✅ tauxRemise (NUMBER)
- ✅ statutDevis (SELECT)

### Champs standards TWENTY :
- name (TEXT)
- amount (CURRENCY)
- closeDate (DATE_TIME)
- stage (SELECT)
- companyId (RELATION)
- pointOfContactId (RELATION)

---

## 🔧 ACTIONS REQUISES

### 1. Créer les champs manquants dans Company via l'API Metadata :

```javascript
// departementNumero
{
  name: 'departementNumero',
  label: 'N° Département',
  type: 'TEXT',
  objectMetadataId: COMPANY_ID,
  description: 'Numéro brut du département (ex: "13", "971")',
  isNullable: true
}

// prospecteur
{
  name: 'prospecteur',
  label: 'Prospecteur',
  type: 'SELECT',
  objectMetadataId: COMPANY_ID,
  description: 'Commercial ayant prospecté le client',
  isNullable: true,
  options: [
    { value: 'ALEX', label: 'ALEX', color: 'blue', position: 0 },
    { value: 'CL', label: 'CL', color: 'green', position: 1 }
  ]
}
```

### 2. Corriger le script import_clients.js :

**Company - RETIRER :**
```javascript
phone: companyData.telephone || null,  // ❌ À SUPPRIMER
```

**Person - CORRIGER :**
```javascript
// ❌ AVANT (incorrect)
{
  name: { firstName: "...", lastName: "..." },
  email: "...",
  phone: "..."
}

// ✅ APRÈS (correct)
{
  name: { firstName: "...", lastName: "..." },
  emails: {
    primaryEmail: personData.email || null,
    additionalEmails: []
  },
  phones: {
    primaryPhoneNumber: personData.telephone || null,
    primaryPhoneCountryCode: "+33",
    additionalPhones: []
  },
  city: personData.ville || null,
  companyId: companyId
}
```

---

## 📝 Résumé des corrections

1. ✅ **Company.address** - Structure correcte, à garder
2. ❌ **Company.phone** - À SUPPRIMER (n'existe pas)
3. ✅ **Company.name** - OK
4. 🔧 **Company.departementNumero** - À CRÉER
5. 🔧 **Company.prospecteur** - À CRÉER
6. ✅ **Person.name** - Structure correcte (FULL_NAME)
7. ❌ **Person.email** → **Person.emails** (objet avec primaryEmail)
8. ❌ **Person.phone** → **Person.phones** (objet avec primaryPhoneNumber)
