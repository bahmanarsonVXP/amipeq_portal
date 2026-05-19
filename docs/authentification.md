# Authentification du portail AMIPEQ

## Principe

Le **portail commercial** (`frontend/` + `gateway/`) **ne possède pas** son propre système d’identité (pas de table `users` dédiée, pas de `/api/auth/login` maison, pas de `JWT_SECRET` propre au portail).

Il réutilise **l’Auth Supabase de l’application RPS** (audits / risques psychosociaux AMIPEQ) : mêmes comptes email/mot de passe, même projet Supabase, mêmes JWT.

| Application | Rôle auth | Données métier |
|-------------|-----------|----------------|
| **Application RPS** | Propriétaire de Supabase Auth (`auth.users`) | Audits RPS, données liées au produit RPS |
| **Portail AMIPEQ** (ce repo) | Client Auth uniquement (`supabase.auth.*`) | Twenty CRM, génération devis, etc. |

Un utilisateur créé ou désactivé dans Supabase pour l’app RPS **impacte immédiatement** l’accès au portail (et inversement).

## Projet Supabase partagé

| Champ | Valeur |
|-------|--------|
| Référence projet | `nkxcegxgjwugqxpsfnka` |
| URL | `https://nkxcegxgjwugqxpsfnka.supabase.co` |
| Usage portail | **Uniquement** le module `auth` (GoTrue) — pas de requêtes `.from()` métier |
| JWT | Signés par Supabase ; le gateway les vérifie avec `SUPABASE_JWT_SECRET` |

Le secret JWT se trouve dans le dashboard Supabase : **Project Settings → API → JWT Secret** (identique pour l’app RPS et le portail).

## Flux

```
┌─────────────┐     signInWithPassword      ┌──────────────────────────┐
│  Portail    │ ──────────────────────────▶ │  Supabase Auth (app RPS) │
│  /login     │ ◀── access_token (JWT) ──── │  nkxcegxgjwugqxpsfnka    │
└──────┬──────┘                             └──────────────────────────┘
       │ Authorization: Bearer <JWT>
       ▼
┌─────────────┐     jwtVerify(SUPABASE_JWT_SECRET)
│  Gateway    │ ──────────────────────────▶ Twenty / Backend (données CRM)
│  /api/*     │
└─────────────┘
```

1. **Connexion** : `frontend/src/app/login/page.tsx` → `supabase.auth.signInWithPassword()`.
2. **Session** : `AuthContext` + `supabase.auth.getSession()` / `onAuthStateChange()` ; copie optionnelle du token dans `localStorage` (`amipeq_token`) pour les appels API.
3. **API portail** : `apiFetch` / `apiFetchWithSession` envoient le `access_token` au gateway.
4. **Gateway** : `gateway/src/middleware/auth.ts` valide le JWT avec `jose` et `SUPABASE_JWT_SECRET` ; expose `sub` et `email` via `c.get('user')`.

Le **backend Railway** ne valide pas le JWT utilisateur : seul le gateway est en frontal.

## Gestion des comptes

- **Création / suppression / reset mot de passe** : via le dashboard Supabase (**Authentication → Users**) ou les flux prévus par l’**application RPS** — pas depuis le portail (la page login indique de contacter l’admin).
- **Ne pas** provisionner un second projet Supabase Auth pour le portail sans décision d’architecture explicite (SSO, séparation des populations, etc.).

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `frontend/src/lib/supabase.ts` | Client navigateur `@supabase/ssr` |
| `frontend/src/contexts/AuthContext.tsx` | Session, redirection `/login` |
| `frontend/src/lib/gatewayToken.ts` | Miroir du token pour `fetch` |
| `frontend/src/lib/api.ts` | Bearer vers le gateway |
| `gateway/src/middleware/auth.ts` | Vérification JWT |
| `gateway/src/lib/jwt.ts` | `verifyToken` (payload Supabase) |

## Variables d’environnement

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://nkxcegxgjwugqxpsfnka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon du projet RPS>
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8787
```

En dev, les appels `/api/*` peuvent être proxifiés vers le gateway via `next.config.js` (rewrite).

### Gateway (`gateway/.dev.vars` / secrets Wrangler)

```env
SUPABASE_URL=https://nkxcegxgjwugqxpsfnka.supabase.co
SUPABASE_JWT_SECRET=<JWT Secret du même projet que l’app RPS>
```

`SUPABASE_JWT_SECRET` **doit** être le secret du projet RPS : un token émis après login RPS ou portail doit être accepté par le gateway.

## Distinction avec la prestation « RPS » (CRM)

Dans Twenty et le portail, **RPS** désigne aussi un **type de prestation** (DUERP, PPMS, RPS, etc.). Ce n’est **pas** le même concept que l’**application RPS** utilisée pour l’auth. Ne pas confondre :

- **Auth** → application produit RPS + Supabase `auth.users`
- **Prestation RPS** → champ / enum métier sur les opportunités et devis

## Évolutions possibles (hors scope actuel)

- Données métier portail dans une **autre** instance Supabase (devis, franchisés) **sans** dupliquer l’auth : le JWT RPS reste la clé d’entrée gateway.
- Cookies HTTP-only / SSR : backlog initial ; implémentation actuelle = client + `localStorage` pour le static export.

## Références

- User story : `BACKLOG.md` (US-007)
- Instructions agents : `CLAUDE.md` (section Authentification)
