#!/usr/bin/env node
const xlsx = require('xlsx');
const fs = require('fs');

const EXCEL_FILE = 'SUIVIS CLIENTS 2026.xlsx';
const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf-8'));

console.log('🔍 IDENTIFICATION DES 8 ERREURS D\'IMPORT\n');
console.log('='.repeat(80));

const wb = xlsx.readFile(EXCEL_FILE, { cellStyles: true });
const sheets = ['2023', '2024', '2025', '2026'];

// Liste des erreurs identifiées
const errors = {
  dateInvalide: ['105081-CL-23343'],
  numeroInvalide: ['108496', '108497', '108498', '105718', '104925'],
  companyManquante: ['108621', '108673']
};

const foundErrors = [];

// Chercher dans tous les onglets
for (const sheetName of sheets) {
  if (!wb.SheetNames.includes(sheetName)) continue;

  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = String(row[7] || '').trim();
    const numeroSociete = row[2] ? String(Math.floor(Number(row[2]))) : '';

    // Vérifier si c'est une des erreurs
    let errorType = null;
    
    if (errors.dateInvalide.includes(numeroDevis)) {
      errorType = 'DATE_INVALIDE';
    } else if (errors.numeroInvalide.some(num => numeroDevis.includes(num))) {
      errorType = 'NUMERO_INVALIDE';
    } else if (errors.companyManquante.includes(numeroSociete)) {
      errorType = 'COMPANY_MANQUANTE';
    }

    if (errorType) {
      foundErrors.push({
        type: errorType,
        sheet: sheetName,
        row: i + 1, // +1 pour numéro de ligne Excel (header = 1)
        data: {
          numeroSociete: numeroSociete,
          client: row[3] || '',
          contact: row[5] || '',
          numeroDevis: numeroDevis,
          dateDevis: row[8] || '',
          offre1: row[9] || '',
          offre2: row[10] || '',
          norme: row[11] || '',
          dateDocsEnvoyes: row[23] || ''
        }
      });
    }
  }
}

console.log(`\n📋 ${foundErrors.length} erreurs trouvées sur 8 attendues\n`);
console.log('='.repeat(80));

// Grouper par type
const byType = {
  'DATE_INVALIDE': [],
  'NUMERO_INVALIDE': [],
  'COMPANY_MANQUANTE': []
};

foundErrors.forEach(err => byType[err.type].push(err));

// Afficher par catégorie
console.log('\n1️⃣  ERREUR DE DATE INVALIDE (1)\n');
console.log('-'.repeat(80));
byType.DATE_INVALIDE.forEach((err, idx) => {
  console.log(`\n📍 Ligne ${err.row} de l'onglet ${err.sheet}`);
  console.log(`   Numéro devis: ${err.data.numeroDevis}`);
  console.log(`   Company: ${err.data.numeroSociete} - ${err.data.client}`);
  console.log(`   Date devis: ${err.data.dateDevis} ⚠️ (probablement "BAIE MAHAULT")`);
  console.log(`   Contact: ${err.data.contact}`);
  console.log(`   OFFRE 1: ${err.data.offre1}`);
  console.log(`   OFFRE 2: ${err.data.offre2}`);
  console.log(`   Norme: ${err.data.norme}`);
  console.log(`\n   ✏️  ACTION: Corriger la date dans Excel (colonne I, ligne ${err.row})`);
});

console.log('\n\n2️⃣  ERREURS NUMÉRO INVALIDE (5)\n');
console.log('-'.repeat(80));
byType.NUMERO_INVALIDE.forEach((err, idx) => {
  console.log(`\n📍 Ligne ${err.row} de l'onglet ${err.sheet}`);
  console.log(`   Numéro devis: ${err.data.numeroDevis} ⚠️`);
  console.log(`   Company: ${err.data.numeroSociete} - ${err.data.client}`);
  console.log(`   Date devis: ${err.data.dateDevis}`);
  console.log(`   Contact: ${err.data.contact}`);
  console.log(`   OFFRE 1: ${err.data.offre1}`);
  console.log(`   OFFRE 2: ${err.data.offre2}`);
  console.log(`   Norme: ${err.data.norme}`);
  console.log(`\n   ✏️  ACTION: Vérifier le format du numéro (colonne H, ligne ${err.row})`);
});

console.log('\n\n3️⃣  ERREURS COMPANY MANQUANTE (2)\n');
console.log('-'.repeat(80));
byType.COMPANY_MANQUANTE.forEach((err, idx) => {
  const companyExists = mappings.companies[err.data.numeroSociete];
  console.log(`\n📍 Ligne ${err.row} de l'onglet ${err.sheet}`);
  console.log(`   Company: ${err.data.numeroSociete} - ${err.data.client} ⚠️`);
  console.log(`   Existe dans mappings: ${companyExists ? 'OUI ✅' : 'NON ❌'}`);
  console.log(`   Numéro devis: ${err.data.numeroDevis}`);
  console.log(`   Date devis: ${err.data.dateDevis}`);
  console.log(`   Contact: ${err.data.contact}`);
  console.log(`   OFFRE 1: ${err.data.offre1}`);
  console.log(`   OFFRE 2: ${err.data.offre2}`);
  console.log(`   Norme: ${err.data.norme}`);
  console.log(`\n   ✏️  ACTION: Créer la company ${err.data.numeroSociete} dans TWENTY`);
  console.log(`      ou vérifier le numéro dans Excel (colonne C, ligne ${err.row})`);
});

console.log('\n\n' + '='.repeat(80));
console.log('\n📝 RÉSUMÉ DES ACTIONS\n');
console.log('1. Date invalide (1): Corriger la date dans Excel');
console.log('2. Numéros invalides (5): Vérifier le format des numéros de devis');
console.log('3. Companies manquantes (2): Créer les companies ou corriger les numéros\n');
console.log('Une fois corrigé, relancer l\'import avec le script existant.');
console.log('La déduplication évitera les doublons.\n');

// Sauvegarder dans un fichier JSON pour référence
const errorReport = {
  date: new Date().toISOString(),
  totalErrors: foundErrors.length,
  errors: foundErrors
};

fs.writeFileSync('errors_report.json', JSON.stringify(errorReport, null, 2));
console.log('💾 Rapport sauvegardé dans: errors_report.json\n');

