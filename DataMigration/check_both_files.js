#!/usr/bin/env node
/**
 * Comparer les deux fichiers V2 pour trouver lequel a la colonne Y
 */

const xlsx = require('xlsx');

const FILES = [
  'SUIVISCLIENTS_2026_V2.xlsx',
  'SUIVIS CLIENTS 2026_V2.xlsx'
];

for (const file of FILES) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 FICHIER: ${file}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const wb = xlsx.readFile(file);
    const sheetName = '2026';
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

    const headers = data[0];
    console.log(`Nombre de colonnes: ${headers.length}\n`);

    // Chercher "statut"
    const statutCols = headers
      .map((h, idx) => ({ header: h, index: idx }))
      .filter(col => col.header && String(col.header).toLowerCase().includes('statut'));

    if (statutCols.length > 0) {
      console.log('✅ COLONNES STATUT TROUVÉES:\n');
      statutCols.forEach(col => {
        console.log(`  Index ${col.index}: "${col.header}"`);

        // Compter les valeurs non-vides
        let nonEmpty = 0;
        for (let i = 1; i < data.length; i++) {
          if (data[i][col.index]) nonEmpty++;
        }
        console.log(`  Valeurs remplies: ${nonEmpty}/${data.length - 1}`);

        // Exemples
        console.log(`  Exemples:`);
        for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
          const val = data[i][col.index];
          if (val) console.log(`    Ligne ${i}: ${val}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ Aucune colonne "statut" trouvée');
      console.log('\nDernières colonnes:');
      for (let i = Math.max(0, headers.length - 5); i < headers.length; i++) {
        console.log(`  Index ${i}: ${headers[i] || '(vide)'}`);
      }
    }

  } catch (error) {
    console.log(`❌ Erreur: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(60));
