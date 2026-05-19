#!/usr/bin/env node
/**
 * Supprime un membre du workspace Twenty via l'API Metadata (mutation deleteUserFromWorkspace).
 *
 * La clé API workspace (TWENTY_API_KEY) ne suffit pas : il faut un token utilisateur
 * (session Settings) ou email + mot de passe admin.
 *
 * Usage :
 *   node delete_workspace_member.js --search "Bahman ARSON"
 *   node delete_workspace_member.js --id e9604a0d-f3c6-417c-b2a6-e70802521e2c
 *   TWENTY_EMAIL=... TWENTY_PASSWORD=... node delete_workspace_member.js --search "Bahman"
 *   TWENTY_ACCESS_TOKEN=eyJ... node delete_workspace_member.js --id <uuid>
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = (process.env.TWENTY_BASE_URL || process.env.TWENTY_API_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';
const ACCESS_TOKEN = process.env.TWENTY_ACCESS_TOKEN || '';
const EMAIL = process.env.TWENTY_EMAIL || '';
const PASSWORD = process.env.TWENTY_PASSWORD || '';

function parseArgs(argv) {
  const args = { search: null, id: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--search') args.search = argv[++i];
    else if (argv[i] === '--id') args.id = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function metadataRequest(query, variables, token) {
  const res = await fetch(`${BASE_URL}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(' | '));
  }
  return json.data;
}

async function graphqlRequest(query, variables, token) {
  const res = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(' | '));
  }
  return json.data;
}

async function getUserAccessToken() {
  if (ACCESS_TOKEN) return ACCESS_TOKEN;

  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Token utilisateur requis. Définissez TWENTY_ACCESS_TOKEN (session Twenty → DevTools → Authorization) ' +
        'ou TWENTY_EMAIL + TWENTY_PASSWORD (compte admin du workspace).',
    );
  }

  const data = await metadataRequest(
    `mutation SignIn($email: String!, $password: String!) {
      signIn(email: $email, password: $password) {
        tokens {
          accessOrWorkspaceAgnosticToken { token }
        }
      }
    }`,
    { email: EMAIL, password: PASSWORD },
    '',
  );

  const token = data?.signIn?.tokens?.accessOrWorkspaceAgnosticToken?.token;
  if (!token) throw new Error('Connexion Twenty impossible (token absent).');
  return token;
}

async function listWorkspaceMembers(token) {
  const data = await graphqlRequest(
    `query {
      workspaceMembers(first: 100) {
        edges {
          node {
            id
            userEmail
            name { firstName lastName }
          }
        }
      }
    }`,
    {},
    token || API_KEY,
  );
  return data.workspaceMembers.edges.map((e) => e.node);
}

function memberLabel(m) {
  return [m.name?.firstName, m.name?.lastName].filter(Boolean).join(' ') || m.userEmail || m.id;
}

function matchesSearch(member, search) {
  const q = search.toLocaleLowerCase('fr-FR');
  const label = memberLabel(member).toLocaleLowerCase('fr-FR');
  const email = (member.userEmail || '').toLocaleLowerCase('fr-FR');
  return label.includes(q) || email.includes(q);
}

async function deleteWorkspaceMember(token, workspaceMemberId) {
  return metadataRequest(
    `mutation DeleteUserWorkspace($workspaceMemberIdToDelete: String!) {
      deleteUserFromWorkspace(workspaceMemberIdToDelete: $workspaceMemberIdToDelete) {
        id
      }
    }`,
    { workspaceMemberIdToDelete: workspaceMemberId },
    token,
  );
}

async function main() {
  if (!BASE_URL) {
    console.error('TWENTY_BASE_URL manquant dans .env');
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const userToken = await getUserAccessToken();

  const members = await listWorkspaceMembers(userToken);
  console.log(`Membres du workspace (${members.length}) :`);
  for (const m of members) {
    console.log(`  - ${m.id} | ${memberLabel(m)} | ${m.userEmail || ''}`);
  }

  let targetId = args.id;
  if (!targetId && args.search) {
    const matches = members.filter((m) => matchesSearch(m, args.search));
    if (matches.length === 0) {
      console.error(`Aucun membre trouvé pour "${args.search}".`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error('Plusieurs membres correspondent :', matches.map(memberLabel).join(', '));
      process.exit(1);
    }
    targetId = matches[0].id;
  }

  if (!targetId) {
    console.error('Précisez --id <uuid> ou --search "nom".');
    process.exit(1);
  }

  const target = members.find((m) => m.id === targetId);
  console.log(`\nCible : ${target ? memberLabel(target) : targetId}`);

  if (args.dryRun) {
    console.log('[dry-run] Suppression non exécutée.');
    return;
  }

  const result = await deleteWorkspaceMember(userToken, targetId);
  console.log('Suppression OK :', result.deleteUserFromWorkspace);

  const remaining = await listWorkspaceMembers(userToken);
  console.log(`Membres restants : ${remaining.length}`);
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
