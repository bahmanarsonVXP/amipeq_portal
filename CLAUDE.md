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
| `gateway/` | Cloudflare Workers | Hono.js | Vérification JWT Supabase (auth app RPS), proxy Twenty, cache edge, CORS |
| `backend/` | Railway | Node.js + Express | APIs lourdes, génération docs, webhooks, cron |

## Quand utiliser quoi ?

### Gateway (Cloudflare Workers)
✅ Vérification JWT Supabase (auth partagée avec l’application RPS — voir `docs/authentification.md`)
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
├── docs/                     # Référence métier (opportunités / devis)
│   ├── regles-cibles-opportunites-devis.md   # Règles cibles compactes
│   └── processus-opportunites-devis.md     # Spec complète + QA
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

## Authentification

Le portail **n’a pas d’auth dédiée** : il utilise **Supabase Auth de l’application RPS** (projet `nkxcegxgjwugqxpsfnka`). Mêmes identifiants que l’app RPS ; le gateway valide le `access_token` avec `SUPABASE_JWT_SECRET`.

Référence complète : [`docs/authentification.md`](docs/authentification.md) (flux, variables d’env, gestion des comptes, distinction prestation RPS / app RPS).

## Documentation métier (opportunités / devis)

- **Règles cibles (compact)** : [`docs/regles-cibles-opportunites-devis.md`](docs/regles-cibles-opportunites-devis.md) — principes P1–P3, statuts, miroir, widgets D1–D3, automations R-*, champs Twenty.
- **Processus complet** : [`docs/processus-opportunites-devis.md`](docs/processus-opportunites-devis.md) — flux, UI, annexe QA, mapping étendu.

Ne pas dupliquer ces tables dans `CLAUDE.md` : les faire évoluer dans `docs/`.

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
# Auth partagée application RPS (même projet Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://nkxcegxgjwugqxpsfnka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key projet RPS>
```

### Gateway (wrangler.toml + secrets)
```toml
[vars]
TWENTY_API_URL = "https://twenty-production-7352.up.railway.app"
BACKEND_URL = "https://backend-amipeq.up.railway.app"
FRONTEND_URL = "https://amipeq-portal.pages.dev"
```

Secrets Wrangler : `SUPABASE_JWT_SECRET` = JWT Secret du **même** projet Supabase que l’application RPS (pas un secret portail séparé).

### Backend (Railway)
```env
PORT=4000
TWENTY_API_URL=https://twenty-production-7352.up.railway.app
TWENTY_API_KEY=eyJhbGciOiJIUzI1NiIs...
SMTP_HOST=smtp.example.com
ZEENDOC_API_KEY=...
```

## Infrastructure Railway — Notes opérationnelles

### Twenty Worker — OOM Fix

Le Twenty Worker crashe avec `FATAL ERROR: JavaScript heap out of memory` si `NODE_OPTIONS` n'est pas défini.

**Cause** : Node.js plafonne son heap V8 à ~256 MB par défaut dans les conteneurs Railway, même si le sizing RAM est plus élevé.

**Fix appliqué (mai 2026)** :
- Sizing : **1 GB / 1 vCPU** (512 MB insuffisant — le conteneur est OOM-killed avant que Node.js démarre)
- Variable d'env Railway : `NODE_OPTIONS=--max-old-space-size=896`

**⚠️ Après un upgrade de Twenty** : vérifier que le worker reste en `SUCCESS`. Si nouveau crash OOM :
1. Augmenter le sizing : `./railway-toggle.sh size Twenty-Worker 2 2`
2. Mettre à jour la variable : `NODE_OPTIONS=--max-old-space-size=1800`

### Gestion des services (start/stop/sizing)

```bash
./railway-toggle.sh status          # état de tous les services
./railway-toggle.sh start           # démarrer tous les services
./railway-toggle.sh stop            # arrêter tous les services
./railway-toggle.sh size            # afficher les profils disponibles
./railway-toggle.sh size all small  # profil 1-3 users
./railway-toggle.sh size all medium # profil 3-10 users
```

## Flux des Requêtes

```
Connexion:           Frontend → Supabase Auth (projet app RPS) → JWT
Lecture données:     Frontend → Gateway (JWT) → Twenty
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

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->