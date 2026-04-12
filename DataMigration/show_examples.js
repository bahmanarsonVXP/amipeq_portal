#!/usr/bin/env node
/**
 * Affiche des exemples de données importées
 */

const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

function rest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('📊 Exemples de données importées\n');

  // Companies
  console.log('═══ COMPANIES (Sociétés) ═══\n');
  try {
    const companiesResult = await rest('/rest/companies?limit=5&order_by=createdAt');
    const companies = companiesResult.data?.edges || [];

    if (companies.length === 0) {
      console.log('⚠️  Aucune company trouvée (import en cours...)\n');
    } else {
      companies.slice(0, 3).forEach((edge, i) => {
        const c = edge.node;
        console.log(`${i + 1}. ${c.name || 'Sans nom'}`);
        console.log(`   N° Société: ${c.numeroSociete || 'N/A'}`);
        console.log(`   Département: ${c.departement || 'N/A'} (${c.departementNumero || 'N/A'})`);
        console.log(`   Type: ${c.typeClient || 'N/A'}`);
        console.log(`   Adresse: ${c.addressAddressStreet1 || 'N/A'}`);
        console.log(`   CP/Ville: ${c.addressAddressPostcode || 'N/A'} ${c.addressAddressCity || 'N/A'}`);
        console.log(`   Téléphone: ${c.phone || 'N/A'}`);
        console.log('');
      });
    }
  } catch (err) {
    console.error('❌ Erreur companies:', err.message);
  }

  // Persons
  console.log('\n═══ PERSONS (Contacts) ═══\n');
  try {
    const personsResult = await rest('/rest/people?limit=5&order_by=createdAt');
    const persons = personsResult.data?.edges || [];

    if (persons.length === 0) {
      console.log('⚠️  Aucune personne trouvée (import en cours...)\n');
    } else {
      persons.slice(0, 3).forEach((edge, i) => {
        const p = edge.node;
        console.log(`${i + 1}. ${p.name?.firstName || ''} ${p.name?.lastName || 'Sans nom'}`);
        console.log(`   Email: ${p.email || 'N/A'}`);
        console.log(`   Téléphone: ${p.phone || 'N/A'}`);
        console.log(`   Entreprise: ${p.companyId || 'N/A'}`);
        console.log('');
      });
    }
  } catch (err) {
    console.error('❌ Erreur persons:', err.message);
  }

  // Opportunities
  console.log('\n═══ OPPORTUNITIES (Devis) ═══\n');
  try {
    const oppsResult = await rest('/rest/opportunities?limit=5&order_by=createdAt');
    const opps = oppsResult.data?.edges || [];

    if (opps.length === 0) {
      console.log('⚠️  Aucune opportunity trouvée (import en cours...)\n');
    } else {
      opps.slice(0, 3).forEach((edge, i) => {
        const o = edge.node;
        console.log(`${i + 1}. ${o.name || 'Sans nom'}`);
        console.log(`   N° Devis: ${o.numeroDevis || 'N/A'}`);
        console.log(`   Date: ${o.dateDevis ? new Date(o.dateDevis).toLocaleDateString('fr-FR') : 'N/A'}`);
        console.log(`   Prestations: ${o.prestation ? o.prestation.join(', ') : 'N/A'}`);
        console.log(`   Modalité: ${o.modalite || 'N/A'}`);
        console.log(`   Nature: ${o.nature || 'N/A'}`);
        console.log(`   Montant: ${o.amount?.amountMicros ? (o.amount.amountMicros / 1000000).toFixed(2) + ' €' : 'N/A'}`);
        console.log(`   Statut: ${o.statut || 'N/A'}`);
        console.log('');
      });
    }
  } catch (err) {
    console.error('❌ Erreur opportunities:', err.message);
  }

  console.log('\n✅ Fin des exemples');
}

main().catch(console.error);
