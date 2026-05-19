import { Hono } from 'hono';
import type { Env } from '../../index';
import { opportunitiesCrudRoutes } from './crud';
import { opportunitiesReportsRoutes } from './reports';
import { opportunitiesPortailBundleRoutes } from './portail-bundle';
import { opportunitiesBonCommandeRoutes } from './bon-commande';
import { opportunitiesNotesRoutes } from './notes';
import { opportunitiesRemindersRoutes } from './reminders';
import { opportunitiesLifecycleRoutes } from './lifecycle';

const app = new Hono<{ Bindings: Env }>();

// Ordre important: routes statiques et spécialisées avant les routes /:id génériques.
app.route('/', opportunitiesCrudRoutes);
app.route('/', opportunitiesReportsRoutes);
app.route('/', opportunitiesPortailBundleRoutes);
app.route('/', opportunitiesBonCommandeRoutes);
app.route('/', opportunitiesNotesRoutes);
app.route('/', opportunitiesRemindersRoutes);
app.route('/', opportunitiesLifecycleRoutes);

export { app as opportunitiesRoutes };
