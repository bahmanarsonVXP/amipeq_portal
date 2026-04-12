import express from 'express';
import cors from 'cors';
import { config } from './lib/config';
import { documentsRouter } from './routes/documents';
import { webhooksRouter } from './routes/webhooks';
import { syncRouter } from './routes/sync';
import { initCronJobs } from './jobs';

const app = express();

app.use(cors({ origin: [config.gatewayUrl, 'http://localhost:8787'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/documents', documentsRouter);
app.use('/webhooks', webhooksRouter);
app.use('/sync', syncRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

initCronJobs();

app.listen(config.port, () => {
  console.log(`Backend running on port ${config.port} [${config.nodeEnv}]`);
});

export default app;
