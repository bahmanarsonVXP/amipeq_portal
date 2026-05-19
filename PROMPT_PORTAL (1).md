# AMIPEQ Portal - Instructions de Développement

## Contexte Projet

AMIPEQ est une société spécialisée dans la prévention des risques professionnels (DUERP, PPMS, RPS). Ce portail est l'interface métier simplifiée pour les admins (Alexandra, Christophe) et futurs franchisés.

**Principe architectural** : Twenty = base de données CRM, Portal = interface métier simplifiée.

### Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Cloudflare Pages  │    │     Cloudflare Workers      │ │
│  │   (Frontend Next.js)│───▶│     (Façade API / BFF)      │ │
│  │   Static Export     │    │         Hono.js             │ │
│  └─────────────────────┘    └──────────────┬──────────────┘ │
└────────────────────────────────────────────┼────────────────┘
                                             │ HTTPS
                                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        RAILWAY                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │     Twenty CRM      │    │      Services Métier        │ │
│  │   GraphQL API       │    │  - Metabase (BI)            │ │
│  │   PostgreSQL        │    │  - Auth Service (si besoin) │ │
│  └─────────────────────┘    │  - Doc Gen (futur)          │ │
│                             └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Stack Technique

| Couche | Technologie | Hébergement |
|--------|-------------|-------------|
| Frontend | Next.js 14 (Static Export) + Tailwind | Cloudflare Pages |
| Façade API | Hono.js (TypeScript) | Cloudflare Workers |
| Auth | JWT (généré par Worker) | Cloudflare Workers |
| CRM Backend | Twenty (GraphQL + REST) | Railway |
| BI | Metabase (iframe JWT embed) | Railway |
| Base de données | PostgreSQL (via Twenty) | Railway |

---

## Charte Graphique AMIPEQ

### Couleurs

```css
/* Primary - Action principale */
--primary-500: #f8b829;  /* Boutons CTA, nav active, accents */
--primary-600: #e5a520;  /* Hover */

/* Texte */
--gray-900: #111827;  /* Principal */
--gray-600: #4b5563;  /* Secondaire / descriptif */
--gray-500: #6b7280;  /* Aide discrète */

/* Fonds */
--white: #ffffff;     /* App / cartes */
--gray-50: #f9fafb;   /* Sections secondaires */
--gray-200: #e5e7eb;  /* Bordures standard */
--gray-300: #d1d5db;  /* Inputs neutres */

/* Statuts (usage fonctionnel uniquement) */
--success-500: #22c55e;  /* Gagné */
--success-50: #f0fdf4;   /* Fond succès */
--warning-500: #f59e0b;  /* En attente */
--warning-50: #fffbeb;   /* Fond warning */
--danger-500: #ef4444;   /* Refusé / Retard */
--danger-50: #fef2f2;    /* Fond erreur */
--red-300: #fca5a5;      /* Bordure erreur */
```

### Typographie

```css
/* Police unique */
font-family: 'Montserrat', sans-serif;

/* Poids */
font-weight: 700;  /* Titres h1, h2 */
font-weight: 600;  /* Libellés, nav active, boutons */
font-weight: 500;  /* Nav inactive, labels */
font-weight: 400;  /* Texte courant */
```

### Règles UI

1. **Un seul CTA principal par écran** en `primary-500`
2. **Rouge/vert/orange réservés aux statuts**, jamais décoratif
3. **Focus visible obligatoire** : `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`
4. **Bordures arrondies** : `rounded-lg` (8px) pour cards/inputs, `rounded-xl` (12px) pour containers
5. **Ombres légères** : `shadow-sm` sur cards, pas d'ombres lourdes

---

## Structure du Projet

```
amipeq-portal/
├── CLAUDE.md                    # Instructions Claude Code
├── PROMPT_PORTAL.md             # Ce fichier
├── SKILLS.md                    # Patterns et composants
│
├── frontend/                    # === CLOUDFLARE PAGES ===
│   ├── package.json
│   ├── next.config.js           # output: 'export' (static)
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── wrangler.toml            # Config Cloudflare Pages
│   ├── public/
│   │   └── fonts/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx       # Root layout (Montserrat)
│       │   ├── globals.css      # Tailwind + CSS vars
│       │   ├── page.tsx         # Redirect vers /dashboard
│       │   ├── login/
│       │   │   └── page.tsx     # Page connexion
│       │   └── (portal)/
│       │       ├── layout.tsx   # Layout Sidebar + Header
│       │       ├── dashboard/
│       │       │   └── page.tsx
│       │       ├── opportunities/
│       │       │   └── page.tsx
│       │       ├── clients/
│       │       │   ├── page.tsx
│       │       │   └── [id]/
│       │       │       └── page.tsx
│       │       ├── relances/
│       │       │   └── page.tsx
│       │       └── stats/
│       │           └── page.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   └── UserMenu.tsx
│       │   ├── ui/
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Select.tsx
│       │   │   └── Table.tsx
│       │   ├── dashboard/
│       │   │   ├── KPICard.tsx
│       │   │   ├── AlertBanner.tsx
│       │   │   └── OpportunityList.tsx
│       │   ├── opportunities/
│       │   │   ├── OpportunityTable.tsx
│       │   │   └── OpportunityFilters.tsx
│       │   ├── clients/
│       │   │   ├── ClientTable.tsx
│       │   │   └── ClientSlideOver.tsx
│       │   └── relances/
│       │       └── RelanceCard.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useOpportunities.ts
│       │   ├── useCompanies.ts
│       │   └── useRelances.ts
│       ├── lib/
│       │   ├── api.ts           # Client fetch vers Worker
│       │   ├── utils.ts         # cn(), formatters
│       │   └── auth.ts          # Gestion token JWT
│       └── types/
│           └── index.ts         # Types partagés
│
├── api/                         # === CLOUDFLARE WORKERS ===
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml            # Config Workers + secrets
│   └── src/
│       ├── index.ts             # Entry point Hono
│       ├── routes/
│       │   ├── auth.ts          # POST /api/auth/login
│       │   ├── companies.ts     # GET /api/companies
│       │   ├── opportunities.ts # GET/POST /api/opportunities
│       │   ├── persons.ts       # GET /api/persons
│       │   ├── relances.ts      # GET /api/relances
│       │   └── stats.ts         # GET /api/stats/dashboard
│       ├── middleware/
│       │   ├── auth.ts          # JWT validation
│       │   └── cors.ts          # CORS pour frontend
│       └── lib/
│           ├── twenty.ts        # Client GraphQL Twenty
│           ├── jwt.ts           # Sign/verify JWT
│           └── queries.ts       # Requêtes GraphQL
│
└── maquettes/                   # Maquettes HTML référence
    ├── amipeq_v2_dashboard.html
    ├── amipeq_v2_metabase.html
    └── amipeq_v2_clients.html
```

---

## Pages à Développer

### 1. Dashboard (`/dashboard`)

**Composants :**
- 4 KPI cards : CA mois, Devis en attente, Taux conversion, Clients actifs
- Bannière alerte rouge si relances en retard
- Liste des 5 dernières opportunités

**Données :**
```typescript
interface DashboardData {
  kpis: {
    caMois: number;
    caVariation: number;
    devisEnAttente: number;
    potentielDevis: number;
    tauxConversion: number;
    conversionVariation: number;
    clientsActifs: number;
    nouveauxClients: number;
  };
  relancesEnRetard: number;
  dernieresOpportunites: Opportunity[];
}
```

### 2. Opportunités (`/opportunities`)

**Composants :**
- Barre de filtres : recherche, statut (select), prestation (select)
- Tableau : Client, Prestation, Montant, Statut, Actions
- Actions rapides : Marquer gagné, Relancer

### 3. Clients (`/clients`)

**Composants :**
- Recherche client
- Tableau : Client (N°), Type, Ville, Statut, CA 2026, Actions
- Slide-over avec fiche Twenty au clic

### 4. Relances (`/relances`)

**Composants :**
- Cards triées par urgence (retard → aujourd'hui → à venir)
- Bordure rouge si retard, orange si aujourd'hui
- Actions : Appeler (CTA), Email, Reporter, Marquer gagné

### 5. Statistiques (`/stats`)

**Composants :**
- Select dashboard Metabase
- Iframe Metabase (placeholder en dev)
- Footer avec export PDF / actualiser

---

## Types TypeScript

```typescript
// /src/types/index.ts

export type ClientType = 'ETABLISSEMENT_SCOLAIRE' | 'MAIRIE_COLLECTIVITE' | 'ENTREPRISE_TPE_PME' | 'AUTRE';
export type ClientStatus = 'PROSPECT' | 'CLIENT_ACTIF' | 'CLIENT_INACTIF' | 'PERDU';
export type QuoteStatus = 'GAGNE' | 'REFUSE' | 'EN_ATTENTE';
export type Prestation = 'DUERP' | 'PPMS' | 'RPS' | 'PSE' | 'COVID' | 'RGPD' | 'AUTRE';
export type Nature = 'CREATION' | 'MAJ' | 'CONTRAT_MAJ';
export type Modalite = 'SUR_SITE' | 'A_DISTANCE' | 'SUR_SITE_OU_DISTANCE';

export interface Company {
  id: string;
  name: string;
  numeroSociete: string;
  typeClient: ClientType;
  sousType?: string;
  statutClient: ClientStatus;
  address: {
    street1?: string;
    street2?: string;
    city?: string;
    postcode?: string;
  };
  phone?: string;
  email?: string;
  prospecteur?: 'ALEX' | 'CL';
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId: string;
}

export interface Opportunity {
  id: string;
  name: string;
  companyId: string;
  company?: Company;
  personId?: string;
  person?: Person;
  numeroDevis: string;
  dateDevis: string;
  prestation: Prestation[];
  naturePrestation?: Nature;
  modalite?: Modalite;
  amount: number;
  montantRemise?: number;
  tauxRemise?: number;
  statutDevis: QuoteStatus;
  dateRelance?: string;
  anneeDevis: number;
}

export interface Relance {
  opportunity: Opportunity;
  dateRelance: string;
  joursRetard: number;
  status: 'EN_RETARD' | 'AUJOURD_HUI' | 'A_VENIR';
}
```

---

## API Façade (Cloudflare Workers)

### Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Authentification, retourne JWT |
| GET | `/api/auth/me` | Infos utilisateur courant |
| GET | `/api/companies` | Liste des clients |
| GET | `/api/companies/:id` | Détail d'un client |
| GET | `/api/opportunities` | Liste des devis |
| POST | `/api/opportunities/:id/status` | Changer statut devis |
| GET | `/api/relances` | Relances à effectuer |
| POST | `/api/relances/:id/postpone` | Reporter une relance |
| GET | `/api/stats/dashboard` | KPIs dashboard |

### Architecture Worker (Hono)

```typescript
// /api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { companiesRoutes } from './routes/companies';
import { opportunitiesRoutes } from './routes/opportunities';
import { relancesRoutes } from './routes/relances';
import { statsRoutes } from './routes/stats';

type Env = {
  TWENTY_API_URL: string;
  TWENTY_API_KEY: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/*', cors({
  origin: (origin, c) => {
    const allowed = [c.env.FRONTEND_URL, 'http://localhost:3000'];
    return allowed.includes(origin) ? origin : '';
  },
  credentials: true,
}));

// Routes publiques
app.route('/api/auth', authRoutes);

// Routes protégées
app.use('/api/*', authMiddleware);
app.route('/api/companies', companiesRoutes);
app.route('/api/opportunities', opportunitiesRoutes);
app.route('/api/relances', relancesRoutes);
app.route('/api/stats', statsRoutes);

export default app;
```

### Client Twenty (dans le Worker)

```typescript
// /api/src/lib/twenty.ts
export async function queryTwenty<T>(
  env: { TWENTY_API_URL: string; TWENTY_API_KEY: string },
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${env.TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  
  if (json.errors) {
    console.error('Twenty GraphQL Error:', json.errors);
    throw new Error(json.errors[0].message);
  }
  
  return json.data;
}
```

---

## Variables d'Environnement

### Frontend (Cloudflare Pages Dashboard)

```env
NEXT_PUBLIC_API_URL=https://api-amipeq.workers.dev
```

### API Worker (wrangler.toml + secrets)

```toml
# /api/wrangler.toml
name = "api-amipeq"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
TWENTY_API_URL = "https://twenty-production-7352.up.railway.app"
FRONTEND_URL = "https://amipeq.pages.dev"
```

```bash
# Secrets (une seule fois)
cd api
wrangler secret put TWENTY_API_KEY
# Coller: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

wrangler secret put JWT_SECRET
# Générer: openssl rand -base64 32
```

---

## Ordre de Développement

### Phase 1 : Setup Monorepo (1h)
1. Créer structure `frontend/` et `api/`
2. Init Next.js avec static export dans `frontend/`
3. Init Hono Worker dans `api/`
4. Configurer Tailwind avec charte AMIPEQ

### Phase 2 : API Façade (2h)
1. Route `/api/auth/login` (mock ou Twenty users)
2. Middleware JWT
3. Route `/api/opportunities` avec proxy Twenty
4. Route `/api/companies`

### Phase 3 : Frontend Layout (2h)
1. Composants UI (Button, Card, Badge, Input)
2. Sidebar avec navigation
3. Header avec titre dynamique
4. Layout portal assemblé

### Phase 4 : Dashboard (2h)
1. Hook `useDashboardStats`
2. KPICard component
3. AlertBanner component
4. OpportunityList component
5. Page dashboard assemblée

### Phase 5 : Pages Métier (4h)
1. Page Opportunités avec filtres
2. Page Clients avec slide-over
3. Page Relances avec cards urgentes

### Phase 6 : Déploiement (1h)
1. Deploy Worker sur Cloudflare
2. Deploy Pages sur Cloudflare
3. Configurer variables d'environnement
4. Tests E2E

---

## Maquettes de Référence

Les maquettes HTML sont disponibles dans `/maquettes/` :
- `amipeq_v2_dashboard.html` - Dashboard principal
- `amipeq_v2_metabase.html` - Page statistiques
- `amipeq_v2_clients.html` - Liste clients avec slide-over Twenty

Ces fichiers HTML contiennent le design exact à reproduire en React/Tailwind.
