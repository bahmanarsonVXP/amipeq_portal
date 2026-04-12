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

// CORS
app.use('/*', cors({
  origin: (origin, c) => {
    const allowed = [c.env.FRONTEND_URL, 'http://localhost:3000'];
    return allowed.includes(origin) ? origin : '';
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
