#!/usr/bin/env node
/**
 * Affiche des exemples de données préparées pour l'import
 */

const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, 'SUIVIS CLIENTS 2026.xlsx');

function extractDepartement(cpRaw) {
  if (!cpRaw || String(cpRaw).trim() === '') return { numero: null, code: null };

  const cp = String(Math.floor(Number(cpRaw))).padStart(5, '0');

  // DOM-TOM (3 digits)
  if (cp.startsWith('971')) return { numero: '971', code: 'DEPT_971_GUADELOUPE' };
  if (cp.startsWith('972')) return { numero: '972', code: 'DEPT_972_MARTINIQUE' };
  if (cp.startsWith('973')) return { numero: '973', code: 'DEPT_973_GUYANE' };
  if (cp.startsWith('974')) return { numero: '974', code: 'DEPT_974_LA_REUNION' };

  // Corse
  if (cp.startsWith('20')) {
    return parseInt(cp) < 20200
      ? { numero: '2A', code: 'DEPT_2A_CORSE_DU_SUD' }
      : { numero: '2B', code: 'DEPT_2B_HAUTE_CORSE' };
  }

  // Mainland (2 digits)
  const dept = cp.substring(0, 2);
  const deptNames = {
    '01': 'AIN', '02': 'AISNE', '03': 'ALLIER', '04': 'ALPES_DE_HAUTE_PROVENCE',
    '05': 'HAUTES_ALPES', '06': 'ALPES_MARITIMES', '07': 'ARDECHE', '08': 'ARDENNES',
    '59': 'NORD', '88': 'VOSGES', '38': 'ISERE', '58': 'NIEVRE', '54': 'MEURTHE_ET_MOSELLE',
    '55': 'MEUSE', '49': 'MAINE_ET_LOIRE', '40': 'LANDES', '07': 'ARDECHE'
  };

  return {
    numero: dept,
    code: `DEPT_${dept}_${deptNames[dept] || 'UNKNOWN'}`
  };
}

function parseNorme(raw) {
  if (!raw) return { prestations: [], nature: 'CREATION', modalite: null };

  const s = String(raw).toLowerCase();

  let modalite = null;
  if (/(?:à distance|dématérialisé)/i.test(s)) modalite = 'A_DISTANCE';
  else if (/sur site/i.test(s)) modalite = 'SUR_SITE';

  let nature = 'CREATION';
  if (/contrat\s+maj/i.test(s)) nature = 'CONTRAT_MAJ';
  else if (/\bmaj\b/i.test(s)) nature = 'MISE_A_JOUR';

  const prestations = new Set();
  const maps = {
    'DOCUMENT UNIQUE': 'DUERP', 'DUERP': 'DUERP', 'DUER': 'DUERP',
    'PPMS': 'PPMS', 'RPS': 'RPS', 'PSE': 'PSE',
    'COVID': 'COVID', 'RGPD': 'RGPD'
  };

  for (const [keyword, code] of Object.entries(maps)) {
    if (s.includes(keyword.toLowerCase())) {
      prestations.add(code);
    }
  }

  return {
    prestations: Array.from(prestations),
    nature,
    modalite
  };
}

function main() {
  console.log('📊 Exemples de données d\'import\n');

  const workbook = xlsx.readFile(EXCEL_FILE);
  const sheet = workbook.Sheets['2023'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

  console.log('═══ EXEMPLES DE COMPANIES ═══\n');

  // Afficher 3 exemples variés
  const examples = [
    { idx: 1, reason: 'Example classique (métropole)' },
    { idx: 3, reason: 'Example DOM-TOM (Guadeloupe - 971)' },
    { idx: 8, reason: 'Example Martinique (972)' }
  ];

  examples.forEach(({ idx, reason }) => {
    const row = rows[idx];
    const numeroSociete = row[2] ? parseInt(row[2]) : null;
    const nom = row[3];
    const contact = row[5];
    const cp = row[18];
    const ville = row[19];
    const dept = extractDepartement(cp);
    const norme = row[11];
    const parsed = parseNorme(norme);

    console.log(`${idx}. ${reason}`);
    console.log(`   Nom: ${nom}`);
    console.log(`   N° Société: ${numeroSociete}`);
    console.log(`   Contact: ${contact}`);
    console.log(`   CP: ${cp} → Département: ${dept.numero} (${dept.code})`);
    console.log(`   Ville: ${ville}`);
    console.log(`   Norme brute: "${norme}"`);
    console.log(`   → Prestations: [${parsed.prestations.join(', ')}]`);
    console.log(`   → Nature: ${parsed.nature}`);
    console.log(`   → Modalité: ${parsed.modalite || 'N/A'}`);
    console.log('');
  });

  console.log('\n═══ EXEMPLES DÉPARTEMENTS D\'OUTRE-MER ═══\n');

  // Chercher des exemples pour chaque DOM-TOM
  const domTomExamples = [];
  for (let i = 1; i < Math.min(50, rows.length); i++) {
    const row = rows[i];
    const cp = row[18];
    if (cp) {
      const cpStr = String(cp);
      if (cpStr.startsWith('971') || cpStr.startsWith('972') ||
          cpStr.startsWith('973') || cpStr.startsWith('974')) {
        const dept = extractDepartement(cp);
        domTomExamples.push({
          nom: row[3],
          cp: cp,
          dept: dept.numero,
          ville: row[19]
        });
      }
    }
  }

  domTomExamples.slice(0, 4).forEach((ex, i) => {
    console.log(`${i + 1}. ${ex.nom}`);
    console.log(`   CP: ${ex.cp} → Département: ${ex.dept}`);
    console.log(`   Ville: ${ex.ville}`);
    console.log('');
  });
}

main();
