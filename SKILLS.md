# SKILLS.md - Patterns et Composants AMIPEQ

## Vue d'ensemble

Patterns réutilisables pour les 3 couches : Frontend, Gateway, Backend.

---

## Skill : Composants UI (Frontend)

### Button

```tsx
// frontend/src/components/ui/Button.tsx
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          
          size === 'sm' && 'px-3 py-1.5 text-xs',
          size === 'md' && 'px-4 py-2.5 text-sm',
          size === 'lg' && 'px-6 py-3 text-base',
          
          variant === 'primary' && 'bg-primary-500 text-gray-900 hover:bg-primary-600 focus:ring-primary-500',
          variant === 'secondary' && 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 focus:ring-gray-300',
          variant === 'ghost' && 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
          variant === 'danger' && 'bg-white text-danger-500 border border-danger-500 hover:bg-danger-50 focus:ring-danger-500',
          variant === 'success' && 'bg-success-50 text-success-500 hover:bg-success-100 focus:ring-success-500',
          
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

### Badge

```tsx
// frontend/src/components/ui/Badge.tsx
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const styles: Record<BadgeVariant, string> = {
  success: 'bg-success-50 text-success-500',
  warning: 'bg-warning-50 text-warning-500',
  danger: 'bg-danger-50 text-danger-500',
  neutral: 'bg-gray-100 text-gray-600',
  info: 'bg-blue-50 text-blue-600',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', styles[variant])}>
      {children}
    </span>
  );
}

export function getStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    GAGNE: 'success', CLIENT_ACTIF: 'success',
    EN_ATTENTE: 'warning', PROSPECT: 'warning',
    REFUSE: 'danger', PERDU: 'danger', EN_RETARD: 'danger',
  };
  return map[status] || 'neutral';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    GAGNE: 'Gagné', REFUSE: 'Refusé', EN_ATTENTE: 'En attente',
    CLIENT_ACTIF: 'Actif', CLIENT_INACTIF: 'Inactif',
    PROSPECT: 'Prospect', PERDU: 'Perdu',
  };
  return map[status] || status;
}
```

### Card

```tsx
// frontend/src/components/ui/Card.tsx
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200',
      padding === 'sm' && 'p-4',
      padding === 'md' && 'p-5',
      padding === 'lg' && 'p-6',
      className
    )}>
      {children}
    </div>
  );
}
```

### Input

```tsx
// frontend/src/components/ui/Input.tsx
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-2.5 text-sm rounded-lg border transition-all',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-red-300 focus:border-danger-500 focus:ring-danger-500/20'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/20',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
```

---

## Skill : Layout (Frontend)

### Sidebar

```tsx
// frontend/src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Layers, Users, Clock, BarChart3, ExternalLink } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunités', icon: Layers, badge: 12, badgeColor: 'warning' },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/relances', label: 'Relances', icon: Clock, badge: 3, badgeColor: 'danger' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-gray-900 font-bold text-lg">A</span>
          </div>
          <span className="text-lg font-bold text-gray-900">AMIPEQ</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    isActive
                      ? 'bg-primary-500 text-gray-900 font-semibold'
                      : 'text-gray-600 font-medium hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      'ml-auto px-2 py-0.5 rounded-full text-xs font-semibold',
                      item.badgeColor === 'danger' ? 'bg-danger-50 text-danger-500' : 'bg-warning-50 text-warning-500'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-gray-200 my-4" />

        <Link
          href="/stats"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
            pathname === '/stats'
              ? 'bg-primary-500 text-gray-900 font-semibold'
              : 'text-gray-600 font-medium hover:bg-gray-50'
          )}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Statistiques</span>
        </Link>

        <div className="border-t border-gray-200 my-4" />

        <a
          href="https://twenty-production-7352.up.railway.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 font-medium hover:bg-gray-50"
        >
          <ExternalLink className="w-5 h-5" />
          <span>Twenty CRM</span>
        </a>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-900">AL</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Alexandra</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

### Header

```tsx
// frontend/src/components/layout/Header.tsx
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick?: () => void };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {action && (
          <Button variant="primary" onClick={action.onClick}>
            + {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
```

---

## Skill : Dashboard Components (Frontend)

### KPICard

```tsx
// frontend/src/components/dashboard/KPICard.tsx
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  valueColor?: 'default' | 'warning' | 'success' | 'danger';
}

export function KPICard({ label, value, trend, valueColor = 'default' }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500 mb-2">{label}</p>
      <p className={cn(
        'text-3xl font-bold',
        valueColor === 'default' && 'text-gray-900',
        valueColor === 'warning' && 'text-warning-500',
        valueColor === 'success' && 'text-success-500',
        valueColor === 'danger' && 'text-danger-500'
      )}>
        {value}
      </p>
      {trend && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-sm font-medium',
          trend.direction === 'up' && 'text-success-500',
          trend.direction === 'down' && 'text-danger-500',
          trend.direction === 'neutral' && 'text-gray-500'
        )}>
          {trend.direction === 'up' && <TrendingUp className="w-4 h-4" />}
          {trend.direction === 'down' && <TrendingDown className="w-4 h-4" />}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}
```

### AlertBanner

```tsx
// frontend/src/components/dashboard/AlertBanner.tsx
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface AlertBannerProps {
  count: number;
  clients: string[];
}

export function AlertBanner({ count, clients }: AlertBannerProps) {
  return (
    <div className="bg-danger-50 border border-red-300 rounded-xl p-5 flex items-center gap-4">
      <AlertCircle className="w-6 h-6 text-danger-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-danger-500">
          {count} relance{count > 1 ? 's' : ''} en retard
        </p>
        <p className="text-sm text-danger-500/80 mt-1">{clients.join(', ')}</p>
      </div>
      <Link href="/relances">
        <Button variant="danger" size="sm">Voir les relances</Button>
      </Link>
    </div>
  );
}
```

---

## Skill : API Client (Frontend)

### Fetch Client

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('amipeq_token') : null;

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new ApiError(res.status, error.message || 'API Error');
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
};
```

### Hooks

```typescript
// frontend/src/hooks/useOpportunities.ts
'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { Opportunity } from '@/types';

export function useOpportunities(status?: string) {
  const endpoint = status ? `/api/opportunities?status=${status}` : '/api/opportunities';
  return useSWR<{ opportunities: Opportunity[] }>(endpoint, api.get);
}

// frontend/src/hooks/useDashboard.ts
'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types';

export function useDashboard() {
  return useSWR<DashboardStats>('/api/stats/dashboard', api.get);
}
```

---

## Skill : Gateway (Cloudflare Workers)

### Entry Point

```typescript
// gateway/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { companiesRoutes } from './routes/companies';
import { opportunitiesRoutes } from './routes/opportunities';
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

app.use('/*', cors({
  origin: (origin, c) => {
    const allowed = [c.env.FRONTEND_URL, 'http://localhost:3000'];
    return allowed.includes(origin) ? origin : '';
  },
  credentials: true,
}));

app.route('/api/auth', authRoutes);
app.use('/api/*', authMiddleware);
app.route('/api/companies', companiesRoutes);
app.route('/api/opportunities', opportunitiesRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/documents', documentsRoutes);

export default app;
```

### Twenty Client

```typescript
// gateway/src/lib/twenty.ts
type Env = { TWENTY_API_URL: string; TWENTY_API_KEY: string };

export async function queryTwenty<T>(env: Env, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${env.TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}
```

### JWT Auth

```typescript
// gateway/src/lib/jwt.ts
import { SignJWT, jwtVerify } from 'jose';

interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'franchisee';
}

export async function signToken(payload: UserPayload, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken(token: string, secret: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

// gateway/src/middleware/auth.ts
import { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt';

export async function authMiddleware(c: Context<{ Bindings: { JWT_SECRET: string } }>, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await verifyToken(auth.slice(7), c.env.JWT_SECRET);
  if (!user) return c.json({ error: 'Invalid token' }, 401);

  c.set('user', user);
  await next();
}
```

### Proxy Backend

```typescript
// gateway/src/routes/documents.ts
import { Hono } from 'hono';

type Env = { BACKEND_URL: string };

const app = new Hono<{ Bindings: Env }>();

app.post('/quote', async (c) => {
  const body = await c.req.json();
  const res = await fetch(`${c.env.BACKEND_URL}/documents/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return c.json(await res.json(), res.status);
});

export { app as documentsRoutes };
```

---

## Skill : Backend (Railway)

### Entry Point

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { documentsRouter } from './routes/documents';
import { webhooksRouter } from './routes/webhooks';
import { initCronJobs } from './jobs';

const app = express();

app.use(cors({ origin: process.env.GATEWAY_URL }));
app.use(express.json());

app.use('/documents', documentsRouter);
app.use('/webhooks', webhooksRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

initCronJobs();

app.listen(process.env.PORT || 4000);
```

### Document Generation

```typescript
// backend/src/routes/documents.ts
import { Router } from 'express';
import { generateQuote } from '../services/docGenerator';
import { getTwentyOpportunity } from '../lib/twenty';

export const documentsRouter = Router();

documentsRouter.post('/quote', async (req, res) => {
  try {
    const { opportunityId } = req.body;
    const opportunity = await getTwentyOpportunity(opportunityId);
    const doc = await generateQuote(opportunity);
    res.json({ url: doc.url, filename: doc.filename });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate document' });
  }
});
```

---

## Skill : Utilitaires

### cn() helper

```typescript
// frontend/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Formatters

```typescript
// frontend/src/lib/utils.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(date));
}
```

---

## Dépendances

### Frontend

```json
{
  "dependencies": {
    "next": "14.x", "react": "18.x", "react-dom": "18.x",
    "swr": "^2.2", "lucide-react": "^0.400", "clsx": "^2.1", "tailwind-merge": "^2.3"
  },
  "devDependencies": {
    "typescript": "^5.4", "tailwindcss": "^3.4", "wrangler": "^3.50"
  }
}
```

### Gateway

```json
{
  "dependencies": { "hono": "^4.3", "jose": "^5.2" },
  "devDependencies": { "typescript": "^5.4", "wrangler": "^3.50", "@cloudflare/workers-types": "^4" }
}
```

### Backend

```json
{
  "dependencies": {
    "express": "^4.18", "cors": "^2.8", "node-cron": "^3.0",
    "docxtemplater": "^3.47", "pizzip": "^3.1", "nodemailer": "^6.9"
  },
  "devDependencies": { "typescript": "^5.4", "@types/express": "^4.17", "@types/node": "^20" }
}
```
