import { Router } from 'express';
import { generateQuote } from '../services/docGenerator';
import { getTwentyOpportunity } from '../lib/twenty';

export const documentsRouter = Router();

documentsRouter.post('/quote', async (req, res) => {
  try {
    const { opportunityId } = req.body as { opportunityId: string };
    const opportunity = await getTwentyOpportunity(opportunityId) as Record<string, unknown>;
    const doc = await generateQuote(opportunity);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ error: 'Échec de la génération du document' });
  }
});

documentsRouter.post('/duerp', async (req, res) => {
  try {
    const { opportunityId } = req.body as { opportunityId: string };
    const opportunity = await getTwentyOpportunity(opportunityId) as Record<string, unknown>;
    const doc = await generateQuote(opportunity); // TODO: template DUERP
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.buffer);
  } catch (error) {
    console.error('DUERP generation error:', error);
    res.status(500).json({ error: 'Échec de la génération DUERP' });
  }
});
