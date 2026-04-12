# AMIPEQ Portal - Instructions de Développement

## Contexte Projet

AMIPEQ est une société spécialisée dans la prévention des risques professionnels (DUERP, PPMS, RPS). Ce portail est l'interface métier simplifiée pour les admins (Alexandra, Christophe) et futurs franchisés.

**Principe architectural** : Twenty = base de données CRM, Portal = interface métier simplifiée.

## Architecture Technique

```
┌─────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │     frontend/       │───▶│        gateway/             │ │
│  │   Cloudflare Pages  │    │    Cloudflare Workers       │ │
│  │   Next.js Static    │    │    Hono.js (façade)         │ │
│  └─────────────────────┘    └──────────────┬──────────────┘ │
└────────────────────────────────────────────┼────────────────┘
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              RAILWAY                                     │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐  │
│  │    Twenty CRM     │  │     backend/      │  │      Metabase       │  │
│  │    GraphQL API    │  │   Node.js APIs    │  │    BI Dashboards    │  │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Stack par couche

| Couche | Technologie | Hébergement | Rôle |
|--------|-------------|-------------|------|
| Frontend | Next.js 14 (Static) + Tailwind | Cloudflare Pages | UI, navigation, formulaires |
| Gateway | Hono.js | Cloudflare Workers | Auth JWT, proxy, cache, CORS |
| Backend | Express + TypeScript | Railway | Doc gen, webhooks, cron, email |
| CRM | Twenty (GraphQL) | Railway | Données métier |
| BI | Metabase | Railway | Dashboards, reporting |

---

## Charte Graphique AMIPEQ

### Couleurs

```css
/* Primary - Action principale */
--primary-500: #f8b829;
--primary-600: #e5a520;  /* Hover */

/* Texte */
--gray-900: #111827;  /* Principal */
--gray-600: #4b5563;  /* Secondaire */
--gray-500: #6b7280;  /* Aide */

/* Fonds */
--white: #ffffff;
--gray-50: #f9fafb;
--gray-200: #e5e7eb;  /* Bordures */
--gray-300: #d1d5db;  /* Inputs */

/* Statuts */
--success-500: #22c55e;  --success-50: #f0fdf4;
--warning-500: #f59e0b;  --warning-50: #fffbeb;
--danger-500: #ef4444;   --danger-50: #fef2f2;
```

### Typographie

- **Police** : Montserrat
- **Poids** : 700 (titres), 600 (labels/boutons), 500 (nav), 400 (texte)

### Règles UI

1. Un seul CTA `primary` par écran
2. Rouge/vert/orange = statuts uniquement
3. Focus ring visible obligatoire
4. `rounded-lg` (8px) pour inputs, `rounded-xl` (12px) pour cards

---

## Structure du Projet

```
amipeq-portal/
├── CLAUDE.md
├── PROMPT_PORTAL.md
├── SKILLS.md
│
├── frontend/                     # ══════ CLOUDFLARE PAGES ══════
│   ├── package.json
│   ├── next.config.js            # output: 'export'
│   ├── tailwind.config.ts
│   ├── wrangler.toml
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   ├── page.tsx          # Redirect → /dashboard
│       │   ├── login/
│       │   │   └── page.tsx
│       │   └── (portal)/
│       │       ├── layout.tsx    # Sidebar + Header
│       │       ├── dashboard/
│       │       │   └── page.tsx
│       │       ├── opportunities/
│       │       │   └── page.tsx
│       │       ├── clients/
│       │       │   ├── page.tsx
│       │       │   └── [id]/page.tsx
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
│       │   ├── useRelances.ts
│       │   └── useDashboard.ts
│       ├── lib/
│       │   ├── api.ts            # Fetch client → Gateway
│       │   ├── auth.ts           # Token storage
│       │   └── utils.ts          # cn(), formatters
│       └── types/
│           └── index.ts
│
├── gateway/                      # ══════ CLOUDFLARE WORKERS ══════
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts              # Entry Hono + routes
│       ├── routes/
│       │   ├── auth.ts           # POST /api/auth/login
│       │   ├── companies.ts      # GET /api/companies
│       │   ├── opportunities.ts  # GET/POST /api/opportunities
│       │   ├── relances.ts       # GET /api/relances
│       │   ├── stats.ts          # GET /api/stats/dashboard
│       │   └── documents.ts      # POST /api/documents/* → Backend
│       ├── middleware/
│       │   ├── auth.ts           # JWT validation
│       │   └── cors.ts
│       └── lib/
│           ├── twenty.ts         # Client GraphQL
│           ├── jwt.ts            # jose sign/verify
│           └── queries.ts        # GraphQL queries
│
├── backend/                      # ══════ RAILWAY ══════
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── railway.toml
│   └── src/
│       ├── index.ts              # Entry Express
│       ├── routes/
│       │   ├── documents.ts      # POST /documents/quote
│       │   ├── webhooks.ts       # POST /webhooks/fillout
│       │   └── sync.ts           # POST /sync/zeendoc
│       ├── jobs/
│       │   ├── relances.ts       # Cron: rappels email
│       │   └── cleanup.ts        # Cron: nettoyage
│       ├── services/
│       │   ├── docGenerator.ts   # Génération Word/PDF
│       │   ├── emailService.ts   # Nodemailer
│       │   └── zeendocService.ts
│       ├── templates/            # 25 templates Word
│       │   ├── devis_duerp.docx
│       │   ├── devis_ppms.docx
│       │   └── ...
│       └── lib/
│           ├── twenty.ts
│           └── config.ts
│
└── maquettes/
    ├── amipeq_v2_dashboard.html
    ├── amipeq_v2_metabase.html
    └── amipeq_v2_clients.html
```

---

## API Gateway (Cloudflare Workers)

### Endpoints publics

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Authentification → JWT |
| POST | `/api/auth/refresh` | Refresh token |

### Endpoints protégés (JWT requis)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/auth/me` | User courant |
| GET | `/api/companies` | Liste clients |
| GET | `/api/companies/:id` | Détail client |
| GET | `/api/opportunities` | Liste devis |
| POST | `/api/opportunities/:id/status` | Changer statut |
| GET | `/api/relances` | Relances à faire |
| POST | `/api/relances/:id/postpone` | Reporter relance |
| GET | `/api/stats/dashboard` | KPIs dashboard |
| POST | `/api/documents/quote` | → Proxy Backend |
| POST | `/api/documents/duerp` | → Proxy Backend |

### Entry point Gateway

```typescript
// gateway/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { companiesRoutes } from './routes/companies';
import { opportunitiesRoutes } from './routes/opportunities';
import { relancesRoutes } from './routes/relances';
import { statsRoutes } from './routes/stats';
import { documentsRoutes } from './routes/documents';

type Env = {
  TWENTY_API_URL: string;
  TWENTY_API_KEY: string;
  BACKEND_URL: string;
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
app.route('/api/documents', documentsRoutes);

export default app;
```

---

## API Backend (Railway)

### Endpoints internes (appelés par Gateway)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/documents/quote` | Génère devis PDF |
| POST | `/documents/duerp` | Génère DUERP Word |
| POST | `/webhooks/fillout` | Reçoit formulaires Fillout |
| POST | `/sync/zeendoc` | Upload doc vers Zeendoc |

### Entry point Backend

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { documentsRouter } from './routes/documents';
import { webhooksRouter } from './routes/webhooks';
import { syncRouter } from './routes/sync';
import { initCronJobs } from './jobs';

const app = express();

app.use(cors({ origin: process.env.GATEWAY_URL }));
app.use(express.json());

// Routes
app.use('/documents', documentsRouter);
app.use('/webhooks', webhooksRouter);
app.use('/sync', syncRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Cron jobs
initCronJobs();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
```

---

## Types TypeScript

```typescript
// types partagés (frontend/src/types/index.ts)

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

export interface DashboardStats {
  caMois: number;
  caVariation: number;
  devisEnAttente: number;
  potentielDevis: number;
  tauxConversion: number;
  conversionVariation: number;
  clientsActifs: number;
  nouveauxClients: number;
  relancesEnRetard: number;
}
```

---

## Variables d'Environnement

### Frontend (Cloudflare Pages Dashboard)

```env
NEXT_PUBLIC_API_URL=https://gateway-amipeq.workers.dev
```

### Gateway (wrangler.toml + secrets)

```toml
# gateway/wrangler.toml
name = "gateway-amipeq"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
TWENTY_API_URL = "https://twenty-production-0500.up.railway.app"
BACKEND_URL = "https://backend-amipeq.up.railway.app"
FRONTEND_URL = "https://amipeq-portal.pages.dev"
```

```bash
wrangler secret put TWENTY_API_KEY
wrangler secret put JWT_SECRET
```

### Backend (Railway Dashboard)

```env
PORT=4000
NODE_ENV=production
TWENTY_API_URL=https://twenty-production-0500.up.railway.app
TWENTY_API_KEY=eyJhbGciOiJIUzI1NiIs...
GATEWAY_URL=https://gateway-amipeq.workers.dev
INTERNAL_SECRET=shared-secret-gateway-backend
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
ZEENDOC_API_URL=https://api.zeendoc.com
ZEENDOC_API_KEY=...
```

---

## Ordre de Développement

### Phase 1 : Setup Monorepo (1h)
1. Créer structure `frontend/`, `gateway/`, `backend/`
2. Init Next.js static dans `frontend/`
3. Init Hono dans `gateway/`
4. Init Express dans `backend/`
5. Configurer Tailwind + charte AMIPEQ

### Phase 2 : Gateway (2h)
1. Route `/api/auth/login` (JWT mock)
2. Middleware auth
3. Route `/api/companies` (proxy Twenty)
4. Route `/api/opportunities`
5. Route `/api/stats/dashboard`

### Phase 3 : Frontend Layout (2h)
1. Composants UI (Button, Card, Badge)
2. Sidebar + Header
3. Layout portal
4. Page login

### Phase 4 : Dashboard (2h)
1. Hook `useDashboard`
2. KPICard, AlertBanner
3. OpportunityList
4. Page assemblée

### Phase 5 : Pages métier (4h)
1. Page Opportunités + filtres
2. Page Clients + slide-over
3. Page Relances

### Phase 6 : Backend APIs (3h)
1. Route `/documents/quote`
2. Service docGenerator
3. Route `/webhooks/fillout`
4. Cron relances

### Phase 7 : Déploiement (1h)
1. Deploy Gateway → Cloudflare
2. Deploy Frontend → Cloudflare Pages
3. Deploy Backend → Railway
4. Config DNS + variables

---

## Maquettes de Référence

Les maquettes HTML sont dans `/maquettes/` :
- `amipeq_v2_dashboard.html` - Dashboard principal
- `amipeq_v2_metabase.html` - Page statistiques
- `amipeq_v2_clients.html` - Liste clients avec slide-over
