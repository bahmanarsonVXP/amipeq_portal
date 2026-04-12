#!/usr/bin/env node
const xlsx = require('xlsx');

const wb = xlsx.readFile('SUIVIS CLIENTS 2026.xlsx', { cellStyles: true });
const ws = wb.Sheets['2023'];

// Lire le header
const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
const header = data[0];

console.log('📋 Headers des colonnes:\n');
header.forEach((h, idx) => {
  const colLetter = String.fromCharCode(65 + idx);
  console.log(`Colonne ${colLetter} (index ${idx}): ${h}`);
});

console.log('\n\n📍 Ligne 344 - Valeur colonne T (index 19):');
console.log('Header:', header[19]);
console.log('Valeur:', data[343][19]);

console.log('\n\n📍 Ligne 344 - Valeur colonne X (index 23):');
console.log('Header:', header[23]);
console.log('Valeur:', data[343][23]);
