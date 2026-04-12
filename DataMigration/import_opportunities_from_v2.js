#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - Ce script est obsolète
 *
 * Utilisez à la place:
 *   node import-master.js --file "SUIVISCLIENTS_2026_V2.xlsx" --skip-companies --skip-persons
 *
 * Ce fichier est conservé pour référence uniquement.
 * Date de dépréciation: 2026-03-03
 *
 * ============================================================================
 * ANCIEN SCRIPT: Import UNIQUEMENT des opportunities AMIPEQ depuis V2
 * Les companies et persons existent déjà
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

const EXCEL_FILE = '/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/SUIVISCLIENTS_2026_V2.xlsx';
const MAPPINGS_FILE = 'mappings.json';

console.log('🚀 Import OPPORTUNITIES depuis Excel\n');
console.log('📁 Fichier:', EXCEL_FILE);
console.log('🔗 Instance:', BASE_URL);
console.log('');

// Charger les mappings existants
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

function parseExcelDate(dateStr, defaultYear) {
  if (!dateStr || String(dateStr).trim() === '') return null;

  // Si c'est un nombre (serial number Excel)
  if (typeof dateStr === 'number') {
    // Formule: (excelDate - 25569) * 86400 * 1000
    // 25569 = jours entre 1900-01-01 (Excel) et 1970-01-01 (Unix epoch)
    // Correction pour le bug Excel (1900 non bissextile)
    const offset = dateStr > 60 ? 1 : 0;
    const unixTimestamp = (dateStr - 25569 - offset) * 86400 * 1000;
    const date = new Date(unixTimestamp);
    return date.toISOString().split('T')[0] + 'T00:00:00Z';
  }

  const str = String(dateStr).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.includes('T') ? str : `${str}T00:00:00Z`;
  }

  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  const match = str.match(/^(\d+)-([A-Za-z]+)(?:-(\d{4}))?$/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = months[monthStr];
    if (month) {
      const finalYear = year || defaultYear;
      return `${finalYear}-${month}-${day.padStart(2, '0')}T00:00:00Z`;
    }
  }

  return null;
}

function parseNorme(norme) {
  const prestations = [];
  let nature = null;    // TWENTY n'accepte que null pour naturePrestation
  let modalite = null;  // TWENTY n'accepte que null pour modalite

  if (!norme) return { prestations, nature, modalite };

  const parts = norme.split('+').map(p => p.trim());

  for (const part of parts) {
    const upper = part.toUpperCase();

    if (upper.includes('DUERP')) prestations.push('DUERP');
    if (upper.includes('FORM')) prestations.push('FORMATION');
    if (upper.includes('AUDIT')) prestations.push('AUDIT');
    // Nature DU/PU non supporté par TWENTY - reste null
    // if (upper.includes('DU')) nature = 'DU';
    // if (upper.includes('PU')) nature = 'PU';
    // Modalite DISTANCIEL/PRESENTIEL non supporté par TWENTY - reste null
    // if (upper.includes('DIST')) modalite = 'DISTANCIEL';
    // if (upper.includes('PRES')) modalite = 'PRESENTIEL';
  }

  return { prestations, nature, modalite };
}

function calculerStageEtStatut(couleurDevis, dateDevis, annee) {
  if (couleurDevis === 'VERT') {
    return { stage: 'GAGNE', statutDevis: 'GAGNE' };
  }
  if (couleurDevis === 'GRIS') {
    return { stage: 'PERDU', statutDevis: 'PERDU' };
  }
  if (couleurDevis === 'BLANC') {
    const dateDevisParsed = parseExcelDate(dateDevis, annee);
    if (dateDevisParsed) {
      const dateDevisObj = new Date(dateDevisParsed);
      const now = new Date();
      const diffJours = Math.floor((now - dateDevisObj) / (1000 * 60 * 60 * 24));
      if (diffJours > 120) {
        return { stage: 'DEVIS_ENVOYE', statutDevis: 'PERDU' };
      }
    }
    return { stage: 'DEVIS_ENVOYE', statutDevis: 'EN_ATTENTE' };
  }
  return { stage: 'DEVIS_ENVOYE', statutDevis: 'EN_ATTENTE' };
}

function getCellColor(cell) {
  if (!cell || !cell.s || !cell.s.fgColor) return 'BLANC';

  const color = cell.s.fgColor;
  const rgb = color.rgb;

  if (!rgb) return 'BLANC';

  const colorUpper = rgb.toUpperCase();

  if (colorUpper.includes('00FF00') || colorUpper.includes('00B050') || colorUpper.includes('92D050')) {
    return 'VERT';
  }

  if (colorUpper.includes('D3D3D3') || colorUpper.includes('BFBFBF') || colorUpper.includes('A6A6A6')) {
    return 'GRIS';
  }

  return 'BLANC';
}

async function checkOpportunityExists(numeroDevis) {
  if (!numeroDevis) return false;

  const query = `
    query CheckOpportunity($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        totalCount
      }
    }
  `;

  try {
    const result = await graphqlRequest(query, {
      filter: { numeroDevis: { eq: numeroDevis } }
    });
    return result.opportunities.totalCount > 0;
  } catch (error) {
    return false;
  }
}

function graphqlRequest(query, variables = {}) {
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
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function createOpportunity(oppData) {
  // Vérifier si l'opportunity existe déjà
  if (oppData.numeroDevis) {
    const exists = await checkOpportunityExists(oppData.numeroDevis);
    if (exists) {
      console.log(`  ⏭️  Skip ${oppData.numeroDevis} (existe déjà)`);
      return 'SKIPPED';
    }
  }

  const { prestations, nature, modalite } = parseNorme(oppData.norme);

  let tauxRemise = null;
  let montantRemise = null;

  if (oppData.offre1 && oppData.offre2) {
    const o1 = Number(oppData.offre1);
    const o2 = Number(oppData.offre2);
    if (o1 > 0 && o2 > 0) {
      tauxRemise = Math.round((1 - o2 / o1) * 100);
      montantRemise = {
        amountMicros: Math.round((o1 - o2) * 1000000),
        currencyCode: 'EUR'
      };
    }
  }

  const montantPrincipal = oppData.offre2 || oppData.offre1;

  const { stage, statutDevis } = calculerStageEtStatut(
    oppData.couleurDevis,
    oppData.dateDevis || oppData.date,
    oppData.annee
  );

  const companyId = mappings.companies[oppData.numeroSociete];
  if (!companyId) {
    console.log(`  ⚠️  Company ${oppData.numeroSociete} non trouvée`);
    return null;
  }

  const personKey = `${oppData.numeroSociete}|${oppData.contact}`;
  const personId = mappings.persons[personKey] || null;

  const parsedDateDevis = parseExcelDate(oppData.dateDevis || oppData.date, oppData.annee);

  const body = {
    name: oppData.numeroDevis || `${oppData.numeroSociete}-${oppData.annee}`,
    companyId,
    pointOfContactId: personId,
    amount: montantPrincipal ? {
      amountMicros: Math.round(Number(montantPrincipal) * 1000000),
      currencyCode: 'EUR'
    } : null,
    stage,
    numeroDevis: oppData.numeroDevis,
    dateDevis: parsedDateDevis,
    prestation: prestations,
    naturePrestation: nature,
    modalite,
    montantRemise,
    tauxRemise,
    statutDevis,
    anneeDevis: Number(oppData.annee),
    normeOriginale: oppData.norme,
    dateEnvoiDocs: oppData.dateDocsEnvoyes || null,
    createdAt: parsedDateDevis,  // Utiliser la date du devis comme date de création
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  const result = await restRequest('POST', '/rest/opportunities', body);

  if (result.statusCode === 201 || result.statusCode === 200) {
    return result.data.data?.createOpportunity?.id || result.data.data?.id;
  } else {
    console.log(`  ❌ Erreur ${oppData.numeroDevis}:`, JSON.stringify(result.data).substring(0, 100));
    return null;
  }
}

function readExcel() {
  console.log('📖 Lecture du fichier Excel...\n');

  const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: true });
  const sheets = ['2023', '2024', '2025', '2026'];
  const allRows = [];

  for (const sheetName of sheets) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`  ⚠️  Onglet ${sheetName} non trouvé`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (!row[2]) continue;

      const cellRef = xlsx.utils.encode_cell({ r: i, c: 8 });
      const cell = ws[cellRef];
      const couleurDevis = getCellColor(cell);

      allRows.push({
        annee: sheetName,
        numeroSociete: String(Math.floor(Number(row[2]))),
        contact: row[5] || '',
        numeroDevis: row[7] || '',
        dateDevis: row[8] || '',
        offre1: row[9] || '',
        offre2: row[10] || '',
        norme: row[11] || '',
        dateDocsEnvoyes: row[23] || '',
        couleurDevis,
        date: row[1] || ''
      });
    }

    console.log(`  ✅ ${sheetName}: ${data.length - 1} lignes`);
  }

  console.log(`\n📊 Total: ${allRows.length} opportunities\n`);
  return allRows;
}

async function main() {
  try {
    const opportunities = readExcel();

    console.log('💼 Import Opportunities...\n');
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const opp of opportunities) {
      const result = await createOpportunity(opp);
      if (result === 'SKIPPED') {
        skipped++;
      } else if (result) {
        created++;
      } else {
        errors++;
      }

      const total = created + skipped;
      if (total % 50 === 0) {
        console.log(`  Progression: ${total}/${opportunities.length} (créées: ${created}, skipped: ${skipped})`);
      }
      await sleep(650);
    }

    console.log(`\n✅ ${created} opportunities créées`);
    if (skipped > 0) {
      console.log(`⏭️  ${skipped} doublons skippés`);
    }
    if (errors > 0) {
      console.log(`⚠️  ${errors} erreurs`);
    }

    console.log('\n============================================================');
    console.log('✅ IMPORT TERMINÉ\n');
    console.log(`Opportunities: ${created} créées`);
    console.log(`Doublons:      ${skipped} skippés`);
    console.log(`Erreurs:       ${errors}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

main().catch(console.error);
