import { Hono } from 'hono';
import * as Portail from '../../lib/opportunityPortailBundle';
import { readOpportunityForBundle } from '../../lib/opportunityGraphql';
import { OPPORTUNITY_STAGES } from '../../lib/opportunityStages';
import { createOpportunityNote } from '../../lib/opportunities/notes';
import { runRWonLostAutomation } from '../../lib/opportunities/automations';
import { createOpportunityTask } from '../../lib/opportunities/reminders';
import { bundleFromRecord, quoteRootFromRecord, stageFromRecord } from '../../lib/opportunities/bundleRecord';
import { persistPortailBundle } from '../../lib/opportunities/persistBundle';
import { applyQuotePatch, type QuotePatchBody } from '../../lib/opportunities/quotePatch';
import { getDevisDocument, putDevisDocument } from '../../lib/r2DevisDocuments';
import type { Env } from '../../index';
import { userLabel } from './_shared';

const app = new Hono<{ Bindings: Env }>();

app.get('/:id/portail-bundle', async (c) => {
  const opportunityId = c.req.param('id');
  const { record, status } = await readOpportunityForBundle(c.env, opportunityId);
  if (status === 404 || !record) return c.json({ message: 'Opportunité introuvable' }, 404);
  if (status < 200 || status >= 300) {
    return c.json({ message: 'Erreur lecture Twenty REST' }, 502);
  }
  const bundle = bundleFromRecord(record);
  const stage = stageFromRecord(record);
  const bcRaw = record.bonDeCommandeRef;
  const bonDeCommandeRef =
    typeof bcRaw === 'string'
      ? bcRaw
      : bcRaw && typeof bcRaw === 'object' && 'primaryLinkLabel' in (bcRaw as object)
        ? typeof (bcRaw as { primaryLinkLabel?: unknown }).primaryLinkLabel === 'string'
          ? (bcRaw as { primaryLinkLabel: string }).primaryLinkLabel
          : null
        : null;
  return c.json({
    bundle,
    stage,
    bonDeCommandeRef,
    remisePresets: [0, 5, 10, 15, 20],
  });
});

app.post('/:id/portail-bundle/quotes', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const { record, status } = await readOpportunityForBundle(c.env, opportunityId);
    if (!record || status < 200 || status >= 300) {
      return c.json({ message: 'Opportunité introuvable' }, 404);
    }
    if (Portail.isTerminalStage(stageFromRecord(record))) {
      return c.json({ message: 'Opportunité terminée : impossible d’ajouter un devis.' }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as { label?: string };
    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'Devis';
    const root = quoteRootFromRecord(record);
    let newQuoteId = '';
    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => {
        const quote = Portail.createEmptyQuote(root, b.quotes, label);
        newQuoteId = quote.id;
        return { ...b, quotes: [...b.quotes, quote] };
      },
      { syncMirrorStage: true },
    );
    return c.json({ ...result, newQuoteId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.patch('/:id/portail-bundle/pilotage', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const body = (await c.req.json().catch(() => ({}))) as { quoteId?: string };
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
    if (!quoteId) return c.json({ message: 'quoteId requis' }, 400);
    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => {
        const q = b.quotes.find((x) => x.id === quoteId);
        if (!q) throw new Error('Devis inconnu.');
        if (q.statut === 'Q_SUPERSEDED' || q.statut === 'Q_CANCELLED') {
          throw new Error('Impossible de piloter un devis annulé ou remplacé.');
        }
        return { ...b, pilotageId: quoteId };
      },
      { syncMirrorStage: true, allowWhenTerminal: true },
    );
    await createOpportunityNote(
      c.env,
      opportunityId,
      '[Portail] Pilotage modifié',
      `Nouveau devis pilotage : ${quoteId}\nUtilisateur: ${userLabel(c)}`,
    );
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.patch('/:id/portail-bundle/quotes/:quoteId', async (c) => {
  const opportunityId = c.req.param('id');
  const quoteId = c.req.param('quoteId');
  try {
    const body = (await c.req.json().catch(() => ({}))) as QuotePatchBody;
    const hasField =
      body.statut != null ||
      body.label != null ||
      body.montantBrutEur !== undefined ||
      body.tauxRemise !== undefined ||
      body.remiseTexte !== undefined ||
      body.prestations != null;
    if (!hasField) {
      return c.json({ message: 'Aucun champ à mettre à jour' }, 400);
    }
    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => {
        const q = b.quotes.find((x) => x.id === quoteId);
        if (!q) throw new Error('Devis inconnu.');
        const quotes = b.quotes.map((x) =>
          x.id === quoteId ? applyQuotePatch(x, body, b) : x,
        );
        return { ...b, quotes };
      },
      { syncMirrorStage: true, allowWhenTerminal: true },
    );
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.post('/:id/portail-bundle/mark-won', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const body = (await c.req.json().catch(() => ({}))) as { quoteId?: string };
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
    if (!quoteId) return c.json({ message: 'quoteId requis' }, 400);

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

    await createOpportunityNote(
      c.env,
      opportunityId,
      '[Portail] Affaire gagnée',
      `Devis retenu (pilotage) : ${quoteId}\nUtilisateur: ${userLabel(c)}`,
    );

    return c.json({ ...result, rwonlost });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.put('/:id/portail-bundle/quotes/:quoteId/document', async (c) => {
  const opportunityId = c.req.param('id');
  const quoteId = c.req.param('quoteId');
  try {
    const form = await c.req.formData();
    const fileEntry = form.get('file');
    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ message: 'Champ multipart « file » requis (.docx)' }, 400);
    }

    const { key, fileName } = await putDevisDocument(c.env, opportunityId, quoteId, fileEntry);
    const uploadedAt = new Date().toISOString();

    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => {
        const q = b.quotes.find((x) => x.id === quoteId);
        if (!q) throw new Error('Devis inconnu.');
        const quotes = b.quotes.map((x) =>
          x.id === quoteId
            ? {
                ...x,
                documentKey: key,
                documentFileName: fileName,
                documentUploadedAt: uploadedAt,
              }
            : x,
        );
        return { ...b, quotes };
      },
      { syncMirrorStage: false, allowWhenTerminal: true, syncPilotFields: false },
    );

    const q = result.bundle.quotes.find((x) => x.id === quoteId);
    await createOpportunityNote(
      c.env,
      opportunityId,
      `[Portail] Document devis ${q?.numero ?? quoteId}`,
      `Fichier : ${fileName}\nTéléchargement : portail AMIPEQ → opportunité → devis ${q?.numero ?? quoteId}\nUtilisateur: ${userLabel(c)}`,
    );

    return c.json({ ...result, documentKey: key, documentFileName: fileName });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.get('/:id/portail-bundle/quotes/:quoteId/document', async (c) => {
  const opportunityId = c.req.param('id');
  const quoteId = c.req.param('quoteId');
  try {
    const { record, status } = await readOpportunityForBundle(c.env, opportunityId);
    if (!record || status < 200 || status >= 300) {
      return c.json({ message: 'Opportunité introuvable' }, 404);
    }
    const bundle = bundleFromRecord(record);
    const q = bundle.quotes.find((x) => x.id === quoteId);
    if (!q?.documentKey) {
      return c.json({ message: 'Aucun document pour ce devis' }, 404);
    }
    const doc = await getDevisDocument(c.env, q.documentKey);
    if (!doc) return c.json({ message: 'Fichier introuvable dans le stockage' }, 404);
    const downloadName = q.documentFileName ?? `devis-${q.numero}.docx`;
    return new Response(doc.body, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 500);
  }
});

app.post('/:id/portail-bundle/mark-sent', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const body = (await c.req.json().catch(() => ({}))) as { quoteId?: string };
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
    if (!quoteId) return c.json({ message: 'quoteId requis' }, 400);

    const { record, status } = await readOpportunityForBundle(c.env, opportunityId);
    if (!record || status < 200 || status >= 300) {
      return c.json({ message: 'Opportunité introuvable' }, 404);
    }
    const stage = stageFromRecord(record);
    if (Portail.isTerminalStage(stage)) {
      return c.json({ message: 'Opportunité terminée' }, 400);
    }

    const initialBundle = bundleFromRecord(record);
    let pilot = initialBundle.pilotageId;
    if (!pilot && initialBundle.quotes.length === 1) {
      pilot = initialBundle.quotes[0]!.id;
    }
    if (pilot !== quoteId) {
      return c.json(
        { message: 'Seul le devis pilotage peut être marqué envoyé. Définissez le pilotage.' },
        400,
      );
    }

    const q0 = initialBundle.quotes.find((x) => x.id === quoteId);
    if (!q0) return c.json({ message: 'Devis inconnu' }, 404);
    if (q0.statut === 'Q_SUPERSEDED' || q0.statut === 'Q_CANCELLED') {
      return c.json({ message: 'Statut devis incompatible' }, 400);
    }
    if (q0.statut === 'Q_SENT') {
      return c.json({
        bundle: initialBundle,
        stage,
        alreadySent: true,
        taskId: null as string | null,
      });
    }
    if (q0.statut !== 'Q_READY_TO_SEND') {
      return c.json(
        { message: 'Le devis doit être en « prêt à envoyer » pour être marqué envoyé.' },
        400,
      );
    }

    const shouldRelanceInit = !initialBundle.standby.active && initialBundle.lastSentInitQuoteId !== quoteId;

    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (bundle) => {
        let b: Portail.PortailBundle = { ...bundle, pilotageId: bundle.pilotageId ?? quoteId };
        b = Portail.supersedeOtherSentQuotes(b, quoteId);
        const sentAt = new Date().toISOString();
        const quotes = b.quotes.map((x) => (x.id === quoteId ? { ...x, statut: 'Q_SENT' as const, sentAt } : x));
        let lastSentInitQuoteId = b.lastSentInitQuoteId;
        if (!b.standby.active && b.lastSentInitQuoteId !== quoteId) {
          lastSentInitQuoteId = quoteId;
        }
        return { ...b, quotes, lastSentInitQuoteId };
      },
      { syncMirrorStage: true, forceMirrorStage: true },
    );

    let taskId: string | null = null;
    if (shouldRelanceInit) {
      const due = new Date();
      due.setDate(due.getDate() + 2);
      taskId = await createOpportunityTask(
        c.env,
        opportunityId,
        'Relance post-envoi devis (init)',
        `Tâche automatique (R-SENT-INIT) après passage du devis pilotage en « envoyé ».\n\nquoteId: ${quoteId}\nUtilisateur: ${userLabel(c)}`,
        due.toISOString(),
      );
    }

    await createOpportunityNote(
      c.env,
      opportunityId,
      '[Portail] Devis marqué envoyé',
      `Devis ${quoteId} passé en SENT. Relance init: ${taskId ? `tâche ${taskId}` : 'aucune (standby ou idempotent)'}. Utilisateur: ${userLabel(c)}`,
    );

    return c.json({ ...result, taskId, alreadySent: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.post('/:id/portail-bundle/standby/clear', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => ({
        ...b,
        standby: { active: false, until: null, reason: null },
      }),
      { syncMirrorStage: true },
    );
    await createOpportunityNote(
      c.env,
      opportunityId,
      '[Portail] Standby levé',
      `Utilisateur: ${userLabel(c)}`,
    );
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

app.post('/:id/portail-bundle/standby', async (c) => {
  const opportunityId = c.req.param('id');
  try {
    const body = (await c.req.json().catch(() => ({}))) as { until?: string | null; reason?: string | null };
    const until = typeof body.until === 'string' ? body.until.trim() || null : body.until ?? null;
    const reason = typeof body.reason === 'string' ? body.reason.trim() || null : body.reason ?? null;
    const result = await persistPortailBundle(
      c.env,
      opportunityId,
      (b) => ({
        ...b,
        standby: { active: true, until, reason },
      }),
      { syncMirrorStage: false },
    );
    await createOpportunityNote(
      c.env,
      opportunityId,
      '[Portail] Standby activé',
      `Jusqu’au: ${until ?? '—'}\nMotif: ${reason ?? '—'}\nUtilisateur: ${userLabel(c)}`,
    );
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return c.json({ message: msg }, 400);
  }
});

export { app as opportunitiesPortailBundleRoutes };
