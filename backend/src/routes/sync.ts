import { Router } from 'express';
import { uploadToZeendoc } from '../services/zeendocService';

export const syncRouter = Router();

syncRouter.post('/zeendoc', async (req, res) => {
  try {
    const { documentId, filename, metadata } = req.body as {
      documentId: string;
      filename: string;
      metadata: Record<string, string>;
    };

    // TODO: récupérer le buffer du document depuis le stockage temporaire
    const buffer = Buffer.alloc(0);
    await uploadToZeendoc(buffer, filename, metadata);

    res.json({ synced: true });
  } catch (error) {
    console.error('Zeendoc sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});
