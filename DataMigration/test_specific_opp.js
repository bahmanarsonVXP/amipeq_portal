#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

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

function parseExcelDate(dateStr, defaultYear) {
  if (!dateStr || String(dateStr).trim() === '') return null;

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

async function main() {
  const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));
  
  // Lire la première ligne qui a échoué : 108122-CL-23001
  const wb = xlsx.readFile('SUIVIS CLIENTS 2026.xlsx', { cellStyles: true });
  const ws = wb.Sheets['2023'];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // Trouver la ligne avec 108122-CL-23001
  let targetRow = null;
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    const numeroDevis = data[i][7];
    if (numeroDevis === '108122-CL-23001') {
      targetRow = data[i];
      rowIndex = i;
      break;
    }
  }

  if (!targetRow) {
    console.log('❌ Ligne non trouvée');
    return;
  }

  console.log(`📋 Ligne ${rowIndex} trouvée: ${targetRow[7]}\n`);

  const oppData = {
    annee: '2023',
    numeroSociete: String(Math.floor(Number(targetRow[2]))),
    contact: targetRow[5] || '',
    numeroDevis: targetRow[7] || '',
    dateDevis: targetRow[8] || '',
    offre1: targetRow[9] || '',
    offre2: targetRow[10] || '',
    norme: targetRow[11] || '',
    dateDocsEnvoyes: targetRow[23] || '',
    date: targetRow[1] || ''
  };

  console.log('Données Excel:');
  console.log(JSON.stringify(oppData, null, 2));

  const companyId = mappings.companies[oppData.numeroSociete];
  if (!companyId) {
    console.log(`\n❌ Company ${oppData.numeroSociete} non trouvée`);
    return;
  }

  const parsedDateDevis = parseExcelDate(oppData.dateDevis || oppData.date, oppData.annee);
  console.log(`\nDate parsée: ${parsedDateDevis}`);

  const montantPrincipal = oppData.offre2 || oppData.offre1;
  
  const body = {
    name: oppData.numeroDevis,
    companyId,
    amount: montantPrincipal ? {
      amountMicros: Math.round(Number(montantPrincipal) * 1000000),
      currencyCode: 'EUR'
    } : null,
    stage: 'DEVIS_ENVOYE',
    numeroDevis: oppData.numeroDevis,
    dateDevis: parsedDateDevis,
    prestation: ['DUERP'],
    naturePrestation: null,
    modalite: null,
    statutDevis: 'EN_ATTENTE',
    anneeDevis: 2023,
    normeOriginale: oppData.norme,
    dateEnvoiDocs: oppData.dateDocsEnvoyes || null,
    createdAt: parsedDateDevis,
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  console.log('\nBody à envoyer:');
  console.log(JSON.stringify(body, null, 2));

  const result = await restRequest('POST', '/rest/opportunities', body);
  console.log(`\nStatus: ${result.statusCode}`);
  
  if (result.statusCode === 201 || result.statusCode === 200) {
    console.log('✅ Créé avec succès');
    const id = result.data.data?.createOpportunity?.id || result.data.data?.id;
    if (id) await restRequest('DELETE', `/rest/opportunities/${id}`);
  } else {
    console.log('❌ Erreur:');
    console.log(JSON.stringify(result.data, null, 2));
  }
}

main().catch(console.error);
