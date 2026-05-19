const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = process.env.TWENTY_BASE_URL || 'https://twenty-production-7352.up.railway.app';
const API_KEY = process.env.TWENTY_API_KEY || '';

const COMPANY_ID = '4d4c981c-158e-45ee-8cbe-eda6d67a8eba';

function gqlRequest(endpoint, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Parse error: ${body.substring(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function buildDepartmentOptions() {
  const depts = [
    ['01', 'Ain'], ['02', 'Aisne'], ['03', 'Allier'], ['04', 'Alpes-de-Haute-Provence'], ['05', 'Hautes-Alpes'],
    ['06', 'Alpes-Maritimes'], ['07', 'Ardeche'], ['08', 'Ardennes'], ['09', 'Ariege'], ['10', 'Aube'],
    ['11', 'Aude'], ['12', 'Aveyron'], ['13', 'Bouches-du-Rhone'], ['14', 'Calvados'], ['15', 'Cantal'],
    ['16', 'Charente'], ['17', 'Charente-Maritime'], ['18', 'Cher'], ['19', 'Correze'],
    ['2A', 'Corse-du-Sud'], ['2B', 'Haute-Corse'],
    ['21', 'Cote-d-Or'], ['22', 'Cotes-d-Armor'], ['23', 'Creuse'],
    ['24', 'Dordogne'], ['25', 'Doubs'], ['26', 'Drome'], ['27', 'Eure'], ['28', 'Eure-et-Loir'], ['29', 'Finistere'],
    ['30', 'Gard'], ['31', 'Haute-Garonne'], ['32', 'Gers'], ['33', 'Gironde'], ['34', 'Herault'], ['35', 'Ille-et-Vilaine'],
    ['36', 'Indre'], ['37', 'Indre-et-Loire'], ['38', 'Isere'], ['39', 'Jura'], ['40', 'Landes'], ['41', 'Loir-et-Cher'],
    ['42', 'Loire'], ['43', 'Haute-Loire'], ['44', 'Loire-Atlantique'], ['45', 'Loiret'], ['46', 'Lot'], ['47', 'Lot-et-Garonne'],
    ['48', 'Lozere'], ['49', 'Maine-et-Loire'], ['50', 'Manche'], ['51', 'Marne'], ['52', 'Haute-Marne'], ['53', 'Mayenne'],
    ['54', 'Meurthe-et-Moselle'], ['55', 'Meuse'], ['56', 'Morbihan'], ['57', 'Moselle'], ['58', 'Nievre'], ['59', 'Nord'],
    ['60', 'Oise'], ['61', 'Orne'], ['62', 'Pas-de-Calais'], ['63', 'Puy-de-Dome'], ['64', 'Pyrenees-Atlantiques'], ['65', 'Hautes-Pyrenees'],
    ['66', 'Pyrenees-Orientales'], ['67', 'Bas-Rhin'], ['68', 'Haut-Rhin'], ['69', 'Rhone'], ['70', 'Haute-Saone'], ['71', 'Saone-et-Loire'],
    ['72', 'Sarthe'], ['73', 'Savoie'], ['74', 'Haute-Savoie'], ['75', 'Paris'], ['76', 'Seine-Maritime'], ['77', 'Seine-et-Marne'],
    ['78', 'Yvelines'], ['79', 'Deux-Sevres'], ['80', 'Somme'], ['81', 'Tarn'], ['82', 'Tarn-et-Garonne'], ['83', 'Var'],
    ['84', 'Vaucluse'], ['85', 'Vendee'], ['86', 'Vienne'], ['87', 'Haute-Vienne'], ['88', 'Vosges'], ['89', 'Yonne'],
    ['90', 'Territoire de Belfort'], ['91', 'Essonne'], ['92', 'Hauts-de-Seine'], ['93', 'Seine-Saint-Denis'], ['94', 'Val-de-Marne'], ['95', 'Val-d-Oise'],
    ['971', 'Guadeloupe'], ['972', 'Martinique'], ['973', 'Guyane'], ['974', 'La Reunion']
  ];
  return depts.map(([num, name], i) => ({
    value: `DEPT_${num}_${name.toUpperCase().replace(/[- ']/g, '_').replace(/__+/g, '_')}`,
    label: `${num} - ${name}`,
    color: 'blue',
    position: i
  }));
}

async function main() {
  const options = buildDepartmentOptions();
  console.log('Sample options:', options.slice(0, 3));
  console.log(`Total: ${options.length} options`);

  const variables = {
    input: {
      field: {
        name: 'departement',
        label: 'Département',
        type: 'SELECT',
        objectMetadataId: COMPANY_ID,
        isNullable: true,
        options: options
      }
    }
  };

  const result = await gqlRequest('/metadata', `
    mutation CreateField($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id name label type
      }
    }
  `, variables);

  if (result.data && result.data.createOneField) {
    console.log(`OK: departement → id: ${result.data.createOneField.id}`);
  } else {
    console.log('ERR:', JSON.stringify(result.errors || result, null, 2).substring(0, 2000));
  }
}

main().catch(console.error);
