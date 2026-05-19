# AMIPEQ — Backlog des User Stories

> Format : chaque US contient un frontmatter YAML entre `---` délimiteurs.
> Ne pas modifier manuellement les champs `id`, `created_at`, `updated_at`.
> Le champ `depends_on` et `blocks` permettent de reconstruire l'arborescence.

---

---

<!--US:START id="US-007"-->
---
id: "US-007"
title: "Authentification portail — Supabase Auth + Gateway Hono (Cloudflare Workers)"
status: "Done"
mode: "interactive"
priority: "high"
created_at: "2026-04-11"
updated_at: "2026-04-11"
depends_on:
blocks:
  - "US-008"
context_files:
  - "PROMPT_CLAUDE_CODE_AMIPEQ.md"
tags: ["auth", "supabase", "gateway", "hono", "cloudflare", "nextjs"]
---

### En tant que
Développeur AMIPEQ (Bahman)

### Je veux
Mettre en place la couche d'authentification complète du portail AMIPEQ :
- Une page de login Next.js aux couleurs AMIPEQ (Montserrat, `#f8b829`)
- Un hook `useAuth` + un layout protégé côté client (compatible Static Export)
- Un Gateway Cloudflare Worker (Hono.js) qui vérifie les JWT Supabase

### Afin de
Que Alexandra et Christophe puissent se connecter au portail avec leur email/password
existant dans Supabase Auth, et que toutes les routes du portail soient protégées.
Le Gateway sécurisera ensuite tous les appels vers Twenty et les futures bases de données.

### Acceptance Criteria
- [ ] `frontend/src/app/login/page.tsx` existe et affiche un formulaire email/password
- [ ] La page login respecte la charte AMIPEQ : Montserrat, jaune `#f8b829`, fond sombre/clair cohérent avec les maquettes existantes
- [ ] La connexion appelle `supabase.auth.signInWithPassword()` et stocke la session en cookie HTTP-only
- [ ] Les erreurs de connexion sont affichées (mauvais mot de passe, email inconnu)
- [ ] Le hook `useAuth` dans `frontend/src/hooks/useAuth.ts` détecte la session et redirige vers `/login` si absente
- [ ] Le layout `frontend/src/app/(portal)/layout.tsx` protège toutes les routes du portail via `useAuth`
- [ ] Un spinner est affiché pendant la vérification de session (`isLoading`)
- [ ] Le dossier `gateway/` existe avec un Worker Hono fonctionnel
- [ ] Le Gateway expose au minimum `GET /health` (public) et `GET /me` (protégé)
- [ ] Le Gateway valide le JWT via `jose` avec `SUPABASE_JWT_SECRET`
- [ ] Une requête sans token sur une route protégée retourne `401`
- [ ] Une requête avec token valide retourne `200` avec `{ sub, email }` du payload
- [ ] Les variables d'environnement sont documentées dans un `.env.example` pour frontend et gateway
- [ ] Le déploiement Cloudflare Workers est documenté (commande `wrangler deploy`)

### Requirements techniques

#### Structure de fichiers à créer
amipeq-portal/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   │   └── page.tsx          ← page de login AMIPEQ
│   │   │   └── (portal)/
│   │   │       └── layout.tsx        ← layout protégé
│   │   ├── hooks/
│   │   │   └── useAuth.ts            ← hook session Supabase
│   │   └── lib/
│   │       └── supabase.ts           ← client Supabase singleton
│   └── .env.example
└── gateway/
├── src/
│   └── index.ts                  ← Worker Hono principal
├── wrangler.toml                 ← config Cloudflare Worker
├── package.json
└── .env.example

#### Supabase — auth partagée avec l’application RPS
- **Pas d’auth propre au portail** : réutilisation de Supabase Auth de l’**application RPS** (audits).
- Projet : `nkxcegxgjwugqxpsfnka` — URL : `https://nkxcegxgjwugqxpsfnka.supabase.co`
- Comptes : `auth.users` du projet RPS (création via dashboard Supabase / app RPS, pas via le portail)
- Méthode portail : `supabase.auth.signInWithPassword({ email, password })`
- Doc canonique : [`docs/authentification.md`](docs/authentification.md)

#### Variables d'environnement frontend
NEXT_PUBLIC_SUPABASE_URL=https://nkxcegxgjwugqxpsfnka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_GATEWAY_URL=<url du worker>

#### Variables d'environnement gateway
SUPABASE_URL=https://nkxcegxgjwugqxpsfnka.supabase.co
SUPABASE_JWT_SECRET=<trouvable dans Supabase > Settings > API > JWT Secret>

#### Gateway — validation JWT
```typescript
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
const { payload } = await jwtVerify(token, secret);
// payload.sub = user ID, payload.email = email
```

#### Contraintes Next.js
- `output: 'export'` dans `next.config.js` → pas de middleware serveur
- Protection des routes : uniquement côté client via `useAuth` + layout
- Pas de `cookies()` ou `headers()` server-side dans les composants

#### Charte visuelle page login
- Font : Montserrat (400, 600, 700)
- Couleur primaire CTA : `#f8b829` (hover : `#e5a520`)
- S'inspirer visuellement des maquettes `amipeq_v2_dashboard.html`
- Un seul CTA principal : bouton "Se connecter"
- Focus rings visibles (accessibilité)

#### Note architecture
- **Auth** : toujours celle de l’application RPS (ce projet Supabase). Le portail n’émet pas ses propres utilisateurs.
- **Données métier portail** : Twenty (+ backend Railway) ; une future instance Supabase **métier** (devis, franchisés) resterait **sans remplacer** l’auth RPS — le gateway continuerait à valider le JWT Supabase RPS.
- Ne pas confondre la **prestation** « RPS » (enum CRM) avec l’**application RPS** (fournisseur d’identité).
<!--US:END-->

<!--US:START id="US-008"-->
---
id: "US-008"
title: "Clients overview — snapshot agrégé persistant côté Railway + cron de recalcul"
status: "Todo"
mode: "interactive"
priority: "medium"
created_at: "2026-05-12"
updated_at: "2026-05-12"
depends_on:
  - "US-007"
blocks:
context_files:
  - "CLAUDE.md"
  - "BACKLOG.md"
tags: ["clients", "gateway", "railway", "cron", "cache", "twenty", "performance"]
---

### En tant que
Développeur AMIPEQ (Bahman)

### Je veux
Déplacer le calcul des agrégats de l'écran `Clients` vers un snapshot persistant calculé côté Railway,
avec un cron de recalcul et une stratégie d'invalidation légère.

### Afin de
Fiabiliser le CA clients, éviter les limites du cache mémoire du Gateway Cloudflare, réduire les appels
répétés à Twenty CRM, et garantir des données cohérentes même après redéploiement du Worker.

### Contexte
Une première version a été mise en place dans le Gateway Cloudflare avec l'endpoint
`GET /api/companies/overview`.

Cette version corrige le bug métier principal :
- le CA n'est plus calculé depuis un simple `top 300` d'opportunités,
- le calcul est fait côté Gateway en batch,
- les opportunités en cours et le CA 4 ans sont agrégés proprement.

Limite actuelle :
- le cache utilisé par le Gateway est un `Map` mémoire local au Worker,
- ce cache n'est ni persistant, ni partagé entre instances,
- il peut disparaître à un redéploiement Cloudflare ou à un recyclage d'isolat.

Cette US décrit la V2 cible : snapshot persistant côté Railway.

### Acceptance Criteria
- [ ] Un job cron Railway recalcule un snapshot complet des agrégats clients à fréquence définie (`5 min` ou `10 min`)
- [ ] Le snapshot contient au minimum : identité client, type, département, opportunités en cours, CA des 4 années glissantes
- [ ] Le snapshot est stocké dans un support persistant côté Railway (Redis ou Postgres JSONB)
- [ ] Le Gateway Cloudflare ne recalcule plus les agrégats complets à chaque warm/cold start
- [ ] Le Gateway lit d'abord le snapshot persistant pour servir `GET /api/companies/overview`
- [ ] Une stratégie de fallback existe si le snapshot est absent ou obsolète
- [ ] Une stratégie d'invalidation ou de marquage `stale` est prévue après mutation importante (opportunity create/update/delete, company delete)
- [ ] Le contrat JSON renvoyé au frontend reste compatible avec l'écran `Clients`
- [ ] La stratégie est documentée : source de vérité, fraîcheur des données, fréquence de recalcul, procédure d'incident

### Requirements techniques

#### Architecture cible
- Frontend → Gateway Cloudflare → Backend Railway → snapshot persistant
- Le frontend continue d'appeler uniquement le Gateway
- Le backend Railway devient le producteur du snapshot métier
- Twenty CRM reste la source de vérité métier brute

#### Données à inclure dans le snapshot
- `years`: tableau des 4 années glissantes
- `companies[]`
- pour chaque company :
  - `id`
  - `name`
  - `typeClient`
  - `departementNumero`
  - `address.postcode`
  - `address.city`
  - `createdAt`
  - `updatedAt`
  - `openCount`
  - `openTotalEur`
  - `openOpportunities[]` (au moins les champs utiles à la modale actuelle)
  - `caByYear`

#### Périmètre métier des agrégats
- Opportunités en cours :
  - `NOUVEAU`
  - `DEVIS_EN_COURS`
  - `DEVIS_EN_RELECTURE`
  - `DEVIS_ENVOYE`
  - `RELANCE`
- CA :
  - uniquement `statutDevis = GAGNE`
  - agrégé par `companyId`
  - agrégé par `anneeDevis`
  - limité aux 4 années glissantes affichées dans la table

#### Source de calcul
- Éviter absolument le N+1 par client
- Préférer 2 à 3 requêtes batch maximum vers Twenty :
  - companies visibles / actives
  - opportunities gagnées des 4 années
  - opportunities en cours
- Agrégation réalisée côté backend Railway

#### Stockage persistant candidat
Option A — Redis :
- simple cache JSON (`clients:overview:v1`)
- rapide
- adapté si l'objectif principal est le cache

Option B — Postgres JSONB :
- snapshot plus durable et auditable
- plus simple à inspecter en SQL
- adapté si l'on veut historiser ou diagnostiquer facilement

Décision à prendre lors de l'implémentation.

#### Stratégie de fraîcheur
- Recalcul complet par cron toutes les `5` ou `10` minutes
- En complément :
  - soit invalidation de la clé snapshot après mutation critique
  - soit marquage `stale`
  - soit refresh async déclenché après mutation

#### Migration recommandée
1. Garder `GET /api/companies/overview` comme contrat stable pour le frontend
2. Déplacer progressivement la production des agrégats vers Railway
3. Faire lire par le Gateway le snapshot persistant
4. Retirer ensuite le calcul batch côté Gateway si le snapshot Railway est jugé fiable

#### Risques / points d'attention
- Décalage temporel entre une mutation Twenty et le prochain cron
- Besoin de stratégie claire en cas d'échec du job de recalcul
- Taille potentielle du snapshot si `openOpportunities[]` devient trop riche
- Gestion de la cohérence si plusieurs producteurs de snapshot existent

#### Note d'architecture
Le cache mémoire actuel du Gateway Cloudflare reste acceptable comme solution transitoire.
Cette US formalise la cible moyen terme : un snapshot persistant côté Railway, plus robuste
vis-à-vis des redéploiements Cloudflare et de la montée en charge.
<!--US:END-->
