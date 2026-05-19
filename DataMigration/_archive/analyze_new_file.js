#!/usr/bin/env node
const xlsx = require('xlsx');
const fs = require('fs');

console.log('🔍 ANALYSE DU NOUVEAU FICHIER\n');
console.log('='.repeat(80));

const oldFile = 'SUIVIS CLIENTS 2026.xlsx';
const newFile = '/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/SUIVISCLIENTS_2026_V2.xlsx';

// Lire les deux fichiers
const wbOld = xlsx.readFile(oldFile, { cellStyles: true });
const wbNew = xlsx.readFile(newFile, { cellStyles: true });

console.log('\n📊 Comparaison Onglet 2026:\n');

// Comparer l'onglet 2026
const wsOld2026 = wbOld.Sheets['2026'];
const wsNew2026 = wbNew.Sheets['2026'];

const dataOld2026 = xlsx.utils.sheet_to_json(wsOld2026, { header: 1, defval: '', raw: true });
const dataNew2026 = xlsx.utils.sheet_to_json(wsNew2026, { header: 1, defval: '', raw: true });

console.log(`Ancien fichier - Lignes dans 2026: ${dataOld2026.length}`);
console.log(`Nouveau fichier - Lignes dans 2026: ${dataNew2026.length}`);
console.log(`Différence: +${dataNew2026.length - dataOld2026.length} lignes\n`);

// Identifier les nouvelles companies
const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));

console.log('🏢 NOUVELLES COMPANIES (onglet 2026):\n');

const newCompanies = new Set();
const newOpportunities = [];

for (let i = 1; i < dataNew2026.length; i++) {
  const row = dataNew2026[i];
  if (!row[2]) continue; // Skip si pas de numéro société
  
  const numeroSociete = String(Math.floor(Number(row[2])));
  const client = row[3] || '';
  const numeroDevis = row[7] || '';
  
  // Vérifier si la company existe dans mappings
  if (!mappings.companies[numeroSociete] && numeroSociete) {
    newCompanies.add(JSON.stringify({
      numero: numeroSociete,
      nom: client
    }));
  }
  
  // Stocker toutes les opportunities du nouveau fichier
  if (numeroDevis) {
    newOpportunities.push({
      numeroDevis,
      numeroSociete,
      client,
      contact: row[5] || '',
      offre1: row[9] || '',
      offre2: row[10] || '',
      norme: row[11] || '',
      rowNumber: i + 1
    });
  }
}

const uniqueCompanies = Array.from(newCompanies).map(s => JSON.parse(s));
console.log(`Total nouvelles companies: ${uniqueCompanies.length}\n`);

uniqueCompanies.forEach((comp, idx) => {
  console.log(`${idx + 1}. ${comp.numero} - ${comp.nom}`);
});

console.log(`\n\n📋 NOUVELLES OPPORTUNITIES (onglet 2026):\n`);
console.log(`Total opportunities dans nouveau 2026: ${newOpportunities.length}\n`);

// Afficher les 10 premières
console.log('Premières 10 opportunities:');
newOpportunities.slice(0, 10).forEach((opp, idx) => {
  console.log(`${idx + 1}. ${opp.numeroDevis} - ${opp.client}`);
});

if (newOpportunities.length > 10) {
  console.log(`... et ${newOpportunities.length - 10} autres\n`);
}

// Sauvegarder pour référence
fs.writeFileSync('new_data_2026.json', JSON.stringify({
  newCompanies: uniqueCompanies,
  newOpportunities: newOpportunities
}, null, 2));

console.log('\n' + '='.repeat(80));
console.log('\n💾 Données sauvegardées dans: new_data_2026.json\n');

