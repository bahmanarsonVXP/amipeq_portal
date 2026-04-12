#!/usr/bin/env node
/**
 * Test de la clé API Metabase
 * Usage: node scripts/test_metabase_api.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE = (process.env.METABASE_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.METABASE_API_KEY;

if (!BASE || !API_KEY) {
  console.error('❌ Définir METABASE_BASE_URL et METABASE_API_KEY dans .env');
  process.exit(1);
}

const url = new URL(BASE);
const options = (path) => ({
  hostname: url.hostname,
  port: url.port || 443,
  path: path,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
});

function request(path) {
  return new Promise((resolve, reject) => {
    const opt = options(path);
    const req = https.request(opt, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔑 Test clé API Metabase');
  console.log('   Base URL:', BASE);
  console.log('   Clé (début):', API_KEY ? API_KEY.substring(0, 12) + '...' : '(vide)');
  console.log('');

  // 1. Utilisateur courant (ou endpoint qui nécessite auth)
  const userRes = await request('/api/user/current');
  if (userRes.statusCode === 200) {
    console.log('✅ GET /api/user/current → OK');
    console.log('   Utilisateur:', userRes.data?.email ?? userRes.data?.common_name ?? JSON.stringify(userRes.data).slice(0, 80));
  } else {
    console.log('⚠️ GET /api/user/current →', userRes.statusCode, userRes.data?.message ?? userRes.data?.errors ?? '');
  }

  // 2. Liste des bases de données
  const dbRes = await request('/api/database');
  if (dbRes.statusCode === 200 && Array.isArray(dbRes.data?.data)) {
    console.log('✅ GET /api/database → OK');
    console.log('   Bases connectées:', dbRes.data.data.length);
    dbRes.data.data.forEach((db) => console.log('   -', db.name, '(id:', db.id + ')'));
  } else {
    console.log('⚠️ GET /api/database →', dbRes.statusCode, typeof dbRes.data === 'object' ? (dbRes.data?.message || dbRes.data?.errors || '') : String(dbRes.data).slice(0, 100));
  }

  console.log('');
  console.log('Fin du test.');
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
