import { Hono } from 'hono';
import { cache, TTL } from '../lib/cache';
import { queryTwenty } from '../lib/twenty';
import { twentyRestDelete } from '../lib/twentyRest';
import { GET_COMPANIES } from '../lib/queries';
import { mapOpportunityRow, type TwentyOppNode } from '../lib/mapOpportunityRow';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();
const CLIENT_OVERVIEW_AGG_FIRST = 10_000;
const CLIENT_OVERVIEW_LIST_FIRST = 2_000;
const ACTIVE_CLIENT_STAGES = [
  'OPP_NEW',
  'OPP_QUOTE_PREP',
  'OPP_CLIENT_PENDING',
  'OPP_FOLLOWUP',
  'OPP_STANDBY',
] as const;

function strCf(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const normalized = v.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof v === 'number') return String(v);
  return null;
}

type CompanyListNode = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  name: string;
  domainName: { primaryLinkUrl: string | null } | null;
  address: {
    addressStreet1?: string | null;
    addressCity?: string | null;
    addressPostcode?: string | null;
  } | null;
  phone?: string | null;
  statutClient?: unknown;
  typeClient?: unknown;
  prospecteur?: unknown;
  departementNumero?: unknown;
  numeroSociete?: unknown;
  siret?: unknown;
};

type CompanyListResponse = {
  companies: {
    edges: {
      node: CompanyListNode;
    }[];
  };
};

type OverviewOppNode = TwentyOppNode & {
  company: {
    id: string;
    name: string;
    address?: {
      addressPostcode?: string | null;
      addressCity?: string | null;
      addressStreet1?: string | null;
    } | null;
  } | null;
};

type OverviewOpportunityRow = ReturnType<typeof mapOpportunityRow>;

function mapCompanyListItem(n: CompanyListNode) {
  return {
    id: n.id,
    createdAt: n.createdAt ?? null,
    updatedAt: n.updatedAt ?? null,
    name: n.name,
    numeroSociete: strCf(n.numeroSociete),
    siret: strCf(n.siret),
    typeClient: strCf(n.typeClient),
    statutClient: strCf(n.statutClient),
    prospecteur: strCf(n.prospecteur),
    departementNumero: strCf(n.departementNumero),
    phone: n.phone ?? null,
    address: {
      street1: n.address?.addressStreet1 ?? null,
      city: n.address?.addressCity ?? null,
      postcode: n.address?.addressPostcode ?? null,
    },
    domainUrl: n.domainName?.primaryLinkUrl ?? null,
  };
}

function filterCompaniesBySearch<T extends { name: string }>(companies: T[], search: string) {
  if (!search) return companies;
  const q = search.toLocaleLowerCase('fr-FR');
  return companies.filter((company) =>
    company.name.toLocaleLowerCase('fr-FR').includes(q),
  );
}

async function fetchCompaniesList(env: Env, first: number) {
  const data = await queryTwenty<CompanyListResponse>(env, GET_COMPANIES, { first });
  return data.companies.edges.map((e) => mapCompanyListItem(e.node));
}

function clientOverviewYears(currentYear: number, count = 4): number[] {
  return Array.from({ length: count }, (_, index) => currentYear - index);
}

async function fetchOrCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  const value = await fetcher();
  cache.set(key, value, ttl);
  return value;
}

async function fetchWonOverviewOpportunities(env: Env, years: number[]) {
  const yearsKey = years.join(',');
  const cacheKey = `companies:overview:won:${yearsKey}`;

  return fetchOrCache(cacheKey, TTL.COURANT, async () => {
    const yearFilter = years.join(', ');
    const data = await queryTwenty<{
      opportunities: { edges: { node: OverviewOppNode }[] };
    }>(env, `query {
      opportunities(
        filter: {
          and: [
            { statutDevis: { eq: GAGNE } },
            { anneeDevis: { in: [${yearFilter}] } }
          ]
        },
        first: ${CLIENT_OVERVIEW_AGG_FIRST},
        orderBy: { createdAt: DescNullsLast }
      ) {
        edges {
          node {
            id
            createdAt
            updatedAt
            name
            amount { amountMicros currencyCode }
            montantRemise { amountMicros currencyCode }
            tauxRemise
            stage
            numeroDevis
            statutDevis
            dateDevis
            dateRelance
            prestation
            anneeDevis
            closeDate
            bonDeCommandeRef: customFields(key: "bonDeCommandeRef")
            devisPortailBundle: customFields(key: "devisPortailBundle")
            company { id name address { addressPostcode addressCity addressStreet1 } }
            pointOfContact {
              id
              genre
              name { firstName lastName }
              phones { primaryPhoneNumber primaryPhoneCallingCode }
              emails { primaryEmail }
            }
          }
        }
      }
    }`);

    return data.opportunities.edges.map(({ node }) => mapOpportunityRow(node, node.company));
  });
}

async function deleteCompanyViaGraphql(env: Env, id: string): Promise<boolean> {
  const mutation = `
    mutation DeleteCompany($filter: CompanyFilterInput!) {
      deleteCompanies(filter: $filter) {
        id
      }
    }
  `;
  const data = await queryTwenty<{
    deleteCompanies?: { id: string }[] | null;
  }>(env, mutation, { filter: { id: { eq: id } } });
  return Array.isArray(data.deleteCompanies) && data.deleteCompanies.length > 0;
}

async function fetchOpenOverviewOpportunities(env: Env) {
  const cacheKey = 'companies:overview:open';

  return fetchOrCache(cacheKey, TTL.PRIOS, async () => {
    const stageFilter = ACTIVE_CLIENT_STAGES.join(', ');
    const data = await queryTwenty<{
      opportunities: { edges: { node: OverviewOppNode }[] };
    }>(env, `query {
      opportunities(
        filter: { stage: { in: [${stageFilter}] } },
        first: ${CLIENT_OVERVIEW_AGG_FIRST},
        orderBy: { createdAt: DescNullsLast }
      ) {
        edges {
          node {
            id
            createdAt
            updatedAt
            name
            amount { amountMicros currencyCode }
            montantRemise { amountMicros currencyCode }
            tauxRemise
            stage
            numeroDevis
            statutDevis
            dateDevis
            dateRelance
            prestation
            anneeDevis
            closeDate
            bonDeCommandeRef: customFields(key: "bonDeCommandeRef")
            devisPortailBundle: customFields(key: "devisPortailBundle")
            company { id name address { addressPostcode addressCity addressStreet1 } }
            pointOfContact {
              id
              genre
              name { firstName lastName }
              phones { primaryPhoneNumber primaryPhoneCallingCode }
              emails { primaryEmail }
            }
          }
        }
      }
    }`);

    return data.opportunities.edges.map(({ node }) => mapOpportunityRow(node, node.company));
  });
}

app.post('/', async (c) => {
  const body = await c.req.json<{
    name?: string;
    typeClient?: string | null;
    numeroSociete?: string | number | null;
    siret?: string | null;
    address?: {
      street1?: string | null;
      city?: string | null;
      postcode?: string | null;
      country?: string | null;
    } | null;
  }>();
  const name = body.name?.trim();
  const typeClient = strCf(body.typeClient);
  const numeroSociete = strCf(body.numeroSociete);
  const siret = strCf(body.siret);
  const addressStreet1 = strCf(body.address?.street1);
  const addressCity = strCf(body.address?.city);
  const addressPostcode = strCf(body.address?.postcode);
  const addressCountry = strCf(body.address?.country) ?? 'France';
  if (!name) {
    return c.json({ message: 'Champ requis : name' }, 400);
  }

  const payload: Record<string, unknown> = { name };
  if (typeClient) payload.typeClient = typeClient;
  if (numeroSociete) payload.numeroSociete = numeroSociete;
  if (siret) payload.siret = siret;
  if (addressStreet1 || addressCity || addressPostcode) {
    payload.address = {
      addressStreet1: addressStreet1 ?? null,
      addressCity: addressCity ?? null,
      addressPostcode: addressPostcode ?? null,
      addressCountry,
    };
  }

  const mutation = `
    mutation CreateCompany($data: CompanyCreateInput!) {
      createCompany(data: $data) {
        id
        name
        typeClient
        numeroSociete
        siret: customFields(key: "siret")
        address {
          addressStreet1
          addressCity
          addressPostcode
          addressCountry
        }
      }
    }
  `;
  try {
    const data = await queryTwenty<{
      createCompany?: {
        id: string;
        name: string;
        typeClient?: string | null;
        numeroSociete?: string | number | null;
        siret?: string | null;
        address?: {
          addressStreet1?: string | null;
          addressCity?: string | null;
          addressPostcode?: string | null;
          addressCountry?: string | null;
        } | null;
      } | null;
      data?: {
        createCompany?: {
          id: string;
          name: string;
          typeClient?: string | null;
          numeroSociete?: string | number | null;
          siret?: string | null;
          address?: {
            addressStreet1?: string | null;
            addressCity?: string | null;
            addressPostcode?: string | null;
            addressCountry?: string | null;
          } | null;
        } | null;
      } | null;
    }>(c.env, mutation, { data: payload });

    const created =
      data.createCompany ??
      data.data?.createCompany ??
      null;

    if (!created?.id) {
      return c.json({ message: "La société n'a pas pu être créée via GraphQL." }, 500);
    }

    return c.json(
      {
        id: created.id,
        name: created.name ?? name,
        typeClient: strCf(created.typeClient) ?? typeClient,
        numeroSociete: strCf(created.numeroSociete) ?? numeroSociete,
        siret: strCf(created.siret) ?? siret,
        address: {
          street1: created.address?.addressStreet1 ?? addressStreet1 ?? null,
          city: created.address?.addressCity ?? addressCity ?? null,
          postcode: created.address?.addressPostcode ?? addressPostcode ?? null,
          country: created.address?.addressCountry ?? addressCountry,
        },
        success: true,
      },
      201,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur GraphQL inconnue';
    return c.json({ message: `Création société impossible: ${msg}` }, 500);
  }
});

app.get('/', async (c) => {
  const search = c.req.query('search')?.trim() ?? '';
  const hasSearch = search.length > 0;
  const companies = filterCompaniesBySearch(
    await fetchCompaniesList(c.env, hasSearch ? 2000 : 100),
    search,
  );
  return c.json({ companies });
});

app.get('/overview', async (c) => {
  const search = c.req.query('search')?.trim() ?? '';
  const years = clientOverviewYears(new Date().getFullYear());
  const companies = filterCompaniesBySearch(
    await fetchCompaniesList(c.env, CLIENT_OVERVIEW_LIST_FIRST),
    search,
  );

  if (companies.length === 0) {
    return c.json({ years, companies: [] });
  }

  const [wonOpportunities, openOpportunities] = await Promise.all([
    fetchWonOverviewOpportunities(c.env, years),
    fetchOpenOverviewOpportunities(c.env),
  ]);

  const overviewByCompany = new Map(
    companies.map((company) => [
      company.id,
      {
        ...company,
        openCount: 0,
        openTotalEur: 0,
        openOpportunities: [] as OverviewOpportunityRow[],
        caByYear: Object.fromEntries(years.map((year) => [String(year), 0])),
      },
    ]),
  );

  for (const row of wonOpportunities) {
    if (!row.companyId || row.anneeDevis == null) continue;
    const company = overviewByCompany.get(row.companyId);
    if (!company) continue;
    const yearKey = String(row.anneeDevis);
    if (!(yearKey in company.caByYear)) continue;
    company.caByYear[yearKey] += row.amountEur ?? 0;
  }

  for (const row of openOpportunities) {
    if (!row.companyId) continue;
    const company = overviewByCompany.get(row.companyId);
    if (!company) continue;
    company.openCount += 1;
    company.openTotalEur += row.amountEur ?? 0;
    company.openOpportunities.push(row);
  }

  return c.json({
    years,
    companies: companies.map((company) => overviewByCompany.get(company.id)!),
  });
});

type CompanyDetailNode = {
  id: string;
  name: string;
  domainName: { primaryLinkUrl: string | null } | null;
  address: {
    addressStreet1?: string | null;
    addressCity?: string | null;
    addressPostcode?: string | null;
  } | null;
  phone?: string | null;
  siret?: unknown;
  people: {
    edges: {
      node: {
        id: string;
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
      };
    }[];
  };
  opportunities: {
    edges: { node: TwentyOppNode }[];
  };
};

app.get('/:id', async (c) => {
  const query = `
    query GetCompany($filter: CompanyFilterInput!) {
      companies(filter: $filter, first: 1) {
        edges {
          node {
            id
            name
            domainName { primaryLinkUrl }
            address { addressStreet1 addressCity addressPostcode }
            phone
            siret: customFields(key: "siret")
            people {
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
            opportunities(
              first: 500
              orderBy: { dateDevis: DescNullsLast }
            ) {
              edges {
                node {
                  id createdAt updatedAt name amount { amountMicros currencyCode }
                  montantRemise { amountMicros currencyCode }
                  tauxRemise
                  stage
                  numeroDevis statutDevis dateDevis dateRelance prestation anneeDevis closeDate
                  bonDeCommandeRef: customFields(key: "bonDeCommandeRef")
                  devisPortailBundle: customFields(key: "devisPortailBundle")
                  pointOfContact {
                    id
                    genre
                    name { firstName lastName }
                    phones { primaryPhoneNumber primaryPhoneCallingCode }
                    emails { primaryEmail }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await queryTwenty<{
    companies: { edges: { node: CompanyDetailNode }[] };
  }>(c.env, query, {
    filter: { id: { eq: c.req.param('id') } },
  });
  const co = data.companies.edges[0]?.node ?? null;
  if (!co) {
    return c.json({ message: 'Société introuvable' }, 404);
  }

  const companyPayload = {
    id: co.id,
    name: co.name,
    phone: co.phone ?? null,
    siret: strCf(co.siret),
    domainUrl: co.domainName?.primaryLinkUrl ?? null,
    address: {
      street1: co.address?.addressStreet1 ?? null,
      city: co.address?.addressCity ?? null,
      postcode: co.address?.addressPostcode ?? null,
    },
    people: co.people.edges.map((e) => ({
      id: e.node.id,
      firstName: e.node.name?.firstName ?? '',
      lastName: e.node.name?.lastName ?? '',
      civility: e.node.genre ?? null,
      email: e.node.emails?.primaryEmail ?? null,
      phone: e.node.phones?.primaryPhoneNumber ?? null,
      phoneCode: e.node.phones?.primaryPhoneCallingCode ?? null,
      jobTitle: e.node.jobTitle ?? null,
    })),
  };

  const parent = {
    id: co.id,
    name: co.name,
    address: co.address,
  };

  const opportunities = co.opportunities.edges.map(({ node }) =>
    mapOpportunityRow(node, parent),
  );

  return c.json({ company: companyPayload, opportunities });
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ message: 'ID requis' }, 400);

  let graphqlErrorMessage: string | null = null;
  try {
    const deleted = await deleteCompanyViaGraphql(c.env, id);
    if (deleted) {
      return c.json({ id, success: true, mode: 'graphql' });
    }
    graphqlErrorMessage = "La suppression GraphQL n'a supprimé aucune société.";
  } catch (error) {
    graphqlErrorMessage =
      error instanceof Error ? error.message : 'Suppression société impossible via GraphQL';
  }

  const { status, json } = await twentyRestDelete(c.env, `/rest/companies/${id}`);
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

export { app as companiesRoutes };
