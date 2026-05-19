#!/usr/bin/env node
/**
 * Importer les lignes 103 et 104 de l'onglet 2026
 * Ces lignes avaient été ignorées car elles avaient le même numeroDevis
 */

const fs = require('fs');
const { processExcelRow } = require('./lib/import-core');

// Mapping statut → couleur
const STATUT_TO_COLOR = {
  'Gagné': 'VERT',
  'Perdu': 'GRIS',
  'En attente': 'BLANC'
};

async function main() {
  console.log('🚀 Import des lignes 103 et 104 (onglet 2026)\n');

  // Charger les données
  const lines = JSON.parse(fs.readFileSync('lines_103_104_data.json', 'utf-8'));
  console.log(`📋 ${lines.length} lignes à importer\n`);

  const stats = {
    companies: { created: 0, existing: 0, errors: 0 },
    persons: { created: 0, existing: 0, errors: 0 },
    opportunities: { created: 0, duplicate: 0, errors: 0 }
  };

  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    console.log(`\n[${i + 1}/${lines.length}] Ligne ${line.rowIndex} - ${line.numeroDevis}...`);
    console.log(`  Société: ${line.nom}`);
    console.log(`  Contact: ${line.contact}`);
    console.log(`  Statut: ${line.statut}`);

    // Transformer au format attendu par processExcelRow
    const rowData = {
      numeroSociete: String(Math.floor(Number(line.numeroSociete))),
      nom: line.nom,
      cpRaw: line.cp,
      contact: line.contact,
      email: line.email || null,
      telephone: line.telephone || null,
      ville: line.ville || null,
      numeroDevis: line.numeroDevis,
      dateDevis: line.dateDevis,
      offre1: line.offre1,
      offre2: line.offre2,
      norme: line.norme,
      couleurDevis: STATUT_TO_COLOR[line.statut] || 'BLANC',
      dateDocsEnvoyes: null
    };

    try {
      const result = await processExcelRow(rowData, line.sheet, {
        skipCompany: false,
        skipPerson: false,
        skipOpportunity: false,
        dryRun: false
      });

      // Mettre à jour les stats
      if (result.company) {
        if (result.company.status === 'created') {
          stats.companies.created++;
          console.log(`  ✅ Company créée: ${result.company.id}`);
        } else if (result.company.status === 'existing') {
          stats.companies.existing++;
          console.log(`  ➡️  Company existante: ${result.company.id}`);
        } else if (result.company.status === 'error') {
          stats.companies.errors++;
          console.log(`  ❌ Erreur company: ${result.company.error}`);
        }
      }

      if (result.person) {
        if (result.person.status === 'created') {
          stats.persons.created++;
          console.log(`  ✅ Person créée: ${result.person.id}`);
        } else if (result.person.status === 'existing') {
          stats.persons.existing++;
          console.log(`  ➡️  Person existante: ${result.person.id}`);
        } else if (result.person.status === 'error') {
          stats.persons.errors++;
          console.log(`  ❌ Erreur person: ${result.person.error}`);
        }
      }

      if (result.opportunity) {
        if (result.opportunity.status === 'created') {
          stats.opportunities.created++;
          console.log(`  ✅ Opportunity créée: ${result.opportunity.id}`);
        } else if (result.opportunity.status === 'duplicate') {
          stats.opportunities.duplicate++;
          console.log(`  ⏭️  Opportunity déjà existante (doublon)`);
        } else if (result.opportunity.status === 'error') {
          stats.opportunities.errors++;
          console.log(`  ❌ Erreur opportunity: ${result.opportunity.error}`);
        }
      }

      if (result.errors.length > 0) {
        errors.push({
          ligne: line.rowIndex,
          numeroDevis: line.numeroDevis,
          errors: result.errors
        });
      }

    } catch (error) {
      console.log(`  ❌ Erreur critique: ${error.message}`);
      stats.opportunities.errors++;
      errors.push({
        ligne: line.rowIndex,
        numeroDevis: line.numeroDevis,
        errors: [{ entity: 'unknown', error: error.message }]
      });
    }
  }

  // Rapport final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT FINAL\n');
  console.log(`Total traité:        ${lines.length}`);
  console.log('');
  console.log('Companies:');
  console.log(`  ✅ Créées:         ${stats.companies.created}`);
  console.log(`  ➡️  Existantes:     ${stats.companies.existing}`);
  console.log(`  ❌ Erreurs:        ${stats.companies.errors}`);
  console.log('');
  console.log('Persons:');
  console.log(`  ✅ Créées:         ${stats.persons.created}`);
  console.log(`  ➡️  Existantes:     ${stats.persons.existing}`);
  console.log(`  ❌ Erreurs:        ${stats.persons.errors}`);
  console.log('');
  console.log('Opportunities:');
  console.log(`  ✅ Créées:         ${stats.opportunities.created}`);
  console.log(`  ⏭️  Doublons:       ${stats.opportunities.duplicate}`);
  console.log(`  ❌ Erreurs:        ${stats.opportunities.errors}`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n⚠️  DÉTAILS DES ERREURS:\n');
    errors.forEach(err => {
      console.log(`Ligne ${err.ligne} - ${err.numeroDevis}:`);
      err.errors.forEach(e => {
        console.log(`  - ${e.entity}: ${e.error}`);
      });
    });
  }

  if (stats.opportunities.errors > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
