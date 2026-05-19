import { queryTwenty } from '../twenty';
import type { Env } from '../../index';

export type ReminderStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface OpportunityReminderRecord {
  id: string;
  title: string | null;
  body: string | null;
  status: ReminderStatus;
  dueAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function textToBlocknote(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = lines.map((line) => ({
    id: crypto.randomUUID(),
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: line ? [{ type: 'text', text: line, styles: {} }] : [],
    children: [],
  }));

  return JSON.stringify(blocks);
}

export async function createOpportunityTask(
  env: Env,
  opportunityId: string,
  title: string,
  body: string,
  dueAt: string,
) {
  const createTaskMutation = `
    mutation CreateTask($title: String!, $markdown: String!, $blocknote: String!, $dueAt: DateTime!) {
      createTask(
        data: {
          title: $title
          status: TODO
          dueAt: $dueAt
          bodyV2: { markdown: $markdown, blocknote: $blocknote }
        }
      ) {
        id
      }
    }
  `;
  const linkTaskMutation = `
    mutation LinkTask($taskId: ID!, $opportunityId: ID!) {
      createTaskTarget(data: { taskId: $taskId, targetOpportunityId: $opportunityId }) {
        id
      }
    }
  `;

  const taskData = await queryTwenty<{ createTask?: { id?: string | null } | null }>(
    env,
    createTaskMutation,
    {
      title,
      markdown: body,
      blocknote: textToBlocknote(body),
      dueAt,
    },
  );
  const taskId = taskData.createTask?.id ?? null;
  if (!taskId) throw new Error("La tâche a été créée sans identifiant.");

  await queryTwenty(env, linkTaskMutation, {
    taskId,
    opportunityId,
  });

  return taskId;
}

function reminderStatusOrder(status: ReminderStatus): number {
  if (status === 'DONE') return 2;
  if (status === 'IN_PROGRESS') return 1;
  return 0;
}

export async function fetchOpportunityReminders(
  env: Env,
  opportunityId: string,
): Promise<OpportunityReminderRecord[]> {
  const query = `
    query OpportunityReminders($filter: TaskTargetFilterInput!) {
      taskTargets(filter: $filter, first: 100) {
        edges {
          node {
            id
            task {
              id
              title
              status
              dueAt
              createdAt
              updatedAt
              bodyV2 { markdown }
            }
          }
        }
      }
    }
  `;

  const data = await queryTwenty<{
    taskTargets: {
      edges: {
        node: {
          id: string;
          task: {
            id: string;
            title: string | null;
            status: ReminderStatus | null;
            dueAt: string | null;
            createdAt: string | null;
            updatedAt: string | null;
            bodyV2: { markdown?: string | null } | null;
          } | null;
        };
      }[];
    };
  }>(env, query, {
    filter: { targetOpportunityId: { eq: opportunityId } },
  });

  const remindersById = new Map<string, OpportunityReminderRecord>();

  for (const edge of data.taskTargets.edges) {
    const task = edge.node.task;
    if (!task?.id || !task.dueAt) continue;

    remindersById.set(task.id, {
      id: task.id,
      title: task.title ?? null,
      body: task.bodyV2?.markdown ?? null,
      status: task.status ?? 'TODO',
      dueAt: task.dueAt ?? null,
      createdAt: task.createdAt ?? null,
      updatedAt: task.updatedAt ?? null,
    });
  }

  return Array.from(remindersById.values()).sort((a, b) => {
    const statusCompare = reminderStatusOrder(a.status) - reminderStatusOrder(b.status);
    if (statusCompare !== 0) return statusCompare;

    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bCreated - aCreated;
  });
}

export async function syncOpportunityRelanceDate(
  env: Env,
  opportunityId: string,
): Promise<string | null> {
  const reminders = await fetchOpportunityReminders(env, opportunityId);
  const nextReminder = reminders.find((reminder) => reminder.status !== 'DONE' && reminder.dueAt);
  const nextDate = nextReminder?.dueAt ? nextReminder.dueAt.slice(0, 10) : null;

  if (nextDate) {
    await queryTwenty(
      env,
      `
        mutation SyncRelance($id: ID!, $date: Date!) {
          updateOpportunity(id: $id, data: { dateRelance: $date }) {
            id
            dateRelance
          }
        }
      `,
      { id: opportunityId, date: nextDate },
    );
  } else {
    await queryTwenty(
      env,
      `
        mutation ClearRelance($id: ID!) {
          updateOpportunity(id: $id, data: { dateRelance: null }) {
            id
            dateRelance
          }
        }
      `,
      { id: opportunityId },
    );
  }

  return nextDate;
}

export function parseReminderStatus(value: string | null | undefined): ReminderStatus | null {
  if (value === 'TODO' || value === 'IN_PROGRESS' || value === 'DONE') return value;
  return null;
}
