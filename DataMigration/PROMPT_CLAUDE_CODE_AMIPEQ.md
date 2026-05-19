# PROMPT CLAUDE CODE — AMIPEQ Twenty CRM Setup

## CONTEXTE

Tu dois configurer une instance Twenty CRM pour AMIPEQ (prévention des risques professionnels).
Instance Twenty : https://twenty-production-7352.up.railway.app
Clé API : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOGJkMWI5Zi00ZTEwLTQzYmItYTNmNi1kZDYyYzBiY2JhMmQiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMjhiZDFiOWYtNGUxMC00M2JiLWEzZjYtZGQ2MmMwYmNiYTJkIiwiaWF0IjoxNzcyMjg4OTg4LCJleHAiOjE3NzQ4NzczODcsImp0aSI6IjgyZmU4NjAxLTQ2NGQtNGFjMC04YWFmLWEwOWUzNDIxY2ZkMiJ9.bGDc9axBykXC2WJfzDRbqtieGKjXkjwBV5hXl7FvhHo

API endpoints :
- Metadata GraphQL : POST {BASE_URL}/metadata (créer/modifier objets et champs)
- Core GraphQL : POST {BASE_URL}/graphql (CRUD sur les données)
- REST : GET/POST {BASE_URL}/rest/{objectPluralName}

Fichier source : SUIVIS_CLIENTS_2026.xlsx (fourni, même répertoire)
Années à importer : 2023, 2024, 2025, 2026

## PHASE 1 — CRÉER/MODIFIER LE SCHÉMA (champs personnalisés)

Utilise l'API Metadata GraphQL pour ajouter des champs aux objets standard.
IMPORTANT : avant de créer un champ, vérifie s'il existe déjà (query objects + fields).

### 1.1 Champs à ajouter sur Company

```
Nom technique         Type           Requis   Valeurs SELECT
─────────────────────────────────────────────────────────────
numeroSociete         TEXT           Oui      —
typeClient            SELECT         Oui      Établissement scolaire / Mairie-Collectivité / Entreprise TPE-PME / Autre
sousType              SELECT         Non      Collège / Lycée / École / Mairie / Communauté de communes / EHPAD / Association / Autre
prospecteur           SELECT         Non      ALEX / CL
departement           SELECT         Oui      Voir liste complète ci-dessous (01 à 95 + 971/972/973/974)
departementNumero     TEXT           Oui      — (ex: "13", "971" — extrait automatiquement du CP, sert de clé pour filtres et vues)
nombreSites           NUMBER         Non      —
activite              TEXT           Non      —
tarifApplicable       TEXT           Non      —
statutClient          SELECT         Non      Prospect / Client actif / Client inactif / Perdu
nombreEleves          NUMBER         Non      —
capacite              NUMBER         Non      —
restaurantScolaire    BOOLEAN        Non      —
internat              SELECT         Non      Oui / Non / Petit établissement
installationsSportives TEXT          Non      —
ateliers              BOOLEAN        Non      —
batiments             TEXT           Non      —
nombreHabitants       NUMBER         Non      —
nombreSalaries        NUMBER         Non      —
equipements           TEXT           Non      — (liste libre, Twenty ne supporte pas nativement MULTI_SELECT sur custom fields)
```

#### Options du champ SELECT "departement"

Créer les options SELECT pour les 97 départements retrouvés dans les données + DOM-TOM.
Format de la value : "{numero}_{NOM_SANS_ACCENTS}" — Format du label : "{numero} - {Nom}"

Départements prioritaires (présents dans les données 2023-2026) :
```
01-Ain, 02-Aisne, 03-Allier, 04-Alpes-de-Haute-Provence, 05-Hautes-Alpes, 06-Alpes-Maritimes,
07-Ardèche, 08-Ardennes, 09-Ariège, 10-Aube, 11-Aude, 12-Aveyron,
13-Bouches-du-Rhône, 14-Calvados, 15-Cantal, 16-Charente, 17-Charente-Maritime, 18-Cher,
19-Corrèze, 2A-Corse-du-Sud, 2B-Haute-Corse, 21-Côte-d'Or, 22-Côtes-d'Armor, 23-Creuse,
24-Dordogne, 25-Doubs, 26-Drôme, 27-Eure, 28-Eure-et-Loir, 29-Finistère,
30-Gard, 31-Haute-Garonne, 32-Gers, 33-Gironde, 34-Hérault, 35-Ille-et-Vilaine,
36-Indre, 37-Indre-et-Loire, 38-Isère, 39-Jura, 40-Landes, 41-Loir-et-Cher,
42-Loire, 43-Haute-Loire, 44-Loire-Atlantique, 45-Loiret, 46-Lot, 47-Lot-et-Garonne,
48-Lozère, 49-Maine-et-Loire, 50-Manche, 51-Marne, 52-Haute-Marne, 53-Mayenne,
54-Meurthe-et-Moselle, 55-Meuse, 56-Morbihan, 57-Moselle, 58-Nièvre, 59-Nord,
60-Oise, 61-Orne, 62-Pas-de-Calais, 63-Puy-de-Dôme, 64-Pyrénées-Atlantiques, 65-Hautes-Pyrénées,
66-Pyrénées-Orientales, 67-Bas-Rhin, 68-Haut-Rhin, 69-Rhône, 70-Haute-Saône, 71-Saône-et-Loire,
72-Sarthe, 73-Savoie, 74-Haute-Savoie, 75-Paris, 76-Seine-Maritime, 77-Seine-et-Marne,
78-Yvelines, 79-Deux-Sèvres, 80-Somme, 81-Tarn, 82-Tarn-et-Garonne, 83-Var,
84-Vaucluse, 85-Vendée, 86-Vienne, 87-Haute-Vienne, 88-Vosges, 89-Yonne,
90-Territoire de Belfort, 91-Essonne, 92-Hauts-de-Seine, 93-Seine-Saint-Denis, 94-Val-de-Marne, 95-Val-d'Oise,
971-Guadeloupe, 972-Martinique, 973-Guyane, 974-La Réunion
```

### 1.2 Champs à ajouter sur Opportunity

```
Nom technique         Type           Requis   Valeurs SELECT
─────────────────────────────────────────────────────────────
numeroDevis           TEXT           Oui      —
dateDevis             DATE           Oui      —
prestation            MULTI_SELECT   Oui      DUERP / PPMS / RPS / PSE / COVID / RGPD / Autre
naturePrestation      SELECT         Non      Création / Mise à jour / Contrat MAJ
modalite              SELECT         Non      Sur site / À distance / Sur site ou à distance
montantRemise         CURRENCY       Non      —
tauxRemise            NUMBER         Non      —
statutDevis           SELECT         Oui      Gagné / Refusé / En attente
dateRelance           DATE           Non      —
dateEnvoiDocs         DATE           Non      —
anneeDevis            NUMBER         Non      —
normeOriginale        TEXT           Non      — (valeur brute Excel conservée pour traçabilité)
```

### 1.3 Mutation GraphQL pour créer un champ

Exemple de mutation (adapter pour chaque champ) :

```graphql
mutation {
  createOneField(input: {
    field: {
      name: "numeroSociete"
      label: "N° Société"
      type: TEXT
      objectMetadataId: "<company_object_id>"
      isNullable: false
      description: "Identifiant unique historique du client"
    }
  }) {
    id name label type
  }
}
```

Pour les champs SELECT, après création du champ, ajouter les options via :
```graphql
mutation {
  createOneFieldMetadataItem(input: {
    field: {
      name: "typeClient"
      label: "Type de client"
      type: SELECT
      objectMetadataId: "<company_object_id>"
      defaultValue: "'AUTRE'"
      options: [
        { value: "ETABLISSEMENT_SCOLAIRE", label: "Établissement scolaire", color: "blue", position: 0 },
        { value: "MAIRIE_COLLECTIVITE", label: "Mairie-Collectivité", color: "green", position: 1 },
        { value: "ENTREPRISE_TPE_PME", label: "Entreprise TPE-PME", color: "orange", position: 2 },
        { value: "AUTRE", label: "Autre", color: "gray", position: 3 }
      ]
    }
  }) {
    id
  }
}
```

ATTENTION : l'API Metadata de Twenty évolue. Commence par introspecter le schéma GraphQL metadata pour connaître les mutations exactes disponibles :
```graphql
{
  __schema {
    mutationType {
      fields { name args { name type { name kind ofType { name } } } }
    }
  }
}
```

## PHASE 2 — IMPORTER LES DONNÉES DEPUIS EXCEL

### RÈGLES DE DÉDOUBLONNAGE (CRITIQUE)

Le fichier Excel contient 1 598 lignes (2023-2026) mais beaucoup de lignes concernent le même client.
Le même client apparaît N fois (1 ligne par devis). Exemple : COLLEGE JEAN JAURES = 3 lignes avec les mêmes coordonnées.

Avant tout import, construire 3 structures en mémoire :

```
1. COMPANIES : Map<N°Société → { données les plus récentes }>
   - Clé de dédoublonnage : colonne C "N° Sté"
   - En cas de doublons : garder les coordonnées (adresse, tél, email) de la DERNIÈRE ligne chronologiquement
   - Résultat attendu : 1 598 lignes → ~1 265 Companies uniques

2. PERSONS : Map<"N°Société|NomContact" → { civilité, nom, prénom }>
   - Clé de dédoublonnage : couple (col C "N° Sté" + col F "CONTACT")
   - Un même client peut avoir plusieurs contacts différents au fil des années
   - Résultat attendu : ~1 329 Persons uniques

3. OPPORTUNITIES : PAS de dédoublonnage — chaque ligne Excel = 1 Opportunity unique
   - Chaque ligne a un N° Devis unique (col H)
   - Résultat attendu : 1 598 Opportunities
```

Ordre d'import obligatoire : Companies → Persons → Opportunities (pour les relations/liens).
Garder les mappings en mémoire ET sur disque (mappings.json) pour :
- Lier les Persons à leur Company
- Lier les Opportunities à leur Company et Person
- Pouvoir relancer l'import sans créer de doublons

### 2.1 Lire le fichier Excel

Utilise la bibliothèque `xlsx` (npm) ou `openpyxl` (Python) pour lire SUIVIS_CLIENTS_2026.xlsx.
Onglets à traiter : 2023, 2024, 2025, 2026.

Structure des colonnes (row 1 = header) :
```
A: Prosp          (prospecteur)
B: DATE           (date)
C: N° Sté         (numéro société — clé de dédoublonnage Company)
D: CLIENTS        (nom du client)
E: Titre          (civilité : M. / Mme)
F: CONTACT        (nom du contact)
G: CIAL           (commercial)
H: N° DEVIS       (numéro de devis)
I: date devis
J: OFFRE N° 1     (montant tarif)
K: OFFRE N° 2     (montant remisé, peut être vide)
L: NORME          (prestation — à parser, voir section 2.3)
Q: Adresse Ligne 1
R: Adresse Ligne 2
S: CP
T: VILLE
U: TELEPHONE
V: RELANCE (téléphone secondaire)
W: E-mail
X: Date Docs Envoyés
```

### 2.2 Lire les couleurs de fond pour le statut

Le statut du devis est encodé dans la couleur de fond des cellules :
- Vert #92D050 → "Gagné"
- Gris #A5A5A5 ou #BFBFBF → "Refusé"  
- Blanc / pas de couleur / #000000 → "En attente"

Avec openpyxl (Python) — NE PAS utiliser data_only=True sinon les styles sont perdus :
```python
wb = openpyxl.load_workbook('SUIVIS_CLIENTS_2026.xlsx')  # pas data_only!
cell = ws.cell(row=2, column=1)
rgb = str(cell.fill.fgColor.rgb) if cell.fill.fgColor else ''
if rgb == 'FF92D050':
    statut = 'Gagné'
elif rgb in ('FFA5A5A5', 'FFBFBFBF'):
    statut = 'Refusé'
else:
    statut = 'En attente'
```

### 2.3 Parser la colonne NORME (prestation)

Décomposer chaque valeur NORME en 3 champs : prestation[], nature, modalité.

Algorithme de parsing :

```python
import re

def parse_norme(raw):
    s = raw.strip()
    
    # 1. MODALITÉ
    modalite = None
    modal_patterns = [
        (r'(?i)\bà distance\b', 'À distance'),
        (r'(?i)\ba distance\b', 'À distance'),
        (r'(?i)\bdématérialisé[e]?\b', 'À distance'),
        (r'(?i)\bdistanciel\b', 'À distance'),
        (r'(?i)\bdistance\b', 'À distance'),
        (r'(?i)\bsur site\b', 'Sur site'),
        (r'(?i)\bprésentiel\b', 'Sur site'),
    ]
    for pattern, modal in modal_patterns:
        if re.search(pattern, s):
            modalite = modal
            s = re.sub(pattern, '', s).strip()
            break
    if re.search(r'(?i)sur site ou', s):
        modalite = 'Sur site ou à distance'
        s = re.sub(r'(?i)sur site ou', '', s).strip()
    
    # 2. NATURE
    nature = 'Création'
    if re.search(r'(?i)\bcontrat\s+maj\b', s):
        nature = 'Contrat MAJ'
        s = re.sub(r'(?i)\bcontrat\s+maj\b', '', s).strip()
    elif re.search(r'(?i)\bmaj\b', s):
        nature = 'Mise à jour'
        s = re.sub(r'(?i)\bmaj\b', '', s).strip()
    
    # 3. PRESTATIONS
    s_upper = s.upper()
    for noise in ['+ CLASSEUR', 'CLASSEUR', 'ET/OU', 'SEUL', 'SS ', 'DEVIS ', 'SIGNES', 'SIGNE', 'CLIENT RÉCENT', 'CLIENT']:
        s_upper = s_upper.replace(noise, '')
    s_upper = re.sub(r'[+/,\-]', ' ', s_upper)
    s_upper = ' '.join(s_upper.split())
    
    prestations = set()
    full_maps = {
        'DOCUMENT UNIQUE': 'DUERP', 'DUERP': 'DUERP', 'DUER': 'DUERP', 
        'DUEP': 'DUERP', 'DU': 'DUERP',
        'PPMS': 'PPMS', 'PMMS': 'PPMS',
        'RPS': 'RPS', 'ENTRETIENS INDIVIDUELS': 'RPS', 'ENTRETIENS': 'RPS',
        'PSE': 'PSE', 'PLAN BLANC ET BLEU': 'PSE',
        'COVID': 'COVID', 'COVID 19': 'COVID',
        'RGPD': 'RGPD',
    }
    temp = s_upper
    for expr in sorted(full_maps.keys(), key=len, reverse=True):
        if expr in temp:
            prestations.add(full_maps[expr])
            temp = temp.replace(expr, ' ', 1)
    if not prestations:
        prestations.add('DUERP')
    
    return sorted(prestations), nature, modalite
```

Couverture validée : 99.6% des 1 598 devis 2023-2026.

### 2.4 Ordre d'import

IMPORTANT : respecter cet ordre pour les relations.

#### Étape 1 : Companies (dédoublonnées par N° Société)

Pour chaque N° Société unique :
- Prendre les données de la DERNIÈRE ligne (la plus récente) pour les coordonnées
- Extraire le département depuis le Code Postal (col S) :
  ```python
  def extract_departement(cp_raw):
      cp = str(int(float(cp_raw))).zfill(5)
      if cp[:3] in ('971', '972', '973', '974'):
          return cp[:3]  # DOM-TOM : 971=Guadeloupe, 972=Martinique, 973=Guyane, 974=Réunion
      elif cp[:2] == '20':
          return '2A' if int(cp) < 20200 else '2B'  # Corse
      else:
          return cp[:2]  # Métropole
  ```
  Créer DEUX champs : departement (SELECT avec label lisible "13 - Bouches-du-Rhône") et departementNumero (TEXT "13" brut pour filtres rapides).
  Les clients AMIPEQ couvrent 97 départements sur 2023-2026 dont les DOM-TOM (971 Guadeloupe=111, 972 Martinique=97, 973 Guyane=45, 974 Réunion=2).
- Classifier le type automatiquement par mots-clés dans le nom :
  - Contient COLLEGE, LYCEE, LYCÉE, ECOLE, ÉCOLE, GROUPE SCOLAIRE → "Établissement scolaire"
  - Contient MAIRIE, COMMUNAUT, AGGLO, CC DE, CC DU → "Mairie-Collectivité"
  - Sinon → "Entreprise TPE-PME"
- Sous-type par mot-clé :
  - COLLEGE → "Collège", LYCEE/LYCÉE → "Lycée", ECOLE/ÉCOLE → "École"
  - MAIRIE → "Mairie", COMMUNAUT/AGGLO → "Communauté de communes"
  - EHPAD → "EHPAD"
- statutClient : si au moins 1 devis Gagné en 2025/2026 → "Client actif", sinon si au moins 1 devis en 2023-2026 → "Prospect", sinon "Client inactif"

Créer via API Core :
```
POST {BASE_URL}/rest/companies
{
  "name": "COLLEGE RENE SEYSSAUD",
  "address": { "addressStreet1": "BOULEVARD JOLIOT CURIE", "addressCity": "SAINT CHAMAS", "addressPostcode": "13250" },
  "phones": { "primaryPhoneNumber": "04 90 50 92 09" },
  "emails": { "primaryEmail": "ges.clg.seyssaud@ac-aix-marseille.fr" },
  "numeroSociete": "108846",
  "typeClient": "ETABLISSEMENT_SCOLAIRE",
  "sousType": "COLLEGE",
  "departement": "13_BOUCHES_DU_RHONE",
  "departementNumero": "13",
  "prospecteur": "ALEX",
  "statutClient": "CLIENT_ACTIF"
}
```

Garder un mapping N°Société → Company ID pour l'étape suivante.

#### Étape 2 : Persons (dédoublonnées par nom + Company)

Pour chaque combinaison unique (N°Société, Nom contact) :
- Extraire civilité (col E) + nom (col F)
- Parser le nom : "DECEBAL Pascal" → firstName: "Pascal", lastName: "DECEBAL"
  Attention aux formats variés : "Prénom NOM", "NOM Prénom", "NOM" seul
- Rattacher à la Company via le mapping de l'étape 1

Garder un mapping (N°Société + Nom contact) → Person ID.

#### Étape 3 : Opportunities (1 par ligne Excel)

Pour chaque ligne des onglets 2023-2026 :
- Lier à Company via N°Société
- Lier à Person via (N°Société + Contact)
- Parser la NORME avec parse_norme()
- Lire la couleur de fond pour le statut
- Calculer le taux de remise : si Offre2 et Offre1 → round((1 - Offre2/Offre1) * 100)
- Conserver la valeur NORME brute dans normeOriginale

```
POST {BASE_URL}/rest/opportunities
{
  "name": "108846-CL-26001",
  "companyId": "<company_id>",
  "pointOfContactId": "<person_id>",
  "amount": { "amountMicros": 1280000000, "currencyCode": "EUR" },
  "numeroDevis": "108846-CL-26001",
  "dateDevis": "2026-01-05",
  "prestation": ["DUERP", "PPMS"],
  "naturePrestation": "CREATION",
  "modalite": null,
  "montantRemise": { "amountMicros": 1024000000, "currencyCode": "EUR" },
  "tauxRemise": 20,
  "statutDevis": "GAGNE",
  "anneeDevis": 2026,
  "normeOriginale": "DU + PPMS"
}
```

### 2.5 Gestion des erreurs

- Utiliser un rate limit de 100ms entre chaque appel API
- Logger chaque création (succès/échec) dans un fichier import_log.json
- En cas d'erreur, continuer avec les suivants et logger l'erreur
- À la fin, afficher un résumé : X Companies créées, Y Persons, Z Opportunities, N erreurs
- Sauvegarder les mappings (N°Société → Company ID, etc.) dans un fichier mappings.json pour pouvoir relancer l'import en cas d'interruption

## PHASE 3 — NOTES ET TÂCHES

Cette phase est volontairement simplifiée. Les fiches de prospection individuelles (fichiers Excel par client contenant : nombre d'élèves, installations sportives, internat, restaurant scolaire, historique des relances, etc.) ne sont pas encore toutes disponibles. Seules 3 fiches existent pour le moment.

L'import des données complémentaires (champs spécifiques établissement scolaire et mairie sur Company + Notes de compte-rendu commercial) se fera dans un lot ultérieur quand les fiches individuelles seront rassemblées.

Pour l'instant, créer une Note par Opportunity importée avec le résumé :
```
POST {BASE_URL}/rest/notes
{
  "title": "Import Excel - Devis 108846-CL-26001",
  "body": "Importé depuis SUIVIS_CLIENTS_2026.xlsx\nAnnée: 2026\nNorme originale: DU + PPMS\nStatut: Gagné",
  "noteTargets": [{ "companyId": "<company_id>" }]
}
```

## INSTRUCTIONS D'EXÉCUTION

1. Commence par la Phase 1 : introspecte le schéma metadata, puis crée les champs manquants
2. Vérifie que les champs sont bien créés en relisant le schéma
3. Passe à la Phase 2 : lis l'Excel, dédoublonne, puis importe dans l'ordre Companies → Persons → Opportunities
4. Affiche un résumé final avec les statistiques d'import

Travaille en Node.js (tu as accès à npm). Installe les dépendances nécessaires (xlsx, node-fetch, etc.).
Écris le code dans des fichiers séparés et exécute-les séquentiellement.
Si une API ne fonctionne pas comme attendu, introspecte le schéma GraphQL pour trouver la bonne mutation/query.
