import { Hono } from 'hono';
import { queryTwenty } from '../../lib/twenty';
import * as Portail from '../../lib/opportunityPortailBundle';
import {
  isTerminalStageCode,
  OPPORTUNITY_STAGES,
  stageToStatutDevis,
} from '../../lib/opportunityStages';
import { runRWonLostAutomation } from '../../lib/opportunities/automations';
import { persistPortailBundle } from '../../lib/opportunities/persistBundle';
import type { Env } from '../../index';
import { mapOpportunityContact, userLabel } from './_shared';

const app = new Hono<{ Bindings: Env }>();

app.post('/:id/status', async (c) => {
  const opportunityId = c.req.param('id');
  if (!opportunityId) return c.json({ message: 'ID requis' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { status?: string; quoteId?: string };
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
  if (!status) return c.json({ message: 'status requis' }, 400);

  const isWon = status === OPPORTUNITY_STAGES.WON || status === 'GAGNE';
  const isLost = status === OPPORTUNITY_STAGES.LOST || status === 'PERDU';

  if (isWon && quoteId) {
    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => {
        const q = b.quotes.find((x) => x.id === quoteId);
        if (!q) throw new Error('Devis inconnu.');
        return Portail.applyWonCommercialStatuses(b, quoteId);
      },
      {
        allowWhenTerminal: true,
        syncMirrorStage: false,
        syncPilotFields: true,
        terminalStage: OPPORTUNITY_STAGES.WON,
        terminalStatutDevis: 'GAGNE',
      },
    );
    let rwonlost: { closedTaskCount: number } | null = null;
    try {
      rwonlost = await runRWonLostAutomation(
        c.env,
        opportunityId,
        OPPORTUNITY_STAGES.WON,
        userLabel(c),
      );
    } catch {
      /* non bloquant */
    }
    return c.json({ success: true, stage: result.stage, bundle: result.bundle, rwonlost });
  }

  if (isTerminalStageCode(status)) {
    try {
      await persistPortailBundle(
        c.env,
        opportunityId,
        (b) => {
          if (isLost) return Portail.applyLostCommercialStatuses(b);
          if (isWon && b.pilotageId) return Portail.applyWonCommercialStatuses(b, b.pilotageId);
          if (isWon) return b;
          return b;
        },
        {
          allowWhenTerminal: true,
          syncMirrorStage: false,
          syncPilotFields: isWon,
          terminalStage: isLost ? OPPORTUNITY_STAGES.LOST : OPPORTUNITY_STAGES.WON,
          terminalStatutDevis: isLost ? 'PERDU' : 'GAGNE',
        },
      );
    } catch {
      /* bundle optionnel */
    }
  }

  const mutation = `
    mutation UpdateOpportunity($id: ID!, $stage: String!, $statutDevis: String!) {
      updateOpportunity(id: $id, data: { stage: $stage, statutDevis: $statutDevis }) { id stage statutDevis }
    }
  `;
  const statutDevis = stageToStatutDevis(status);
  const data = (await queryTwenty(c.env, mutation, {
    id: opportunityId,
    stage: status,
    statutDevis,
  })) as Record<string, unknown>;

  let rwonlost: { closedTaskCount: number } | null = null;
  if (isTerminalStageCode(status)) {
    try {
      rwonlost = await runRWonLostAutomation(c.env, opportunityId, status, userLabel(c));
    } catch {
      /* non bloquant */
    }
  }

  return c.json({ ...data, rwonlost });
});

app.patch('/:id/contact', async (c) => {
  const opportunityId = c.req.param('id');
  if (!opportunityId) return c.json({ message: 'ID requis' }, 400);

  const body = await c.req.json<{ pointOfContactId?: string | null }>();
  const pointOfContactId = body.pointOfContactId?.trim() || null;
  const contactAssignment = pointOfContactId
    ? `pointOfContactId: ${JSON.stringify(pointOfContactId)}`
    : 'pointOfContactId: null';

  try {
    const data = await queryTwenty<{
      updateOpportunity?: {
        id: string;
        pointOfContact?: {
          id: string;
          genre?: string | null;
          name?: { firstName?: string | null; lastName?: string | null } | null;
          phones?: {
            primaryPhoneNumber?: string | null;
            primaryPhoneCallingCode?: string | null;
          } | null;
          emails?: { primaryEmail?: string | null } | null;
        } | null;
      } | null;
    }>(
      c.env,
      `
        mutation UpdateOpportunityContact($id: ID!) {
          updateOpportunity(id: $id, data: { ${contactAssignment} }) {
            id
            pointOfContact {
              id
              genre
              name { firstName lastName }
              phones { primaryPhoneNumber primaryPhoneCallingCode }
              emails { primaryEmail }
            }
          }
        }
      `,
      { id: opportunityId },
    );

    const opportunity = data.updateOpportunity;
    if (!opportunity?.id) {
      return c.json({ message: "Le contact n'a pas pu être mis à jour." }, 500);
    }

    return c.json({
      success: true,
      id: opportunity.id,
      contact: mapOpportunityContact(opportunity.pointOfContact),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mise à jour du contact impossible';
    return c.json({ message }, 500);
  }
});

export { app as opportunitiesLifecycleRoutes };
