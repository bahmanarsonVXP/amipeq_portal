#!/usr/bin/env node
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/graphql', BASE_URL);
    const payload = JSON.stringify({ query, variables });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors, null, 2)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getSampleOpportunities() {
  const query = `
    query {
      opportunities(first: 50, orderBy: [{ createdAt: DescNullsLast }]) {
        edges {
          node {
            id
            name
            numeroDevis
            amount {
              amountMicros
              currencyCode
            }
            montantRemise {
              amountMicros
              currencyCode
            }
            tauxRemise
          }
        }
      }
    }
  `;

  const result = await graphql(query);
  return result.opportunities.edges.map(e => e.node);
}

async function main() {
  console.log('🔍 VÉRIFICATION DES MONTANTS SUR 50 OPPORTUNITIES\n');
  console.log('=' .repeat(80));

  try {
    const opportunities = await getSampleOpportunities();

    let withAmount = 0;
    let withoutAmount = 0;
    let withRemise = 0;
    let withTauxRemise = 0;

    const withoutAmountSamples = [];

    opportunities.forEach(opp => {
      const hasAmount = opp.amount && opp.amount.amountMicros > 0;
      const hasRemise = opp.montantRemise && opp.montantRemise.amountMicros > 0;
      const hasTaux = opp.tauxRemise !== null && opp.tauxRemise !== undefined;

      if (hasAmount) {
        withAmount++;
      } else {
        withoutAmount++;
        if (withoutAmountSamples.length < 10) {
          withoutAmountSamples.push(opp.numeroDevis);
        }
      }

      if (hasRemise) withRemise++;
      if (hasTaux) withTauxRemise++;
    });

    console.log(`\n📊 STATISTIQUES (sur ${opportunities.length} opportunities):\n`);
    console.log(`   Avec Amount (> 0): ${withAmount} (${Math.round((withAmount/opportunities.length)*100)}%)`);
    console.log(`   Sans Amount: ${withoutAmount} (${Math.round((withoutAmount/opportunities.length)*100)}%)`);
    console.log(`   Avec Montant Remise: ${withRemise} (${Math.round((withRemise/opportunities.length)*100)}%)`);
    console.log(`   Avec Taux Remise: ${withTauxRemise} (${Math.round((withTauxRemise/opportunities.length)*100)}%)`);

    if (withoutAmountSamples.length > 0) {
      console.log(`\n\n📋 Exemples d'opportunities SANS amount (10 premières):\n`);
      withoutAmountSamples.forEach((num, idx) => {
        console.log(`   ${idx + 1}. ${num}`);
      });
    }

    console.log('\n' + '=' .repeat(80));

    if (withoutAmount > opportunities.length / 2) {
      console.log('\n⚠️  PROBLÈME MAJEUR: Plus de 50% des opportunities n\'ont pas de montant !');
      console.log('   → Les colonnes J et K (OFFRE N° 1 et 2) ne sont probablement pas importées.');
    } else if (withoutAmount > 0) {
      console.log(`\n⚠️  ${withoutAmount} opportunities n'ont pas de montant`);
      console.log('   Cela peut être normal si certaines lignes Excel n\'ont pas d\'offre.');
    } else {
      console.log('\n✅ Toutes les opportunities ont un montant !');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main().catch(console.error);
