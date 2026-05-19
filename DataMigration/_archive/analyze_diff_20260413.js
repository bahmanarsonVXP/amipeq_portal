#!/usr/bin/env node
/**
 * Analyse des différences entre 20260402 et 20260413
 * Onglet 2026 uniquement
 */
const xlsx = require('xlsx');
const fs = require('fs');

const OLD_FILE = 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260402.xlsx';
const NEW_FILE = 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';
const SHEET = '2026';

// Index colonnes (0-based)
const COL_NUMERO_STE   = 2;  // C
const COL_CLIENT       = 3;  // D
const COL_CP_RAW       = 4;  // E (Titre/civilité — utilisé comme cpRaw)
const COL_CONTACT      = 5;  // F
const COL_NUMERO_DEVIS = 7;  // H
const COL_DATE_DEVIS   = 8;  // I
const COL_OFFRE1       = 9;  // J
const COL_OFFRE2       = 10; // K
const COL_NORME        = 11; // L

function getCellBgColor(ws, col, row) {
  const addr = xlsx.utils.encode_cell({ c: col, r: row });
  const cell = ws[addr];
  if (!cell || !cell.s) return null;
  const fill = cell.s.fgColor || cell.s.bgColor;
  if (!fill) return null;
  return fill.rgb || fill.theme || null;
}

function colorToStage(color) {
  if (!color) return 'EN_ATTENTE'; // blanc/null → en attente
  const c = color.toLowerCase();
  // Vert : 00B050, 92D050, etc.
  if (c.includes('00b050') || c.includes('92d050') || c.startsWith('ff00') || c === '00ff00') return 'GAGNE';
  // Gris : 808080, A6A6A6, BFBFBF, D9D9D9, etc.
  if (c.startsWith('808080') || c.startsWith('a6a6a6') || c.startsWith('bfbfbf') || c.startsWith('d9d9d9') || c.startsWith('969696')) return 'PERDU';
  // Vert Excel themes
  if (c === '4' || c === '9') return 'GAGNE'; // themes verts connus
  return null; // inconnu
}

function readSheet(filePath) {
  const wb = xlsx.readFile(filePath, { cellStyles: true, raw: true });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Onglet '${SHEET}' introuvable dans ${filePath}`);
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const map = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const nd = row[COL_NUMERO_DEVIS];
    if (!nd) continue;
    const key = String(nd).trim();
    if (!key) continue;

    // Couleur colonne H (dateDevis = index 7, row index i)
    const color = getCellBgColor(ws, COL_NUMERO_DEVIS, i);
    const stage = colorToStage(color);

    map.set(key, {
      rowNum: i + 1,
      numeroSociete: row[COL_NUMERO_STE] ? String(Math.floor(Number(row[COL_NUMERO_STE]))) : '',
      client: String(row[COL_CLIENT] || '').trim(),
      cpRaw: String(row[COL_CP_RAW] || '').trim(),
      contact: String(row[COL_CONTACT] || '').trim(),
      numeroDevis: key,
      dateDevis: row[COL_DATE_DEVIS] || '',
      offre1: row[COL_OFFRE1] !== '' ? Number(row[COL_OFFRE1]) || 0 : null,
      offre2: row[COL_OFFRE2] !== '' ? Number(row[COL_OFFRE2]) || 0 : null,
      norme: String(row[COL_NORME] || '').trim(),
      color: color,
      stage: stage,
    });
  }
  return map;
}

function montant(r) {
  // Même logique que import-master : offre2 si défini, sinon offre1
  if (r.offre2 !== null && r.offre2 !== undefined && r.offre2 !== 0) return r.offre2;
  return r.offre1 || 0;
}

console.log('='.repeat(70));
console.log('ANALYSE DIFF 20260402 → 20260413  (onglet 2026)');
console.log('='.repeat(70));

const oldMap = readSheet(OLD_FILE);
const newMap = readSheet(NEW_FILE);

console.log(`\nAncien fichier : ${oldMap.size} devis`);
console.log(`Nouveau fichier : ${newMap.size} devis`);

// 1. Nouvelles lignes
const newRows = [];
for (const [nd, row] of newMap) {
  if (!oldMap.has(nd)) newRows.push(row);
}

// 2. Changements de statut (couleur)
const statusChanges = [];
for (const [nd, newRow] of newMap) {
  const oldRow = oldMap.get(nd);
  if (!oldRow) continue;
  if (oldRow.stage !== newRow.stage && newRow.stage !== null) {
    statusChanges.push({
      numeroDevis: nd,
      client: newRow.client,
      oldStage: oldRow.stage,
      newStage: newRow.stage,
      oldColor: oldRow.color,
      newColor: newRow.color,
    });
  }
}

// 3. Changements de montants
const amountChanges = [];
for (const [nd, newRow] of newMap) {
  const oldRow = oldMap.get(nd);
  if (!oldRow) continue;
  const oldMt = montant(oldRow);
  const newMt = montant(newRow);
  // Changement significatif : différence > 0.01
  if (Math.abs(oldMt - newMt) > 0.01) {
    // On vérifie que ce n'est pas juste un passage offre2=offre1→null sans changement réel
    amountChanges.push({
      numeroDevis: nd,
      client: newRow.client,
      oldOffre1: oldRow.offre1, oldOffre2: oldRow.offre2, oldMontant: oldMt,
      newOffre1: newRow.offre1, newOffre2: newRow.offre2, newMontant: newMt,
    });
  }
}

// 4. Nouvelles companies
const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf8'));
const newCompanies = new Map();
for (const row of newRows) {
  if (row.numeroSociete && !mappings.companies[row.numeroSociete]) {
    if (!newCompanies.has(row.numeroSociete)) {
      newCompanies.set(row.numeroSociete, row.client);
    }
  }
}

// ── Rapport ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(70));
console.log(`📋 NOUVELLES LIGNES (à importer) : ${newRows.length}`);
console.log('─'.repeat(70));
newRows.forEach(r => {
  const mt = montant(r);
  console.log(`  L${r.rowNum}  ${r.numeroDevis.padEnd(22)} ${r.client.substring(0,30).padEnd(31)} ${mt > 0 ? mt + '€' : ''}`);
});

console.log('\n' + '─'.repeat(70));
console.log(`🏢 NOUVELLES COMPANIES (inconnues de mappings.json) : ${newCompanies.size}`);
console.log('─'.repeat(70));
for (const [num, nom] of newCompanies) {
  console.log(`  ${num}  ${nom}`);
}

console.log('\n' + '─'.repeat(70));
console.log(`🔄 CHANGEMENTS DE STATUT : ${statusChanges.length}`);
console.log('─'.repeat(70));
statusChanges.forEach(c => {
  console.log(`  ${c.numeroDevis.padEnd(22)} ${c.client.substring(0,28).padEnd(29)} ${c.oldStage || '?'} → ${c.newStage}  (couleur: ${c.oldColor||'null'} → ${c.newColor||'null'})`);
});

console.log('\n' + '─'.repeat(70));
console.log(`💰 CHANGEMENTS DE MONTANTS : ${amountChanges.length}`);
console.log('─'.repeat(70));
amountChanges.forEach(c => {
  console.log(`  ${c.numeroDevis.padEnd(22)} ${c.client.substring(0,28).padEnd(29)} ${c.oldMontant}€ → ${c.newMontant}€`);
});

console.log('\n' + '='.repeat(70));
console.log('RÉSUMÉ');
console.log('='.repeat(70));
console.log(`  Nouvelles opportunités à créer : ${newRows.length}`);
console.log(`  Nouvelles companies inconnues   : ${newCompanies.size}`);
console.log(`  Statuts à mettre à jour         : ${statusChanges.length}`);
console.log(`  Montants à mettre à jour        : ${amountChanges.length}`);
console.log('');
