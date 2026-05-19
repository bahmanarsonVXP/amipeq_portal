#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - Ce script est obsolète
 *
 * Utilisez à la place:
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx" --sheets "2026"
 *
 * Ce fichier est conservé pour référence uniquement.
 * Date de dépréciation: 2026-03-03
 *
 * ============================================================================
 * ANCIEN SCRIPT: Import NOUVELLES COMPANIES depuis SUIVISCLIENTS_2026_V2.xlsx
 * ============================================================================
 */
const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

const NEW_FILE = '/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/SUIVISCLIENTS_2026_V2.xlsx';
const MAPPINGS_FILE = 'mappings.json';

console.log('🚀 Import NOUVELLES COMPANIES depuis SUIVISCLIENTS_2026_V2.xlsx\n');
console.log('📁 Fichier:', NEW_FILE);
console.log('🔗 Instance:', BASE_URL);
console.log('');

const mappings = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf-8'));

function restRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createCompany(companyData) {
  const body = {
    name: companyData.nom,
    numeroSociete: Number(companyData.numero),
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  const result = await restRequest('POST', '/rest/companies', body);

  if (result.statusCode === 201 || result.statusCode === 200) {
    const id = result.data.data?.createCompany?.id || result.data.data?.id;
    return id;
  } else {
    console.log(`  ❌ Erreur ${companyData.numero}:`, JSON.stringify(result.data).substring(0, 100));
    return null;
  }
}

function readNewCompanies() {
  console.log('📖 Lecture du nouveau fichier Excel...\n');

  const wb = xlsx.readFile(NEW_FILE, { cellStyles: true });
  const ws = wb.Sheets['2026'];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const newCompanies = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue;

    const numeroSociete = String(Math.floor(Number(row[2])));
    const nom = row[3] || '';

    // Vérifier si la company existe dans mappings
    if (!mappings.companies[numeroSociete] && numeroSociete && nom) {
      newCompanies.set(numeroSociete, {
        numero: numeroSociete,
        nom: nom.trim()
      });
    }
  }

  console.log(`  ✅ ${newCompanies.size} nouvelles companies identifiées\n`);
  return Array.from(newCompanies.values());
}

async function main() {
  try {
    const companies = readNewCompanies();

    console.log('🏢 Import Companies...\n');
    let created = 0;
    let errors = 0;
    const newMappings = {};

    for (const company of companies) {
      const id = await createCompany(company);
      if (id) {
        created++;
        newMappings[company.numero] = id;
        console.log(`  ✅ ${company.numero} - ${company.nom}`);
      } else {
        errors++;
      }

      if (created % 10 === 0) {
        console.log(`  Progression: ${created}/${companies.length}`);
      }
      await sleep(650);
    }

    // Mettre à jour mappings.json
    Object.assign(mappings.companies, newMappings);
    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));

    console.log(`\n✅ ${created} companies créées`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} erreurs`);
    }

    console.log('\n============================================================');
    console.log('✅ IMPORT COMPANIES TERMINÉ\n');
    console.log(`Companies: ${created} créées`);
    console.log(`Erreurs:   ${errors}`);
    console.log(`\n💾 mappings.json mis à jour avec ${created} nouvelles companies`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

main().catch(console.error);
