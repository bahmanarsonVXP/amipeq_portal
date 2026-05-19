const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = process.env.TWENTY_BASE_URL || 'https://twenty-production-7352.up.railway.app';
const API_KEY = process.env.TWENTY_API_KEY || '';

function gqlRequest(endpoint, query) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = JSON.stringify({ query });
    const options = {
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  for (const [name, id] of [['Company', '4d4c981c-158e-45ee-8cbe-eda6d67a8eba'], ['Opportunity', '6d634f87-9c75-4b42-a0ef-ea63140fcb2a']]) {
    const r = await gqlRequest('/metadata', `{ object(id: "${id}") { fields(paging: { first: 200 }) { edges { node { name type isCustom } } } } }`);
    const custom = r.data.object.fields.edges.filter(e => e.node.isCustom);
    console.log(`\n${name} — ${custom.length} custom fields:`);
    custom.forEach(e => console.log(`  ${e.node.name} (${e.node.type})`));
  }
}
main().catch(console.error);
