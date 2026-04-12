const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = process.env.TWENTY_BASE_URL || 'https://twenty-production-0500.up.railway.app';
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
  const r = await gqlRequest('/metadata', `{
    object(id: "b3d56d41-c273-46f5-b8f1-0beea4333502") {
      fields(paging: { first: 200 }) {
        edges { node { name label type isCustom } }
      }
    }
  }`);
  console.log('=== NOTE FIELDS ===');
  for (const e of r.data.object.fields.edges) {
    console.log(`  ${e.node.name} (${e.node.type}) - ${e.node.label}`);
  }

  // Also check noteTarget
  const r2 = await gqlRequest('/metadata', `{
    object(id: "3e6bcc5d-2f9e-4f4a-9da9-87dda6557189") {
      fields(paging: { first: 200 }) {
        edges { node { name label type isCustom } }
      }
    }
  }`);
  console.log('\n=== NOTE TARGET FIELDS ===');
  for (const e of r2.data.object.fields.edges) {
    console.log(`  ${e.node.name} (${e.node.type}) - ${e.node.label}`);
  }
}

main().catch(console.error);
