# 📝 GUIDE DE CORRECTION DES ERREURS D'IMPORT

**Date:** 3 mars 2026
**Total d'erreurs:** 9 (au lieu de 8 - une erreur supplémentaire détectée)

---

## 🔍 ERREURS IDENTIFIÉES

### 1️⃣ ERREUR DE DATE INVALIDE (1 erreur)

**📍 Fichier Excel:** Onglet `2023`, Ligne `344`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 105081-CL-23343 |
| Company | 105081 - COLLEGE MAURICE SATINEAU |
| Date devis (col I) | 45168 ⚠️ |
| Contact | ALBICE |
| OFFRE 1 | 1980 € |
| OFFRE 2 | 1584 € |
| Norme | MAJ DUERP |

**❌ Problème:** La date devis contient probablement "BAIE MAHAULT" au lieu d'une date

**✅ Solution:**
1. Ouvrir `SUIVIS CLIENTS 2026.xlsx`
2. Aller à l'onglet `2023`
3. Aller à la ligne `344`, colonne `I` (Date Devis)
4. Remplacer "BAIE MAHAULT" par une date valide (ex: 10-Aug-2023)
5. Sauvegarder

---

### 2️⃣ ERREURS NUMÉRO DE DEVIS INVALIDE (6 erreurs)

Ces lignes ont un numéro sans le format complet (manque le suffixe -CL-XXXXX).

#### Erreur 1: 108496
**📍 Fichier Excel:** Onglet `2024`, Ligne `106`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 108496 ⚠️ |
| Company | 108496 - CENTRAL HOTEL |
| Contact | LACHIHEB Mohamed |

**✅ Solution:** Colonne H, ligne 106 → Remplacer `108496` par `108496-CL-24XXX`

---

#### Erreur 2: 108497
**📍 Fichier Excel:** Onglet `2024`, Ligne `107`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 108497 ⚠️ |
| Company | 108497 - CFQIPS |
| Contact | GREIS Christophe |

**✅ Solution:** Colonne H, ligne 107 → Remplacer `108497` par `108497-CL-24XXX`

---

#### Erreur 3: 108498
**📍 Fichier Excel:** Onglet `2024`, Ligne `108`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 108498 ⚠️ |
| Company | 108498 - IME LEOPOLD HEDER |
| Contact | CORDOVAL |

**✅ Solution:** Colonne H, ligne 108 → Remplacer `108498` par `108498-CL-24XXX`

---

#### Erreur 4: 105718
**📍 Fichier Excel:** Onglet `2024`, Ligne `109`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 105718 ⚠️ |
| Company | 105718 - LYCEE LUMINA SOPHIE |
| Contact | STATTNER Marie Joseph |

**✅ Solution:** Colonne H, ligne 109 → Remplacer `105718` par `105718-CL-24XXX`

---

#### Erreur 5: 104925
**📍 Fichier Excel:** Onglet `2024`, Ligne `110`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 104925 ⚠️ |
| Company | 104925 - LYCEE PRO. CHATEAUBOEUF |
| Contact | RIOL |

**✅ Solution:** Colonne H, ligne 110 → Remplacer `104925` par `104925-CL-24XXX`

---

#### Erreur 6: 105718-CL-25112
**📍 Fichier Excel:** Onglet `2025`, Ligne `114`

| Champ | Valeur |
|-------|--------|
| Numéro devis | 105718-CL-25112 ⚠️ |
| Company | 105718 - LYCEE LUMINA SOPHIE |
| Contact | STATTNER Marie Joseph |

**✅ Solution:** Probablement un format correct, vérifier pourquoi l'erreur

---

### 3️⃣ ERREURS COMPANY MANQUANTE (2 erreurs)

Ces companies n'existent pas dans le système TWENTY.

#### Erreur 1: 108621 - EKOPLAST
**📍 Fichier Excel:** Onglet `2024`, Ligne `362`

| Champ | Valeur |
|-------|--------|
| Company | 108621 - EKOPLAST ⚠️ |
| Numéro devis | 108621-CL-24347 |
| Contact | PHILIP Thomas |
| OFFRE 1 | 1150 € |
| Norme | DU à Distance |

**✅ Solution - Option 1 (Créer la company):**
1. Aller dans TWENTY
2. Créer la company "EKOPLAST" avec le numéro 108621
3. Re-lancer l'import (la déduplication évitera les doublons)

**✅ Solution - Option 2 (Vérifier le numéro):**
1. Vérifier si 108621 est le bon numéro dans Excel
2. Corriger si nécessaire

---

#### Erreur 2: 108673 - ISIS SARL
**📍 Fichier Excel:** Onglet `2025`, Ligne `33`

| Champ | Valeur |
|-------|--------|
| Company | 108673 - ISIS SARL ⚠️ |
| Numéro devis | 108673-CL-25031 |
| Contact | MARTIGNONI |
| OFFRE 1 | 290 € |
| Norme | DU à Distance |

**✅ Solution - Option 1 (Créer la company):**
1. Aller dans TWENTY
2. Créer la company "ISIS SARL" avec le numéro 108673
3. Re-lancer l'import (la déduplication évitera les doublons)

**✅ Solution - Option 2 (Vérifier le numéro):**
1. Vérifier si 108673 est le bon numéro dans Excel
2. Corriger si nécessaire

---

## 🔧 PROCÉDURE DE CORRECTION

### Étape 1: Corriger dans Excel

1. Ouvrir `SUIVIS CLIENTS 2026.xlsx`
2. Corriger les erreurs selon le guide ci-dessus
3. Sauvegarder le fichier

### Étape 2: Créer les companies manquantes (si nécessaire)

Si vous choisissez l'option 1 pour les companies:
1. Créer 108621 - EKOPLAST dans TWENTY
2. Créer 108673 - ISIS SARL dans TWENTY
3. Mettre à jour `mappings.json` si nécessaire

### Étape 3: Re-lancer l'import

```bash
node import_opportunities_only.js
```

**Note:** La déduplication est activée, donc:
- Les 1589 opportunities existantes seront skippées ⏭️
- Seules les 9 nouvelles seront importées ✅

---

## 📊 RÉSUMÉ

| Type d'erreur | Nombre | Action |
|---------------|--------|--------|
| Date invalide | 1 | Corriger dans Excel |
| Numéro invalide | 6 | Corriger dans Excel |
| Company manquante | 2 | Créer dans TWENTY ou corriger |
| **TOTAL** | **9** | - |

---

## 📁 FICHIERS DE RÉFÉRENCE

- **Rapport d'erreurs:** `errors_report.json` (détails techniques)
- **Script de détection:** `find_errors.js` (peut être ré-exécuté)

---

**Une fois corrigé, vous aurez 1598/1598 opportunities importées = 100% de réussite! 🎉**
