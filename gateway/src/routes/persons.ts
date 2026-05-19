import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import { twentyRestDelete } from '../lib/twentyRest';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();
const PEOPLE_LIST_FIRST = 5_000;

type PersonGenre = 'MONSSIEUR' | 'MADAME' | 'MADEMOISELLE';

type PersonRecord = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  genre?: string | null;
  jobTitle?: string | null;
  name?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  emails?: {
    primaryEmail?: string | null;
  } | null;
  phones?: {
    primaryPhoneNumber?: string | null;
    primaryPhoneCallingCode?: string | null;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
};

const PERSON_NODE_FIELDS = `
  id
  createdAt
  updatedAt
  genre
  jobTitle
  name { firstName lastName }
  emails { primaryEmail }
  phones { primaryPhoneNumber primaryPhoneCallingCode }
  company { id name }
`;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseGenre(value: string | null): PersonGenre | null {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLocaleUpperCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '');

  if (normalized === 'M' || normalized === 'MONSIEUR' || normalized === 'MONSSIEUR') {
    return 'MONSSIEUR';
  }
  if (normalized === 'MME' || normalized === 'MADAME') {
    return 'MADAME';
  }
  if (normalized === 'MLLE' || normalized === 'MADEMOISELLE') {
    return 'MADEMOISELLE';
  }

  return null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('fr-FR');
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function isDuplicateEntryError(message: string): boolean {
  const normalized = message.toLocaleLowerCase('fr-FR');
  return normalized.includes('duplicate entry') || normalized.includes('already exists');
}

function mapContactItem(
  person: PersonRecord,
  fallback?: {
    firstName?: string;
    lastName?: string;
    genre?: PersonGenre | null;
    email?: string | null;
    phone?: string | null;
    phoneCode?: string | null;
    jobTitle?: string | null;
    companyId?: string | null;
    companyName?: string | null;
  },
) {
  return {
    id: person.id,
    firstName: person.name?.firstName ?? fallback?.firstName ?? '',
    lastName: person.name?.lastName ?? fallback?.lastName ?? '',
    civility: person.genre ?? fallback?.genre ?? null,
    email: person.emails?.primaryEmail ?? fallback?.email ?? null,
    phone: person.phones?.primaryPhoneNumber ?? fallback?.phone ?? null,
    phoneCode: person.phones?.primaryPhoneCallingCode ?? fallback?.phoneCode ?? null,
    jobTitle: person.jobTitle ?? fallback?.jobTitle ?? null,
    companyId: person.company?.id ?? fallback?.companyId ?? null,
    companyName: person.company?.name ?? fallback?.companyName ?? null,
    createdAt: person.createdAt ?? null,
    updatedAt: person.updatedAt ?? null,
  };
}

function mapPersonPayload(
  person: PersonRecord,
  fallback: {
    firstName: string;
    lastName: string;
    genre: PersonGenre | null;
    email: string | null;
    phone: string | null;
    phoneCode: string | null;
    jobTitle: string | null;
    companyId: string;
  },
) {
  return mapContactItem(person, fallback);
}

function filterContactsBySearch<
  T extends {
    firstName: string;
    lastName: string;
    email?: string | null;
    companyName?: string | null;
    jobTitle?: string | null;
  },
>(contacts: T[], search: string): T[] {
  if (!search) return contacts;
  const q = search.toLocaleLowerCase('fr-FR');
  return contacts.filter((contact) => {
    const haystack = [
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.companyName,
      contact.jobTitle,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fr-FR');
    return haystack.includes(q);
  });
}

async function fetchAllPeople(env: Env): Promise<PersonRecord[]> {
  const query = `
    query PeopleList($first: Int!) {
      people(first: $first, orderBy: { updatedAt: DescNullsLast }) {
        edges {
          node {
            ${PERSON_NODE_FIELDS}
          }
        }
      }
    }
  `;
  const data = await queryTwenty<{
    people: { edges: { node: PersonRecord }[] };
  }>(env, query, { first: PEOPLE_LIST_FIRST });

  return data.people.edges.map((edge) => edge.node);
}

async function fetchPersonById(env: Env, id: string): Promise<PersonRecord | null> {
  const query = `
    query PersonById($filter: PersonFilterInput!) {
      people(filter: $filter, first: 1) {
        edges {
          node {
            ${PERSON_NODE_FIELDS}
          }
        }
      }
    }
  `;
  const data = await queryTwenty<{
    people: { edges: { node: PersonRecord }[] };
  }>(env, query, {
    filter: { id: { eq: id } },
  });

  return data.people.edges[0]?.node ?? null;
}

async function deletePersonViaGraphql(env: Env, id: string): Promise<boolean> {
  const mutation = `
    mutation DeletePerson($filter: PersonFilterInput!) {
      deletePeople(filter: $filter) {
        id
      }
    }
  `;
  const data = await queryTwenty<{
    deletePeople?: { id: string }[] | null;
  }>(env, mutation, { filter: { id: { eq: id } } });
  return Array.isArray(data.deletePeople) && data.deletePeople.length > 0;
}

function buildUpdatePersonMutation(
  id: string,
  data: {
    firstName: string;
    lastName: string;
    genre: PersonGenre | null;
    email: string | null;
    phone: string | null;
    phoneCode: string;
    jobTitle: string | null;
    companyId: string;
  },
): string {
  const fields = [
    `name: {
      firstName: ${JSON.stringify(data.firstName)}
      lastName: ${JSON.stringify(data.lastName)}
    }`,
    `companyId: ${JSON.stringify(data.companyId)}`,
    data.genre ? `genre: ${data.genre}` : 'genre: null',
    data.jobTitle ? `jobTitle: ${JSON.stringify(data.jobTitle)}` : 'jobTitle: null',
    data.email
      ? `emails: { primaryEmail: ${JSON.stringify(data.email)} }`
      : 'emails: { primaryEmail: null }',
    data.phone
      ? `phones: {
          primaryPhoneNumber: ${JSON.stringify(data.phone)}
          primaryPhoneCallingCode: ${JSON.stringify(data.phoneCode)}
        }`
      : `phones: {
          primaryPhoneNumber: null
          primaryPhoneCallingCode: ${JSON.stringify(data.phoneCode)}
        }`,
  ];

  return `
    mutation UpdatePerson {
      updatePerson(
        id: ${JSON.stringify(id)}
        data: {
          ${fields.join('\n          ')}
        }
      ) {
        ${PERSON_NODE_FIELDS}
      }
    }
  `;
}

function isMatchingPerson(
  person: PersonRecord,
  criteria: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  },
): boolean {
  const candidateEmail = normalizeText(person.emails?.primaryEmail);
  const targetEmail = normalizeText(criteria.email);
  if (candidateEmail && targetEmail && candidateEmail === targetEmail) return true;

  const candidatePhone = normalizePhone(person.phones?.primaryPhoneNumber);
  const targetPhone = normalizePhone(criteria.phone);
  if (candidatePhone && targetPhone && candidatePhone === targetPhone) return true;

  const candidateFirstName = normalizeText(person.name?.firstName);
  const candidateLastName = normalizeText(person.name?.lastName);
  const targetFirstName = normalizeText(criteria.firstName);
  const targetLastName = normalizeText(criteria.lastName);

  if (candidateLastName && targetLastName && candidateLastName === targetLastName) {
    if (!targetFirstName || candidateFirstName === targetFirstName) return true;
  }

  return false;
}

async function findPeopleByCompany(env: Env, companyId: string): Promise<PersonRecord[]> {
  const query = `
    query PeopleByCompany($filter: PersonFilterInput!, $first: Int!) {
      people(filter: $filter, first: $first) {
        edges {
          node {
            id
            genre
            jobTitle
            name { firstName lastName }
            emails { primaryEmail }
            phones { primaryPhoneNumber primaryPhoneCallingCode }
          }
        }
      }
    }
  `;
  const data = await queryTwenty<{
    people: {
      edges: {
        node: PersonRecord;
      }[];
    };
  }>(env, query, {
    filter: { companyId: { eq: companyId } },
    first: 100,
  });

  return data.people.edges.map((edge) => edge.node);
}

async function hasGlobalEmailConflict(env: Env, email: string): Promise<boolean> {
  const query = `
    query FindByEmail($filter: PersonFilterInput!) {
      people(filter: $filter, first: 1) {
        edges { node { id } }
      }
    }
  `;
  const data = await queryTwenty<{
    people: {
      edges: {
        node: { id: string };
      }[];
    };
  }>(env, query, {
    filter: { emails: { primaryEmail: { eq: email } } },
  });

  return data.people.edges.length > 0;
}

app.get('/', async (c) => {
  const search = clean(c.req.query('search')) ?? '';

  try {
    const people = await fetchAllPeople(c.env);
    const contacts = filterContactsBySearch(people.map((person) => mapContactItem(person)), search);
    return c.json({ contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chargement des contacts impossible';
    return c.json({ message }, 500);
  }
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ message: 'ID requis' }, 400);

  try {
    const person = await fetchPersonById(c.env, id);
    if (!person) return c.json({ message: 'Contact introuvable' }, 404);
    return c.json({ contact: mapContactItem(person) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chargement du contact impossible';
    return c.json({ message }, 500);
  }
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ message: 'ID requis' }, 400);

  const body = await c.req.json<{
    companyId?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    phoneCode?: string | null;
    civility?: string | null;
    jobTitle?: string | null;
  }>();

  const companyId = clean(body.companyId);
  const firstName = clean(body.firstName) ?? '';
  const lastName = clean(body.lastName) ?? '';
  const email = clean(body.email);
  const phone = clean(body.phone);
  const phoneCode = clean(body.phoneCode) ?? '+33';
  const civility = clean(body.civility);
  const jobTitle = clean(body.jobTitle);
  const genre = parseGenre(civility);

  if (!companyId) {
    return c.json({ message: 'Champ requis : companyId' }, 400);
  }

  if (!firstName && !lastName) {
    return c.json({ message: 'Au moins un nom de contact est requis' }, 400);
  }

  try {
    const mutation = buildUpdatePersonMutation(id, {
      firstName,
      lastName,
      genre,
      email,
      phone,
      phoneCode,
      jobTitle,
      companyId,
    });
    const data = await queryTwenty<{ updatePerson?: PersonRecord | null }>(c.env, mutation);
    const person = data.updatePerson;
    if (!person?.id) {
      return c.json({ message: 'Mise à jour du contact impossible' }, 500);
    }

    return c.json({
      success: true,
      contact: mapContactItem(person, {
        firstName,
        lastName,
        genre,
        email,
        phone,
        phoneCode: phone ? phoneCode : null,
        jobTitle,
        companyId,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mise à jour du contact impossible';
    return c.json({ message }, 500);
  }
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ message: 'ID requis' }, 400);

  let graphqlErrorMessage: string | null = null;
  try {
    const deleted = await deletePersonViaGraphql(c.env, id);
    if (deleted) {
      return c.json({ id, success: true, mode: 'graphql' });
    }
    graphqlErrorMessage = "La suppression GraphQL n'a supprimé aucun contact.";
  } catch (error) {
    graphqlErrorMessage =
      error instanceof Error ? error.message : 'Suppression contact impossible via GraphQL';
  }

  const { status, json } = await twentyRestDelete(c.env, `/rest/people/${id}`);
  if (status < 200 || status >= 300) {
    const restMessage =
      (json.message as string) ||
      (json.error as string) ||
      JSON.stringify(json).slice(0, 200);
    const message = graphqlErrorMessage
      ? `${graphqlErrorMessage} | Fallback REST: ${restMessage}`
      : restMessage;
    return c.json({ message: message || 'Erreur Twenty CRM' }, status as 400);
  }

  return c.json({ id, success: true, mode: 'rest' });
});

app.post('/', async (c) => {
  const body = await c.req.json<{
    companyId?: string;
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    phoneCode?: string | null;
    city?: string | null;
    civility?: string | null;
    jobTitle?: string | null;
  }>();

  const companyId = clean(body.companyId);
  const firstName = clean(body.firstName) ?? '';
  const lastName = clean(body.lastName) ?? '';
  const email = clean(body.email);
  const phone = clean(body.phone);
  const phoneCode = clean(body.phoneCode) ?? '+33';
  const city = clean(body.city);
  const civility = clean(body.civility);
  const jobTitle = clean(body.jobTitle);
  const genre = parseGenre(civility);

  if (!companyId) {
    return c.json({ message: 'Champ requis : companyId' }, 400);
  }

  if (!firstName && !lastName) {
    return c.json({ message: 'Au moins un nom de contact est requis' }, 400);
  }

  const optionalFields = [
    `companyId: ${JSON.stringify(companyId)}`,
    email ? `emails: { primaryEmail: ${JSON.stringify(email)} }` : null,
    phone
      ? `phones: {
          primaryPhoneNumber: ${JSON.stringify(phone)}
          primaryPhoneCallingCode: ${JSON.stringify(phoneCode)}
        }`
      : null,
    city ? `city: ${JSON.stringify(city)}` : null,
    genre ? `genre: ${genre}` : null,
    jobTitle ? `jobTitle: ${JSON.stringify(jobTitle)}` : null,
  ]
    .filter(Boolean)
    .join('\n        ');

  const mutation = `
    mutation CreatePerson {
      createPerson(
        data: {
          name: {
            firstName: ${JSON.stringify(firstName)}
            lastName: ${JSON.stringify(lastName)}
          }
          ${optionalFields}
        }
      ) {
        id
        genre
        jobTitle
        name {
          firstName
          lastName
        }
        emails {
          primaryEmail
        }
        phones {
          primaryPhoneNumber
          primaryPhoneCallingCode
        }
      }
    }
  `;

  try {
    const data = await queryTwenty<{ createPerson?: PersonRecord | null }>(c.env, mutation);

    const person = data.createPerson;
    if (!person?.id) {
      return c.json({ message: "Le contact n'a pas pu être créé." }, 500);
    }

    return c.json(
      {
        success: true,
        person: mapPersonPayload(person, {
          firstName,
          lastName,
          genre,
          email,
          phone,
          phoneCode: phone ? phoneCode : null,
          jobTitle,
          companyId,
        }),
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Création du contact impossible';

    if (isDuplicateEntryError(message)) {
      try {
        const people = await findPeopleByCompany(c.env, companyId);
        const existing = people.find((person) =>
          isMatchingPerson(person, { firstName, lastName, email, phone }),
        );

        if (existing) {
          return c.json({
            success: true,
            reused: true,
            person: mapPersonPayload(existing, {
              firstName,
              lastName,
              genre,
              email,
              phone,
              phoneCode: phone ? phoneCode : null,
              jobTitle,
              companyId,
            }),
          });
        }

        if (email && await hasGlobalEmailConflict(c.env, email)) {
          return c.json(
            {
              message:
                'Un contact avec cet email existe deja dans Twenty. Utilisez le contact existant ou modifiez l email.',
            },
            409,
          );
        }
      } catch {
        // On retombe sur le message de doublon d'origine si la resolution automatique echoue.
      }

      return c.json(
        {
          message:
            'Un contact similaire existe deja dans Twenty. Verifiez l email ou le telephone, ou selectionnez le contact existant.',
        },
        409,
      );
    }

    return c.json({ message }, 500);
  }
});

export { app as personsRoutes };
