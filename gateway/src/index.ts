import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { companiesRoutes } from './routes/companies';
import { opportunitiesRoutes } from './routes/opportunities';
import { relancesRoutes } from './routes/relances';
import { statsRoutes } from './routes/stats';
import { documentsRoutes } from './routes/documents';

export type Env = {
  TWENTY_API_URL: string;
  TWENTY_API_KEY: string;
  BACKEND_URL: string;
  JWT_SECRET: string; // legacy if needed
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// CORS — inclure le réseau local (Next affiche souvent http://192.168.x.x:3000)
app.use('/*', cors({
  origin: (origin, c) => {
    if (!origin) return c.env.FRONTEND_URL;
    const allowed = [
      c.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
    if (allowed.includes(origin)) return origin;
    if (/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/.test(origin)) return origin;
    return '';
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Routes publiques
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes protégées
app.use('/api/*', authMiddleware);
app.get('/api/me', (c) => c.json(c.get('user')));

app.route('/api/companies', companiesRoutes);
app.route('/api/opportunities', opportunitiesRoutes);
app.route('/api/relances', relancesRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/documents', documentsRoutes);

export default app;
