const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const TWENTY_URL = process.env.TWENTY_BASE_URL.replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY;

console.log('URL:', TWENTY_URL);
console.log('API Key:', API_KEY.substring(0, 20) + '...');

const query = `
  mutation UpdateOneField($idToUpdate: UUID!, $input: UpdateFieldInput!) {
    updateOneField(input: { id: $idToUpdate, update: $input }) {
      id
      label
    }
  }
`;

const variables = {
  idToUpdate: '9a5b767d-471b-48e5-9971-b7069e09b2c1',
  input: { label: 'Date de création' }
};

const body = JSON.stringify({ query, variables });
const parsedUrl = new URL(TWENTY_URL);

console.log('\nParsed URL:');
console.log('  Hostname:', parsedUrl.hostname);
console.log('  Port:', parsedUrl.port || '(default)');
console.log('  Protocol:', parsedUrl.protocol);

const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || 443,
  path: '/metadata',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }
};

console.log('\nRequest options:', JSON.stringify(options, null, 2));
console.log('\nSending request...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
  console.error('Error stack:', err.stack);
});

req.write(body);
req.end();
