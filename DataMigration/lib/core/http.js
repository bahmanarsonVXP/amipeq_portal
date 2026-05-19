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
 * Automatically applies rate limiting and retries on LIMIT_REACHED errors.
 *
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @param {number} [retries=3] - Max retries on rate limit
 * @returns {Promise<Object>} Query result data
 */
async function graphqlRequest(query, variables = {}, retries = 3) {
  await rateLimiter.throttle();

  const data = await new Promise((resolve, reject) => {
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

  return data;
}

/**
 * Make a GraphQL query to TWENTY metadata API.
 * Reuses the same rate limiter as business queries.
 *
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} Query result data
 */
async function metadataRequest(query, variables = {}) {
  await rateLimiter.throttle();

  const data = await new Promise((resolve, reject) => {
    const url = new URL('/metadata', BASE_URL);
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

  return data;
}

// Wrapper avec retry automatique sur LIMIT_REACHED
const _graphqlRequest = graphqlRequest;
async function graphqlRequestWithRetry(query, variables = {}, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await _graphqlRequest(query, variables);
    } catch (err) {
      const isRateLimit = String(err.message).includes('LIMIT_REACHED');
      if (isRateLimit && attempt < retries - 1) {
        const wait = 65000; // 65 secondes — reset de la fenêtre 60s
        console.warn(`  ⚠️  Rate limit atteint, attente ${wait / 1000}s (tentative ${attempt + 1}/${retries - 1})...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

module.exports = {
  restRequest,
  graphqlRequest: graphqlRequestWithRetry,
  metadataRequest,
};
