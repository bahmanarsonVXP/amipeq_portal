/**
 * update_adresses_nouvelles_societes.js
 *
 * Patche les adresses manquantes pour les sociétés importées via import-master.js
 * (qui ne lisait pas les colonnes 16/18/19 de l'Excel).
 *
 * Source : SUIVIS_CLIENTS_2026_20260402.xlsx, feuille 2026, lignes 132-193
 * Cible  : toutes les sociétés dont l'adresse est vide dans TWENTY
 */

const XLSX = require('xlsx');
const path = require('path');
const { graphqlRequest, restRequest } = require('./lib/core/http');
const mappings = require('./lib/core/mappings');

const EXCEL_FILE = path.join(__dirname, 'Fichiers de suivi', 'SUIVIS_CLIENTS_2026_20260402.xlsx');

// Formater le CP en 5 chiffres
function formatCP(cp) {
  if (!cp) return null;
  const n = Math.floor(Number(cp));
  if (isNaN(n) || n === 0) return null;
  return String(n).padStart(5, '0');
}

async function getCompanyAddress(id) {
  const q = `query {
    companies(filter: { id: { eq: "${id}" } }) {
      edges { node { address { addressStreet1 addressCity addressPostcode } } }
    }
  }`;
  const r = await graphqlRequest(q);
  return r.companies.edges[0]?.node?.address;
}

async function main() {
  console.log('=== PATCH ADRESSES NOUVELLES SOCIÉTÉS ===\n');

  const wb = XLSX.readFile(EXCEL_FILE, { raw: true });
  const ws = wb.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const stats = { patched: 0, alreadyHas: 0, noAddress: 0, notInCache: 0, error: 0 };
  const seen = new Set(); // dédupliquer par N° Sté

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue;

    const numeroSociete = String(Math.floor(Number(row[2])));
    if (seen.has(numeroSociete)) continue;
    seen.add(numeroSociete);

    const companyId = mappings.getCompany(numeroSociete);
    if (!companyId) {
      // Société pas dans le cache → pas importée via import-master
      stats.notInCache++;
      continue;
    }

    const adresse1 = row[16] || '';
    const cp       = formatCP(row[18]);
    const ville    = row[19] || '';

    // Pas de données d'adresse dans ce fichier pour cette société
    if (!adresse1 && !cp && !ville) {
      stats.noAddress++;
      continue;
    }

    // Vérifier si l'adresse est déjà renseignée dans TWENTY
    const existing = await getCompanyAddress(companyId);
    if (existing?.addressStreet1) {
      stats.alreadyHas++;
      continue;
    }

    const nom = String(row[3] || '').substring(0, 40).padEnd(40);
    process.stdout.write(`  ${numeroSociete} | ${nom} | ${adresse1}, ${cp} ${ville} ... `);

    try {
      const result = await restRequest('PATCH', `/rest/companies/${companyId}`, {
        address: {
          addressStreet1: adresse1 || null,
          addressCity:    ville || null,
          addressPostcode: cp || null,
          addressCountry: 'France'
        }
      });

      if (result.statusCode === 200 || result.statusCode === 201) {
        console.log('OK');
        stats.patched++;
      } else {
        console.log(`ERROR ${result.statusCode}: ${JSON.stringify(result.data).substring(0, 100)}`);
        stats.error++;
      }
    } catch (err) {
      console.log(`EXCEPTION: ${err.message}`);
      stats.error++;
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log(`  Patchées        : ${stats.patched}`);
  console.log(`  Déjà renseignée : ${stats.alreadyHas}`);
  console.log(`  Pas dans cache  : ${stats.notInCache}`);
  console.log(`  Sans adresse    : ${stats.noAddress}`);
  console.log(`  Erreurs         : ${stats.error}`);
}

main().catch(console.error);
