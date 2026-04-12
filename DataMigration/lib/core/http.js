const https = require('https');
const rateLimiter = require('./rate-limiter');

require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

/**
 * Make a REST API request to TWENTY CRM
 * Automatically applies rate limiting (650ms between requests)
 *
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
 * @param {string} endpoint - API endpoint (e.g., '/rest/companies')
 * @param {Object|null} body - Request body (will be JSON stringified)
 * @returns {Promise<Object>} { statusCode, data }
 */
async function restRequest(method, endpoint, body = null) {
  await rateLimiter.throttle();

  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Make a GraphQL query to TWENTY CRM
 * Automatically applies rate limiting (650ms between requests)
 *
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Query result data
 */
async function graphqlRequest(query, variables = {}) {
  await rateLimiter.throttle();

  return new Promise((resolve, reject) => {
    const url = new URL('/graphql', BASE_URL);
    const payload = JSON.stringify({ query, variables });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  restRequest,
  graphqlRequest
};
