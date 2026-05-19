import { Hono } from 'hono';
import { queryTwenty } from '../../lib/twenty';
import {
  createOpportunityTask,
  fetchOpportunityReminders,
  parseReminderStatus,
  syncOpportunityRelanceDate,
  type ReminderStatus,
} from '../../lib/opportunities/reminders';
import type { Env } from '../../index';

const app = new Hono<{ Bindings: Env }>();

app.get('/:id/reminders', async (c) => {
  const opportunityId = c.req.param('id');
  if (!opportunityId) return c.json({ message: 'ID requis' }, 400);

  try {
    const reminders = await fetchOpportunityReminders(c.env, opportunityId);
    return c.json({ reminders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chargement des rappels impossible';
    return c.json({ message }, 500);
  }
});

app.post('/:id/reminder', async (c) => {
  const opportunityId = c.req.param('id');
  if (!opportunityId) return c.json({ message: 'ID requis' }, 400);

  const body = await c.req.json<{ date?: string; time?: string; text?: string; title?: string }>();
  const date = body.date?.trim();
  const time = body.time?.trim();
  const text = body.text?.trim();

  if (!date || !time || !text) {
    return c.json({ message: 'Les champs date, heure et texte sont requis' }, 400);
  }

  const dueAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(dueAt.getTime())) {
    return c.json({ message: 'Date/heure de relance invalide' }, 400);
  }

  const title = body.title?.trim() || `Relance opportunité ${date} ${time}`;
  let taskId: string;
  try {
    taskId = await createOpportunityTask(c.env, opportunityId, title, text, dueAt.toISOString());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Création de tâche impossible';
    return c.json({ message }, 500);
  }

  try {
    const dateRelance = await syncOpportunityRelanceDate(c.env, opportunityId);
    return c.json({
      success: true,
      id: taskId,
      dueAt: dueAt.toISOString(),
      dateRelance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synchronisation dateRelance impossible';
    return c.json({ message }, 500);
  }
});

app.patch('/:id/reminders/:taskId', async (c) => {
  const opportunityId = c.req.param('id');
  const taskId = c.req.param('taskId');
  if (!opportunityId || !taskId) return c.json({ message: 'ID requis' }, 400);

  const body = await c.req.json<{ status?: string }>();
  const status = parseReminderStatus(body.status);
  if (!status) {
    return c.json({ message: 'Statut invalide. Valeurs autorisées: TODO, IN_PROGRESS, DONE.' }, 400);
  }

  try {
    const reminders = await fetchOpportunityReminders(c.env, opportunityId);
    if (!reminders.some((reminder) => reminder.id === taskId)) {
      return c.json({ message: 'Rappel introuvable pour cette opportunité.' }, 404);
    }

    const data = await queryTwenty<{ updateTask?: { id: string; status: ReminderStatus | null } | null }>(
      c.env,
      `
        mutation UpdateReminder($id: ID!) {
          updateTask(id: $id, data: { status: ${status} }) {
            id
            status
          }
        }
      `,
      { id: taskId },
    );

    const dateRelance = await syncOpportunityRelanceDate(c.env, opportunityId);

    return c.json({
      success: true,
      reminder: {
        id: data.updateTask?.id ?? taskId,
        status: data.updateTask?.status ?? status,
      },
      dateRelance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mise à jour du rappel impossible';
    return c.json({ message }, 500);
  }
});

export { app as opportunitiesRemindersRoutes };
