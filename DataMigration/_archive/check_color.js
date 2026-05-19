#!/usr/bin/env node
const xlsx = require('xlsx');
const { getCellColor } = require('./lib/parsers/excel');

const FILE = '/Users/bahmanarson/projects/AMIPEQ_CRM/DataMigration/SUIVISCLIENTS_2026_V2.xlsx';
const NUMERO_DEVIS = '109083-CL-26027';

console.log('🔍 Recherche de l\'opportunité:', NUMERO_DEVIS);
console.log('📁 Fichier:', FILE);
console.log('');

const wb = xlsx.readFile(FILE, { cellStyles: true });

let found = false;

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const numeroDevis = row[7]; // Colonne H

    if (numeroDevis === NUMERO_DEVIS) {
      found = true;

      // Extraire la couleur de la cellule colonne I (index 8)
      const cellRef = xlsx.utils.encode_cell({ r: i, c: 8 });
      const cell = ws[cellRef];

      console.log('✅ Trouvé dans l\'onglet:', sheetName);
      console.log('   Ligne:', i + 1);
      console.log('   Numéro devis:', numeroDevis);
      console.log('   Numéro société:', row[2]);
      console.log('   Nom:', row[3]);
      console.log('');

      // Informations sur la cellule
      if (cell) {
        console.log('📊 Cellule (colonne I - Date Devis):');
        console.log('   Valeur:', cell.v);

        if (cell.s && cell.s.fgColor) {
          console.log('   RGB:', cell.s.fgColor.rgb);
          console.log('   Couleur détectée:', getCellColor(cell));
        } else if (cell.s && cell.s.bgColor) {
          console.log('   BGR (background):', cell.s.bgColor.rgb);
          console.log('   Couleur détectée:', getCellColor(cell));
        } else {
          console.log('   Pas de couleur de fond');
          console.log('   Couleur détectée:', getCellColor(cell));
        }
      } else {
        console.log('⚠️  Cellule non trouvée');
      }

      console.log('');
      console.log('🎨 Interprétation:');
      const color = getCellColor(cell);
      if (color === 'VERT') {
        console.log('   Stage: GAGNE');
        console.log('   Statut: GAGNE');
      } else if (color === 'GRIS') {
        console.log('   Stage: PERDU');
        console.log('   Statut: PERDU');
      } else {
        console.log('   Stage: DEVIS_ENVOYE');
        console.log('   Statut: EN_ATTENTE (ou PERDU si > 120 jours)');
      }

      break;
    }
  }

  if (found) break;
}

if (!found) {
  console.log('❌ Opportunité non trouvée dans le fichier');
}
