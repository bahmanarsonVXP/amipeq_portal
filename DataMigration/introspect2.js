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
  // Deep introspect createOneField input type
  const result = await gqlRequest('/metadata', `{
    __type(name: "CreateFieldInput") {
      name kind
      inputFields {
        name
        type {
          name kind
          ofType { name kind }
          inputFields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    }
  }`);
  console.log('=== CreateFieldInput ===');
  console.log(JSON.stringify(result, null, 2));

  // Also check FieldMetadataType enum
  const enumResult = await gqlRequest('/metadata', `{
    __type(name: "FieldMetadataType") {
      name kind
      enumValues { name }
    }
  }`);
  console.log('\n=== FieldMetadataType ===');
  console.log(JSON.stringify(enumResult, null, 2));

  // Check if there's a specific options input
  const optResult = await gqlRequest('/metadata', `{
    __type(name: "FieldMetadataDefaultValueString") {
      name kind inputFields { name type { name kind } }
    }
  }`);
  console.log('\n=== FieldMetadataDefaultValueString ===');
  console.log(JSON.stringify(optResult, null, 2));

  // Try a test field creation to see what happens
  console.log('\n=== TEST: Creating a TEXT field on Company ===');
  const testField = await gqlRequest('/metadata', `
    mutation {
      createOneField(input: {
        field: {
          name: "testField"
          label: "Test Field"
          type: TEXT
          objectMetadataId: "4d4c981c-158e-45ee-8cbe-eda6d67a8eba"
          isNullable: true
          description: "Test field - will be deleted"
        }
      }) {
        id name label type
      }
    }
  `);
  console.log(JSON.stringify(testField, null, 2));

  // Delete test field if created
  if (testField.data && testField.data.createOneField) {
    const deleteResult = await gqlRequest('/metadata', `
      mutation {
        deleteOneField(input: { id: "${testField.data.createOneField.id}" }) {
          id
        }
      }
    `);
    console.log('\n=== DELETED TEST FIELD ===');
    console.log(JSON.stringify(deleteResult, null, 2));
  }
}

main().catch(console.error);
