import { startRelancesCron } from './relances';
import { startCleanupCron } from './cleanup';

export function initCronJobs() {
  startRelancesCron();
  startCleanupCron();
  console.log('[Cron] Jobs initialized');
}
