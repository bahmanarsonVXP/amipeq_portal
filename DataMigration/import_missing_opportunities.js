#!/usr/bin/env node
/**
 * Importer les 8 opportunités manquantes dans TWENTY
 * Utilise les données extraites de missing_opportunities_data.json
 */

const fs = require('fs');
const { processExcelRow } = require('./lib/import-core');

// Mapping statut → couleur pour compatibilité avec l'import existant
const STATUT_TO_COLOR = {
  'Gagné': 'VERT',
  'Perdu': 'GRIS',
  'En attente': 'BLANC'
};

async function main() {
  console.log('🚀 Import des 8 opportunités manquantes\n');

  // Charger les données
  const missingOpps = JSON.parse(fs.readFileSync('missing_opportunities_data.json', 'utf-8'));
  console.log(`📋 ${missingOpps.length} opportunités à importer\n`);

  const stats = {
    companies: { created: 0, existing: 0, errors: 0 },
    persons: { created: 0, existing: 0, errors: 0 },
    opportunities: { created: 0, duplicate: 0, errors: 0 }
  };

  const errors = [];

  for (let i = 0; i < missingOpps.length; i++) {
    const opp = missingOpps[i];

    console.log(`\n[${i + 1}/${missingOpps.length}] Traitement ${opp.numeroDevis}...`);
    console.log(`  Société: ${opp.nom}`);
    console.log(`  Contact: ${opp.contact}`);
    console.log(`  Statut: ${opp.statut}`);

    // Transformer les données au format attendu par processExcelRow
    const rowData = {
      numeroSociete: String(Math.floor(Number(opp.numeroSociete))),
      nom: opp.nom,
      cpRaw: opp.cp,
      contact: opp.contact,
      email: opp.email || null,
      telephone: opp.telephone || null,
      ville: opp.ville || null,
      numeroDevis: opp.numeroDevis,
      dateDevis: opp.dateDevis,
      offre1: opp.offre1,
      offre2: opp.offre2,
      norme: opp.norme,
      couleurDevis: STATUT_TO_COLOR[opp.statut] || 'BLANC',
      dateDocsEnvoyes: null
    };

    try {
      const result = await processExcelRow(rowData, opp.sheet, {
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
          numeroDevis: opp.numeroDevis,
          errors: result.errors
        });
      }

    } catch (error) {
      console.log(`  ❌ Erreur critique: ${error.message}`);
      stats.opportunities.errors++;
      errors.push({
        numeroDevis: opp.numeroDevis,
        errors: [{ entity: 'unknown', error: error.message }]
      });
    }
  }

  // Rapport final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT FINAL\n');
  console.log(`Total traité:        ${missingOpps.length}`);
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
      console.log(`${err.numeroDevis}:`);
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
