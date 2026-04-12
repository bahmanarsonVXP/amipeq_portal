#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED - Ce script est obsolète
 *
 * Utilisez à la place:
 *   node import-master.js --file "SUIVIS CLIENTS 2026.xlsx"
 *
 * Ce fichier est conservé pour référence uniquement.
 * Date de dépréciation: 2026-03-03
 *
 * ============================================================================
 * ANCIEN SCRIPT: Import des clients AMIPEQ depuis SUIVIS CLIENTS 2026.xlsx
 *
 * Ordre: Companies → Persons → Opportunities
 * Dédoublonnage: numeroSociete pour Companies, (numeroSociete + nom) pour Persons
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

const EXCEL_FILE = 'SUIVIS CLIENTS 2026.xlsx';
const MAPPINGS_FILE = 'mappings.json';
const LOG_FILE = 'import_log.json';

console.log('🚀 Import AMIPEQ — Clients depuis Excel\n');
console.log('📁 Fichier:', EXCEL_FILE);
console.log('🔗 Instance:', BASE_URL);
console.log('');

// ============================================================================
// UTILITAIRES HTTP
// ============================================================================

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

// ============================================================================
// PARSING DES DATES
// ============================================================================

function parseExcelDate(dateStr, defaultYear) {
  if (!dateStr || String(dateStr).trim() === '') return null;

  const str = String(dateStr).trim();

  // Format ISO déjà présent (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.includes('T') ? str : `${str}T00:00:00Z`;
  }

  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  // Format "14-Jan-2023" ou "1-Aug"
  const match = str.match(/^(\d+)-([A-Za-z]+)(?:-(\d{4}))?$/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = months[monthStr];
    if (month) {
      const finalYear = year || defaultYear; // Priorité : cellule > onglet
      return `${finalYear}-${month}-${day.padStart(2, '0')}T00:00:00Z`;
    }
  }

  return null;
}

// ============================================================================
// EXTRACTION DÉPARTEMENT
// ============================================================================

function extractDepartement(cpRaw) {
  if (!cpRaw) return { numero: null, code: null };

  const cp = String(Math.floor(Number(cpRaw))).padStart(5, '0');

  // DOM-TOM
  if (cp.startsWith('971')) return { numero: '971', code: 'DEPT_971_GUADELOUPE' };
  if (cp.startsWith('972')) return { numero: '972', code: 'DEPT_972_MARTINIQUE' };
  if (cp.startsWith('973')) return { numero: '973', code: 'DEPT_973_GUYANE' };
  if (cp.startsWith('974')) return { numero: '974', code: 'DEPT_974_LA_REUNION' };

  // Corse
  if (cp.startsWith('20')) {
    const num = parseInt(cp);
    if (num < 20200) return { numero: '2A', code: 'DEPT_2A_CORSE_DU_SUD' };
    return { numero: '2B', code: 'DEPT_2B_HAUTE_CORSE' };
  }

  // Métropole
  const dept = cp.substring(0, 2);
  const deptNames = {
    '01': 'AIN', '02': 'AISNE', '03': 'ALLIER', '04': 'ALPES_DE_HAUTE_PROVENCE',
    '05': 'HAUTES_ALPES', '06': 'ALPES_MARITIMES', '07': 'ARDECHE', '08': 'ARDENNES',
    '09': 'ARIEGE', '10': 'AUBE', '11': 'AUDE', '12': 'AVEYRON',
    '13': 'BOUCHES_DU_RHONE', '14': 'CALVADOS', '15': 'CANTAL', '16': 'CHARENTE',
    '17': 'CHARENTE_MARITIME', '18': 'CHER', '19': 'CORREZE',
    '21': 'COTE_D_OR', '22': 'COTES_D_ARMOR', '23': 'CREUSE',
    '24': 'DORDOGNE', '25': 'DOUBS', '26': 'DROME', '27': 'EURE',
    '28': 'EURE_ET_LOIR', '29': 'FINISTERE',
    '30': 'GARD', '31': 'HAUTE_GARONNE', '32': 'GERS', '33': 'GIRONDE',
    '34': 'HERAULT', '35': 'ILLE_ET_VILAINE',
    '36': 'INDRE', '37': 'INDRE_ET_LOIRE', '38': 'ISERE', '39': 'JURA',
    '40': 'LANDES', '41': 'LOIR_ET_CHER',
    '42': 'LOIRE', '43': 'HAUTE_LOIRE', '44': 'LOIRE_ATLANTIQUE', '45': 'LOIRET',
    '46': 'LOT', '47': 'LOT_ET_GARONNE',
    '48': 'LOZERE', '49': 'MAINE_ET_LOIRE', '50': 'MANCHE', '51': 'MARNE',
    '52': 'HAUTE_MARNE', '53': 'MAYENNE',
    '54': 'MEURTHE_ET_MOSELLE', '55': 'MEUSE', '56': 'MORBIHAN', '57': 'MOSELLE',
    '58': 'NIEVRE', '59': 'NORD',
    '60': 'OISE', '61': 'ORNE', '62': 'PAS_DE_CALAIS', '63': 'PUY_DE_DOME',
    '64': 'PYRENEES_ATLANTIQUES', '65': 'HAUTES_PYRENEES',
    '66': 'PYRENEES_ORIENTALES', '67': 'BAS_RHIN', '68': 'HAUT_RHIN', '69': 'RHONE',
    '70': 'HAUTE_SAONE', '71': 'SAONE_ET_LOIRE',
    '72': 'SARTHE', '73': 'SAVOIE', '74': 'HAUTE_SAVOIE', '75': 'PARIS',
    '76': 'SEINE_MARITIME', '77': 'SEINE_ET_MARNE',
    '78': 'YVELINES', '79': 'DEUX_SEVRES', '80': 'SOMME', '81': 'TARN',
    '82': 'TARN_ET_GARONNE', '83': 'VAR',
    '84': 'VAUCLUSE', '85': 'VENDEE', '86': 'VIENNE', '87': 'HAUTE_VIENNE',
    '88': 'VOSGES', '89': 'YONNE',
    '90': 'TERRITOIRE_DE_BELFORT', '91': 'ESSONNE', '92': 'HAUTS_DE_SEINE',
    '93': 'SEINE_SAINT_DENIS', '94': 'VAL_DE_MARNE', '95': 'VAL_D_OISE'
  };

  // Pour la métropole, ne pas envoyer de code (non configuré dans TWENTY)
  // Garder uniquement le numéro
  return { numero: dept, code: null };
}

// ============================================================================
// PARSING NORME
// ============================================================================

function parseNorme(raw) {
  if (!raw) return { prestations: ['DUERP'], nature: 'CREATION', modalite: null };

  let s = String(raw).trim();
  let modalite = null;
  let nature = 'CREATION';

  // 1. MODALITÉ
  if (/(?:à distance|a distance|dématérialisé|distanciel|distance)/i.test(s)) {
    modalite = 'A_DISTANCE';
    s = s.replace(/(?:à distance|a distance|dématérialisé|distanciel|distance)/gi, '');
  } else if (/(?:sur site|présentiel)/i.test(s)) {
    modalite = 'SUR_SITE';
    s = s.replace(/(?:sur site|présentiel)/gi, '');
  }
  if (/sur site ou/i.test(s)) {
    modalite = 'SUR_SITE_OU_A_DISTANCE';
    s = s.replace(/sur site ou/gi, '');
  }

  // 2. NATURE
  if (/contrat\s+maj/i.test(s)) {
    nature = 'CONTRAT_MAJ';
    s = s.replace(/contrat\s+maj/gi, '');
  } else if (/\bmaj\b/i.test(s)) {
    nature = 'MISE_A_JOUR';
    s = s.replace(/\bmaj\b/gi, '');
  }

  // 3. PRESTATIONS
  const sUpper = s.toUpperCase()
    .replace(/\+|\/|,|\-/g, ' ')
    .replace(/CLASSEUR|ET\/OU|SEUL|SS|DEVIS|SIGNES|SIGNE|CLIENT/g, '')
    .trim();

  const prestations = new Set();
  const maps = {
    'DOCUMENT UNIQUE': 'DUERP', 'DUERP': 'DUERP', 'DUER': 'DUERP', 'DUEP': 'DUERP', 'DU': 'DUERP',
    'PPMS': 'PPMS', 'PMMS': 'PPMS',
    'RPS': 'RPS', 'ENTRETIENS INDIVIDUELS': 'RPS', 'ENTRETIENS': 'RPS',
    'PSE': 'PSE', 'PLAN BLANC ET BLEU': 'PSE',
    'COVID': 'COVID', 'COVID 19': 'COVID',
    'RGPD': 'RGPD',
  };

  let temp = sUpper;
  for (const [expr, code] of Object.entries(maps).sort((a, b) => b[0].length - a[0].length)) {
    if (temp.includes(expr)) {
      prestations.add(code);
      temp = temp.replace(expr, ' ');
    }
  }

  if (prestations.size === 0) prestations.add('DUERP');

  return {
    prestations: Array.from(prestations).sort(),
    nature,
    modalite
  };
}

// ============================================================================
// LECTURE COULEUR EXCEL
// ============================================================================

function getCellColor(cell) {
  if (!cell || !cell.s) return 'BLANC';

  // Vérifier la couleur de fond (fgColor ou bgColor)
  const color = cell.s.fgColor?.rgb || cell.s.bgColor?.rgb;
  if (!color) return 'BLANC';

  const rgb = String(color).toUpperCase();

  // VERT (Gagné)
  if (rgb === 'FF92D050' || rgb === '92D050') return 'VERT';

  // GRIS (Refusé)
  if (rgb === 'FFA5A5A5' || rgb === 'A5A5A5' || rgb === 'FFBFBFBF' || rgb === 'BFBFBF' || rgb === 'FFC0C0C0' || rgb === 'C0C0C0') return 'GRIS';

  // Blanc ou autre
  return 'BLANC';
}

// ============================================================================
// CALCUL STAGE ET STATUT SELON COULEUR ET DATE
// ============================================================================

function calculerStageEtStatut(couleurDevis, dateDevis, annee) {
  // VERT → Gagné
  if (couleurDevis === 'VERT') {
    return { stage: 'GAGNE', statutDevis: 'GAGNE' };
  }

  // GRIS → Perdu
  if (couleurDevis === 'GRIS') {
    return { stage: 'PERDU', statutDevis: 'PERDU' };
  }

  // BLANC → Vérifier l'âge du devis
  if (couleurDevis === 'BLANC') {
    const dateDevisParsed = parseExcelDate(dateDevis, annee);

    if (dateDevisParsed) {
      const dateDevisObj = new Date(dateDevisParsed);
      const now = new Date();
      const diffJours = Math.floor((now - dateDevisObj) / (1000 * 60 * 60 * 24));

      // Si > 120 jours → Perdu, sinon En attente
      if (diffJours > 120) {
        return { stage: 'DEVIS_ENVOYE', statutDevis: 'PERDU' };
      }
    }

    return { stage: 'DEVIS_ENVOYE', statutDevis: 'EN_ATTENTE' };
  }

  // Par défaut
  return { stage: 'DEVIS_ENVOYE', statutDevis: 'EN_ATTENTE' };
}

// ============================================================================
// LECTURE EXCEL
// ============================================================================

function readExcel() {
  console.log('📖 Lecture du fichier Excel...\n');

  const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: true });
  const sheets = ['2023', '2024', '2025', '2026'];
  const allRows = [];

  for (const sheetName of sheets) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`  ⚠️  Onglet ${sheetName} non trouvé, ignoré`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Ignorer lignes vides
      if (!row[2]) continue; // Pas de N° Société

      // Lire couleur de la cellule I (colonne dateDevis, index 8)
      const cellRef = xlsx.utils.encode_cell({ r: i, c: 8 });
      const cell = ws[cellRef];
      const couleurDevis = getCellColor(cell);

      allRows.push({
        annee: sheetName,
        prosp: row[0] || '',
        date: row[1] || '',
        numeroSociete: String(Math.floor(Number(row[2]))),
        client: row[3] || '',
        titre: row[4] || '',
        contact: row[5] || '',
        cial: row[6] || '',
        numeroDevis: row[7] || '',
        dateDevis: row[8] || '',
        offre1: row[9] || '',
        offre2: row[10] || '',
        norme: row[11] || '',
        adresse1: row[16] || '',
        adresse2: row[17] || '',
        cp: row[18] || '',
        ville: row[19] || '',
        telephone: row[20] || '',
        relance: row[21] || '',
        email: row[22] || '',
        dateDocsEnvoyes: row[23] || '',
        couleurDevis
      });
    }

    console.log(`  ✅ ${sheetName}: ${data.length - 1} lignes`);
  }

  console.log(`\n📊 Total: ${allRows.length} lignes lues\n`);
  return allRows;
}

// ============================================================================
// DÉDOUBLONNAGE
// ============================================================================

function deduplicateData(rows) {
  console.log('🔄 Dédoublonnage...\n');

  const companiesMap = new Map();
  const personsMap = new Map();
  const opportunities = [];

  // Trier par date pour garder les infos les plus récentes en cas de doublon
  rows.sort((a, b) => {
    const dateA = a.dateDevis || a.date || '2023-01-01';
    const dateB = b.dateDevis || b.date || '2023-01-01';
    return dateA.localeCompare(dateB);
  });

  for (const row of rows) {
    const numSociete = row.numeroSociete;

    // Company (garder les données les plus récentes)
    if (!companiesMap.has(numSociete) || row.dateDevis > companiesMap.get(numSociete).dateDevis) {
      companiesMap.set(numSociete, row);
    }

    // Person (combinaison N°Sté + Contact)
    const personKey = `${numSociete}|${row.contact}`;
    if (row.contact && !personsMap.has(personKey)) {
      personsMap.set(personKey, row);
    }

    // Opportunity (pas de dédoublonnage, chaque ligne = 1 devis)
    opportunities.push(row);
  }

  console.log(`  📦 Companies: ${companiesMap.size} uniques`);
  console.log(`  👤 Persons: ${personsMap.size} uniques`);
  console.log(`  💼 Opportunities: ${opportunities.length}\n`);

  // Calculer la date de création de chaque company (= date du devis le plus ancien)
  const companies = Array.from(companiesMap.values());
  for (const company of companies) {
    const devisCompany = opportunities.filter(o => o.numeroSociete === company.numeroSociete);
    const dates = devisCompany
      .map(d => parseExcelDate(d.dateDevis || d.date, d.annee))
      .filter(d => d !== null)
      .map(d => new Date(d));

    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      company.createdAt = minDate.toISOString();
    } else {
      company.createdAt = null;
    }
  }

  return {
    companies,
    persons: Array.from(personsMap.values()),
    opportunities
  };
}

// ============================================================================
// CLASSIFICATION TYPE CLIENT
// ============================================================================

function classifyClient(name) {
  const upper = name.toUpperCase();

  let typeClient = 'AUTRE';
  let sousType = null;

  if (/COLLEGE|LYCEE|LYCÉE|ECOLE|ÉCOLE|GROUPE SCOLAIRE/.test(upper)) {
    typeClient = 'ETABLISSEMENT_SCOLAIRE';
    if (/COLLEGE/.test(upper)) sousType = 'COLLEGE';
    else if (/LYCEE|LYCÉE/.test(upper)) sousType = 'LYCEE';
    else if (/ECOLE|ÉCOLE/.test(upper)) sousType = 'ECOLE';
  } else if (/MAIRIE|COMMUNAUT|AGGLO|CC DE|CC DU/.test(upper)) {
    typeClient = 'MAIRIE_COLLECTIVITE';
    if (/MAIRIE/.test(upper)) sousType = 'MAIRIE';
    else if (/COMMUNAUT|AGGLO/.test(upper)) sousType = 'COMMUNAUTE_COMMUNES';
  } else if (/EHPAD/.test(upper)) {
    typeClient = 'AUTRE';
    sousType = 'EHPAD';
  } else {
    typeClient = 'ENTREPRISE_TPE_PME';
  }

  return { typeClient, sousType };
}

// ============================================================================
// IMPORT
// ============================================================================

const log = [];
const mappings = { companies: {}, persons: {}, opportunities: {} };

async function createCompany(companyData) {
  const dept = extractDepartement(companyData.cp);
  const { typeClient, sousType } = classifyClient(companyData.client);

  const body = {
    name: companyData.client,
    domainName: null,
    address: {
      addressStreet1: companyData.adresse1 || null,
      addressStreet2: companyData.adresse2 || null,
      addressCity: companyData.ville || null,
      addressPostcode: companyData.cp || null,
      addressCountry: 'France'
    },
    numeroSociete: Number(companyData.numeroSociete),
    typeClient,
    sousType,
    departement: dept.code,
    departementNumero: dept.numero,
    prospecteur: companyData.prosp === 'ALEX' ? 'ALEX' : (companyData.prosp === 'CL' ? 'CL' : null),
    createdAt: companyData.createdAt || new Date().toISOString(),
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
    log.push({ type: 'company', name: companyData.client, status: 'ok', id });
    mappings.companies[companyData.numeroSociete] = id;
    return id;
  } else {
    log.push({ type: 'company', name: companyData.client, status: 'error', error: JSON.stringify(result.data) });
    return null;
  }
}

async function createPerson(personData, companyId) {
  // Parser le nom : "NOM Prénom" ou "Prénom NOM"
  const contact = personData.contact.trim();
  let firstName = '';
  let lastName = contact;

  const parts = contact.split(/\s+/);
  if (parts.length >= 2) {
    // Heuristique simple: si le premier mot est en MAJ → NOM Prénom, sinon Prénom NOM
    if (parts[0] === parts[0].toUpperCase() && parts[0].length > 2) {
      lastName = parts[0];
      firstName = parts.slice(1).join(' ');
    } else {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
  }

  const body = {
    name: {
      firstName: firstName || contact,
      lastName: lastName || contact
    },
    emails: {
      primaryEmail: personData.email ? personData.email.split('/')[0].trim() : null,
      additionalEmails: []
    },
    phones: {
      primaryPhoneNumber: personData.telephone || null,
      primaryPhoneCountryCode: "FR",
      additionalPhones: []
    },
    city: personData.ville || null,
    companyId,
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  const result = await restRequest('POST', '/rest/people', body);

  if (result.statusCode === 201 || result.statusCode === 200) {
    const id = result.data.data?.createPerson?.id || result.data.data?.id;
    log.push({ type: 'person', name: contact, status: 'ok', id });
    const personKey = `${personData.numeroSociete}|${personData.contact}`;
    mappings.persons[personKey] = id;
    return id;
  } else {
    log.push({ type: 'person', name: contact, status: 'error', error: JSON.stringify(result.data) });
    return null;
  }
}

async function createOpportunity(oppData, companyId, personId) {
  const { prestations, nature, modalite } = parseNorme(oppData.norme);

  // Calculer taux de remise
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

  // Calculer stage et statutDevis selon la couleur et la date
  const { stage, statutDevis } = calculerStageEtStatut(
    oppData.couleurDevis,
    oppData.dateDevis || oppData.date,
    oppData.annee
  );

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
    dateDevis: parseExcelDate(oppData.dateDevis || oppData.date, oppData.annee),
    prestation: prestations,
    naturePrestation: nature,
    modalite,
    montantRemise,
    tauxRemise,
    statutDevis,
    anneeDevis: Number(oppData.annee),
    normeOriginale: oppData.norme,
    dateEnvoiDocs: oppData.dateDocsEnvoyes || null,
    createdBy: {
      source: "IMPORT",
      workspaceMemberId: null,
      name: "Alexandra",
      context: {}
    }
  };

  const result = await restRequest('POST', '/rest/opportunities', body);

  if (result.statusCode === 201 || result.statusCode === 200) {
    const id = result.data.data?.createOpportunity?.id || result.data.data?.id;
    log.push({ type: 'opportunity', name: oppData.numeroDevis, status: 'ok', id });
    mappings.opportunities[oppData.numeroDevis] = id;
    return id;
  } else {
    log.push({ type: 'opportunity', name: oppData.numeroDevis, status: 'error', error: JSON.stringify(result.data) });
    return null;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // 1. Lire Excel
    const rows = readExcel();

    // 2. Dédoublonner
    const { companies, persons, opportunities } = deduplicateData(rows);

    // ⚠️ MODE PRODUCTION : Import complet
    const TEST_LIMIT = null; // null = import complet
    const testCompanies = TEST_LIMIT ? companies.slice(0, TEST_LIMIT) : companies;
    if (TEST_LIMIT) {
      console.log(`\n⚠️  MODE TEST : Import limité à ${TEST_LIMIT} companies\n`);
    } else {
      console.log(`\n🚀 MODE PRODUCTION : Import de ${companies.length} companies\n`);
    }

    // 3. Importer Companies
    console.log('📦 Import Companies...\n');
    let companyCount = 0;
    for (const company of testCompanies) {
      await createCompany(company);
      companyCount++;
      if (companyCount % 10 === 0) {
        console.log(`  Progression: ${companyCount}/${companies.length}`);
      }
      await sleep(650); // Rate limiting
    }
    console.log(`  ✅ ${companyCount} companies traitées\n`);

    // Filtrer persons et opportunities pour les companies importées
    const testCompanyNums = new Set(testCompanies.map(c => c.numeroSociete));
    const testPersons = TEST_LIMIT ? persons.filter(p => testCompanyNums.has(p.numeroSociete)) : persons;
    const testOpportunities = TEST_LIMIT ? opportunities.filter(o => testCompanyNums.has(o.numeroSociete)) : opportunities;
    console.log(`  📊 ${testPersons.length} persons et ${testOpportunities.length} opportunities associées\n`);

    // 4. Importer Persons
    console.log('👤 Import Persons...\n');
    let personCount = 0;
    for (const person of testPersons) {
      const companyId = mappings.companies[person.numeroSociete];
      if (!companyId) {
        console.log(`  ⚠️  Company non trouvée pour person: ${person.contact}`);
        continue;
      }
      await createPerson(person, companyId);
      personCount++;
      if (personCount % 10 === 0) {
        console.log(`  Progression: ${personCount}/${testPersons.length}`);
      }
      await sleep(650);
    }
    console.log(`  ✅ ${personCount} persons traitées\n`);

    // 5. Importer Opportunities
    console.log('💼 Import Opportunities...\n');
    let oppCount = 0;
    for (const opp of testOpportunities) {
      const companyId = mappings.companies[opp.numeroSociete];
      const personKey = `${opp.numeroSociete}|${opp.contact}`;
      const personId = mappings.persons[personKey];

      if (!companyId) {
        console.log(`  ⚠️  Company non trouvée pour opportunity: ${opp.numeroDevis}`);
        continue;
      }

      await createOpportunity(opp, companyId, personId);
      oppCount++;
      if (oppCount % 20 === 0) {
        console.log(`  Progression: ${oppCount}/${testOpportunities.length}`);
      }
      await sleep(650);
    }
    console.log(`  ✅ ${oppCount} opportunities traitées\n`);

    // 6. Sauvegarder
    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

    // 7. Résumé
    const errors = log.filter(l => l.status === 'error');
    console.log('='.repeat(60));
    console.log('✅ IMPORT TERMINÉ\n');
    console.log(`Companies:     ${Object.keys(mappings.companies).length} créées`);
    console.log(`Persons:       ${Object.keys(mappings.persons).length} créées`);
    console.log(`Opportunities: ${Object.keys(mappings.opportunities).length} créées`);
    console.log(`Erreurs:       ${errors.length}`);
    console.log('');
    console.log(`📁 Mappings sauvegardés: ${MAPPINGS_FILE}`);
    console.log(`📝 Log détaillé: ${LOG_FILE}`);

  } catch (err) {
    console.error('\n❌ Erreur fatale:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
