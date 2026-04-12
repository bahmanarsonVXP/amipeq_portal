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

#### Supabase
- Projet : `nkxcegxgjwugqxpsfnka`
- URL : `https://nkxcegxgjwugqxpsfnka.supabase.co`
- Pas de table `users` custom — utiliser `auth.users` natif
- Méthode : `supabase.auth.signInWithPassword({ email, password })`
- Session : cookies HTTP-only via `@supabase/ssr` (package adapté au SSR/Static)

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

#### Note architecture future
Le projet Supabase `nkxcegxgjwugqxpsfnka` est dédié à l'auth uniquement.
Une future instance Supabase distincte hébergera : devis, audits RPS, données franchisés.
Le Gateway devra à terme router vers les deux instances — cette US pose uniquement
les fondations de la vérification JWT, sans coupler le code à une seule instance.
<!--US:END-->
