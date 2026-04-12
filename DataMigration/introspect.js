const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = process.env.TWENTY_BASE_URL || 'https://twenty-production-0500.up.railway.app';
const API_KEY = process.env.TWENTY_API_KEY || '';

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
        catch (e) { reject(new Error(`Parse error: ${body.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // 1. List all mutations available
  console.log('=== MUTATIONS DISPONIBLES ===');
  const mutations = await gqlRequest('/metadata', `{
    __schema {
      mutationType {
        fields { name }
      }
    }
  }`);
  const mutNames = mutations.data.__schema.mutationType.fields.map(f => f.name);
  console.log(mutNames.join('\n'));

  // 2. Get objects with their IDs
  console.log('\n=== OBJECTS ===');
  const objects = await gqlRequest('/metadata', `{
    objects(paging: { first: 100 }) {
      edges {
        node {
          id nameSingular namePlural isCustom
        }
      }
    }
  }`);
  for (const edge of objects.data.objects.edges) {
    const o = edge.node;
    console.log(`${o.nameSingular} (${o.namePlural}) - id: ${o.id} - custom: ${o.isCustom}`);
  }

  // 3. Get Company fields
  console.log('\n=== COMPANY FIELDS ===');
  const companyObj = objects.data.objects.edges.find(e => e.node.nameSingular === 'company');
  if (companyObj) {
    const fields = await gqlRequest('/metadata', `{
      object(id: "${companyObj.node.id}") {
        id nameSingular
        fields(paging: { first: 200 }) {
          edges {
            node {
              id name label type isCustom
            }
          }
        }
      }
    }`);
    for (const f of fields.data.object.fields.edges) {
      const n = f.node;
      console.log(`  ${n.name} (${n.type}) - custom: ${n.isCustom} - id: ${n.id}`);
    }
  }

  // 4. Get Opportunity fields
  console.log('\n=== OPPORTUNITY FIELDS ===');
  const oppObj = objects.data.objects.edges.find(e => e.node.nameSingular === 'opportunity');
  if (oppObj) {
    const fields = await gqlRequest('/metadata', `{
      object(id: "${oppObj.node.id}") {
        id nameSingular
        fields(paging: { first: 200 }) {
          edges {
            node {
              id name label type isCustom
            }
          }
        }
      }
    }`);
    for (const f of fields.data.object.fields.edges) {
      const n = f.node;
      console.log(`  ${n.name} (${n.type}) - custom: ${n.isCustom} - id: ${n.id}`);
    }
  }

  // 5. Introspect createOneField mutation args
  console.log('\n=== createOneField ARGS ===');
  const fieldMutation = await gqlRequest('/metadata', `{
    __type(name: "Mutation") {
      fields(includeDeprecated: true) {
        name
        args {
          name
          type {
            name kind
            inputFields {
              name
              type {
                name kind
                inputFields {
                  name
                  type { name kind ofType { name kind } }
                }
              }
            }
          }
        }
      }
    }
  }`);
  const createField = fieldMutation.data.__type.fields.find(f => f.name === 'createOneField');
  if (createField) {
    console.log(JSON.stringify(createField, null, 2));
  } else {
    console.log('createOneField not found, looking for alternatives...');
    const fieldRelated = fieldMutation.data.__type.fields.filter(f => f.name.toLowerCase().includes('field'));
    console.log(fieldRelated.map(f => f.name).join('\n'));
  }
}

main().catch(console.error);
