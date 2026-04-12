import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

const TMP_DIR = path.join('/tmp', 'amipeq-docs');

export function startCleanupCron() {
  // Tous les jours à minuit
  cron.schedule('0 0 * * *', () => {
    console.log('[Cron] Cleaning up temp files...');
    if (!fs.existsSync(TMP_DIR)) return;

    const files = fs.readdirSync(TMP_DIR);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h

    for (const file of files) {
      const filePath = path.join(TMP_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        console.log(`[Cron] Deleted: ${file}`);
      }
    }
  });
}
