import { queryTwenty } from '../twenty';
import { createOpportunityNote } from './notes';
import { fetchOpportunityReminders, syncOpportunityRelanceDate } from './reminders';
import type { Env } from '../../index';

/**
 * R-WON-LOST : clôturer les tâches liées avec échéance (même périmètre que la liste « rappels »),
 * resynchroniser `dateRelance`, note d’audit.
 */
export async function runRWonLostAutomation(
  env: Env,
  opportunityId: string,
  terminalStage: string,
  actor: string,
): Promise<{ closedTaskCount: number }> {
  const reminders = await fetchOpportunityReminders(env, opportunityId);
  let closed = 0;
  for (const r of reminders) {
    if (r.status === 'DONE') continue;
    await queryTwenty<{ updateTask?: { id: string } | null }>(
      env,
      `
        mutation CloseRelanceTask($id: ID!) {
          updateTask(id: $id, data: { status: DONE }) {
            id
          }
        }
      `,
      { id: r.id },
    );
    closed++;
  }
  await syncOpportunityRelanceDate(env, opportunityId);
  if (closed > 0) {
    await createOpportunityNote(
      env,
      opportunityId,
      '[Portail] R-WON-LOST',
      `Clôture automatique de ${closed} tâche(s) rappel ouverte(s) suite au passage en **${terminalStage}**.\nActeur: ${actor}`,
    );
  }
  return { closedTaskCount: closed };
}
