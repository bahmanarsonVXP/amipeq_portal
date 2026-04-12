import cron from 'node-cron';
import { queryTwenty } from '../lib/twenty';
import { sendEmail } from '../services/emailService';

export function startRelancesCron() {
  // Tous les jours à 8h
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Checking overdue relances...');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const query = `
        query OverdueRelances {
          opportunities(
            filter: {
              stage: { eq: "EN_ATTENTE" }
              dateRelance: { lte: { date: "${today}" } }
            }
            first: 100
          ) {
            edges {
              node {
                id name
                company { name }
                people { edges { node { email firstName } } }
              }
            }
          }
        }
      `;
      const data = await queryTwenty<{
        opportunities: {
          edges: {
            node: {
              id: string;
              name: string;
              company: { name: string };
              people: { edges: { node: { email?: string; firstName: string } }[] };
            };
          }[];
        };
      }>(query);

      const overdue = data.opportunities.edges;
      console.log(`[Cron] Found ${overdue.length} overdue relances`);

      // Envoyer un email de synthèse à l'équipe
      if (overdue.length > 0) {
        const list = overdue.map((e) => `- ${e.node.name} (${e.node.company.name})`).join('\n');
        await sendEmail({
          to: 'alexandra@amipeq.fr',
          subject: `[AMIPEQ] ${overdue.length} relance(s) en retard`,
          html: `<p>Bonjour,</p><p>${overdue.length} relance(s) en retard :</p><pre>${list}</pre>`,
        });
      }
    } catch (err) {
      console.error('[Cron] Relances error:', err);
    }
  });
}
