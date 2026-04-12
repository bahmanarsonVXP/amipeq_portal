import { Router } from 'express';
import { queryTwenty } from '../lib/twenty';

export const webhooksRouter = Router();

webhooksRouter.post('/fillout', async (req, res) => {
  try {
    const payload = req.body as Record<string, unknown>;
    console.log('Fillout webhook received:', JSON.stringify(payload, null, 2));

    // TODO: mapper les champs Fillout vers Twenty et créer/mettre à jour
    // const mutation = `mutation CreateOpportunity(...) { ... }`;
    // await queryTwenty(mutation, { ... });

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
