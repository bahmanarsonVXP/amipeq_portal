# CLAUDE.md - Instructions pour Claude Code

## Projet

AMIPEQ Portal - Interface métier pour la gestion commerciale (devis, clients, relances, génération de documents).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Cloudflare Pages  │───▶│     Cloudflare Workers      │ │
│  │     frontend/       │    │        gateway/             │ │
│  │   (Next.js Static)  │    │   (Hono - Façade légère)    │ │
│  └─────────────────────┘    └──────────────┬──────────────┘ │
└────────────────────────────────────────────┼────────────────┘
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      │                      │                      │
                      ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              RAILWAY                                     │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐  │
│  │    Twenty CRM     │  │     backend/      │  │      Metabase       │  │
│  │    (GraphQL)      │  │    (Node.js)      │  │       (BI)          │  │
│  │                   │  │                   │  │                     │  │
│  │  • Companies      │  │  • Doc Generation │  │  • Dashboards       │  │
│  │  • Opportunities  │  │  • Webhooks       │  │  • Reports          │  │
│  │  • Persons        │  │  • Cron Jobs      │  │  • Embed JWT        │  │
│  │  • Notes          │  │  • Email          │  │                     │  │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Rôles de chaque couche

| Dossier | Hébergement | Technologie | Rôle |
|---------|-------------|-------------|------|
| `frontend/` | Cloudflare Pages | Next.js 14 Static | UI React, formulaires, navigation |
| `gateway/` | Cloudflare Workers | Hono.js | Auth JWT, proxy Twenty, cache edge, CORS |
| `backend/` | Railway | Node.js + Express | APIs lourdes, génération docs, webhooks, cron |

## Quand utiliser quoi ?

### Gateway (Cloudflare Workers)
✅ Auth JWT (sign/verify)
✅ Proxy requêtes Twenty
✅ Cache edge (< 30s)
✅ Rate limiting, CORS
❌ Jobs longs (max 30s CPU)
❌ Filesystem
❌ Connexion DB directe

### Backend (Railway)
✅ Génération documents Word/PDF
✅ Webhooks Fillout
✅ Sync Zeendoc
✅ Cron jobs (relances auto)
✅ Envoi emails SMTP
✅ Jobs longs, filesystem temp

## Commandes Fréquentes

```bash
# === FRONTEND (Cloudflare Pages) ===
cd frontend
npm run dev                 # Dev local (port 3000)
npm run build               # Build static
npx wrangler pages deploy out --project-name=amipeq-portal

# === GATEWAY (Cloudflare Workers) ===
cd gateway
npm run dev                 # Dev local (port 8787)
npm run deploy              # Deploy Workers
wrangler secret put TWENTY_API_KEY
wrangler secret put JWT_SECRET

# === BACKEND (Railway) ===
cd backend
npm run dev                 # Dev local (port 4000)
railway up                  # Deploy Railway
```

## Structure Projet

```
amipeq-portal/
├── CLAUDE.md
├── PROMPT_PORTAL.md
├── SKILLS.md
│
├── frontend/                 # ══════ CLOUDFLARE PAGES ══════
│   ├── package.json
│   ├── next.config.js        # output: 'export'
│   ├── tailwind.config.ts
│   ├── wrangler.toml
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   ├── login/page.tsx
│       │   └── (portal)/
│       │       ├── layout.tsx
│       │       ├── dashboard/page.tsx
│       │       ├── opportunities/page.tsx
│       │       ├── clients/page.tsx
│       │       ├── relances/page.tsx
│       │       └── stats/page.tsx
│       ├── components/
│       │   ├── layout/       # Sidebar, Header
│       │   ├── ui/           # Button, Card, Badge, Input
│       │   ├── dashboard/    # KPICard, AlertBanner
│       │   ├── opportunities/
│       │   ├── clients/
│       │   └── relances/
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useOpportunities.ts
│       │   └── useCompanies.ts
│       ├── lib/
│       │   ├── api.ts        # Client fetch → Gateway
│       │   └── utils.ts      # cn(), formatters
│       └── types/
│
├── gateway/                  # ══════ CLOUDFLARE WORKERS ══════
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts          # Entry Hono
│       ├── routes/
│       │   ├── auth.ts       # /api/auth/*
│       │   ├── companies.ts  # Proxy → Twenty
│       │   ├── opportunities.ts
│       │   ├── relances.ts
│       │   ├── stats.ts
│       │   └── documents.ts  # Proxy → Backend Railway
│       ├── middleware/
│       │   ├── auth.ts       # JWT validation
│       │   └── cors.ts
│       └── lib/
│           ├── twenty.ts     # Client GraphQL Twenty
│           ├── jwt.ts
│           └── queries.ts
│
├── backend/                  # ══════ RAILWAY ══════
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── railway.toml
│   └── src/
│       ├── index.ts          # Entry Express
│       ├── routes/
│       │   ├── documents.ts  # /documents/quote, /documents/duerp
│       │   ├── webhooks.ts   # /webhooks/fillout
│       │   └── sync.ts       # /sync/zeendoc
│       ├── jobs/
│       │   ├── relances.ts   # Cron relances
│       │   └── cleanup.ts
│       ├── services/
│       │   ├── docGenerator.ts
│       │   ├── emailService.ts
│       │   └── zeendocService.ts
│       ├── templates/        # 25 templates Word
│       └── lib/
│           └── twenty.ts
│
└── maquettes/
    ├── amipeq_v2_dashboard.html
    ├── amipeq_v2_metabase.html
    └── amipeq_v2_clients.html
```

## Conventions de Code

### Nommage
- **Composants** : PascalCase (`KPICard.tsx`)
- **Routes API** : kebab-case (`/api/opportunities`)
- **Fichiers** : camelCase (`useOpportunities.ts`)
- **Types** : PascalCase (`Opportunity`)

### Frontend (Static Export)
```tsx
'use client';
import { useOpportunities } from '@/hooks/useOpportunities';

export default function OpportunitiesPage() {
  const { data, isLoading } = useOpportunities();
  if (isLoading) return <Skeleton />;
  return <OpportunityTable data={data} />;
}
```

### Gateway (Hono)
```typescript
// Proxy vers Twenty
app.get('/companies', async (c) => {
  const data = await queryTwenty(c.env, GET_COMPANIES);
  return c.json(data);
});

// Proxy vers Backend
app.post('/documents/quote', async (c) => {
  const res = await fetch(`${c.env.BACKEND_URL}/documents/quote`, {
    method: 'POST',
    body: JSON.stringify(await c.req.json()),
  });
  return c.json(await res.json());
});
```

### Backend (Express)
```typescript
app.post('/documents/quote', async (req, res) => {
  const { opportunityId } = req.body;
  const opportunity = await twentyClient.getOpportunity(opportunityId);
  const doc = await generateQuote(opportunity);
  res.json({ url: doc.url });
});
```

## Charte Graphique

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-500` | #f8b829 | CTA, nav active |
| `primary-600` | #e5a520 | Hover |
| `gray-900` | #111827 | Texte principal |
| `gray-600` | #4b5563 | Texte secondaire |
| `success-500` | #22c55e | Gagné |
| `warning-500` | #f59e0b | En attente |
| `danger-500` | #ef4444 | Refusé/Retard |

**Typographie** : Montserrat (400, 500, 600, 700)

## Variables d'Environnement

### Frontend (Cloudflare Pages)
```env
NEXT_PUBLIC_API_URL=https://gateway-amipeq.workers.dev
```

### Gateway (wrangler.toml + secrets)
```toml
[vars]
TWENTY_API_URL = "https://twenty-production-0500.up.railway.app"
BACKEND_URL = "https://backend-amipeq.up.railway.app"
FRONTEND_URL = "https://amipeq-portal.pages.dev"
```

### Backend (Railway)
```env
PORT=4000
TWENTY_API_URL=https://twenty-production-0500.up.railway.app
TWENTY_API_KEY=eyJhbGciOiJIUzI1NiIs...
SMTP_HOST=smtp.example.com
ZEENDOC_API_KEY=...
```

## Flux des Requêtes

```
Lecture données:     Frontend → Gateway → Twenty
Génération doc:      Frontend → Gateway → Backend → Twenty + Template → PDF
Webhook Fillout:     Fillout → Backend → Twenty
```

## Déploiement

```bash
# Frontend
cd frontend && npx wrangler pages deploy out --project-name=amipeq-portal

# Gateway
cd gateway && npm run deploy

# Backend
cd backend && railway up
```
