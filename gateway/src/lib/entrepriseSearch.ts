const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';
const MIN_QUERY_LENGTH = 4;
/** L'API ignore souvent les termes de moins de ~8 caractères (ex. « voxp »). */
const MIN_API_TOKEN_LENGTH = 8;
const MAX_RESULTS = 15;
const MAX_COMPLETION_REQUESTS = 14;
const USER_AGENT = 'AMIPEQ-Portal/1.0 (contact: amipeq-portal)';

/**
 * Suffixes fréquents en dénominations : query+suffixe (≥ 8 car.) puis filtrage
 * sur le texte saisi (ex. voxp + erience → VOXPERIENCE).
 */
const COMPLETION_SUFFIXES = [
  'erience',
  'erienc',
  'perience',
  'ience',
  'ement',
  'ation',
  'isation',
  'france',
  'groupe',
  'holding',
  'services',
  'service',
  'consulting',
  'conseil',
  'conseils',
  'sarl',
  'sas',
  'societe',
  'international',
  'europe',
  'digital',
  'communication',
  'technologies',
  'solutions',
  'industrie',
  'developpement',
  'commerce',
  'distribution',
  'production',
  'ingenierie',
  'associes',
  'partners',
  'lyon',
  'paris',
  'formation',
  'education',
  'scolaire',
  'college',
  'lycee',
  'ecole',
  'institut',
  'medical',
  'sante',
  'pharma',
  'agricole',
  'boulangerie',
  'restaurant',
  'hotel',
  'immobilier',
  'construction',
  'transport',
  'logistique',
  'informatique',
  'agence',
  'studio',
  'marketing',
  'energie',
  'architecture',
  'paysage',
  'jardin',
  'informatique',
  'telecom',
  'mecanique',
  'electronique',
  'automobile',
  'chimie',
  'alimentaire',
  'agroalimentaire',
  'fromagerie',
  'environnement',
  'securite',
  'nettoyage',
  'maintenance',
  'location',
  'gestion',
  'finance',
  'assurance',
  'cabinet',
  'expert',
  'comptable',
  'recrutement',
  'plomberie',
  'chauffage',
  'climatisation',
  'menuiserie',
  'peinture',
  'renovation',
  'amenagement',
  'design',
  'media',
  'web',
  'software',
  'logiciel',
  'cyber',
  'cooperative',
  'association',
  'fondation',
  'culture',
  'tourisme',
  'voyage',
  'hotellerie',
  'restauration',
  'traiteur',
  'evenement',
  'spectacle',
  'production',
  'musique',
  'photo',
  'video',
  'imprimerie',
  'emballage',
  'textile',
  'mode',
  'cosmetique',
  'beaute',
  'coiffure',
  'sport',
  'fitness',
  'academie',
  'coaching',
  'consultant',
  'venture',
  'atelier',
  'garage',
  'auto',
  'nautique',
  'charpente',
  'toiture',
  'piscine',
  'paysagiste',
  'jardinerie',
  'fleuriste',
  'bio',
  'nature',
  'eco',
  'food',
  'vin',
  'vins',
  'cafe',
  'chocolat',
  'confiserie',
  'patisserie',
  'primeur',
  'mer',
  'legume',
  'cereale',
  'farine',
  'pain',
];

type RawSiege = {
  siret?: string | null;
  adresse?: string | null;
  numero_voie?: string | null;
  type_voie?: string | null;
  libelle_voie?: string | null;
  complement_adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
};

type RawResult = {
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  siege?: RawSiege | null;
};

export type EntrepriseSearchItem = {
  name: string;
  siret: string | null;
  address: {
    street1: string;
    postcode: string;
    city: string;
  };
};

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function matchesPartialName(query: string, name: string): boolean {
  const q = normalizeForMatch(query);
  const n = normalizeForMatch(name);
  if (!q || !n) return false;
  if (n.includes(q)) return true;

  let i = 0;
  for (const char of n) {
    if (i < q.length && char === q[i]) i += 1;
  }
  return i === q.length;
}

function buildStreet1(siege: RawSiege): string {
  const fromParts = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
    .map((part) => str(part))
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fromParts) {
    const complement = str(siege.complement_adresse);
    return complement ? `${complement}, ${fromParts}` : fromParts;
  }

  const adresse = str(siege.adresse);
  if (!adresse) return '';

  const cp = str(siege.code_postal);
  const ville = str(siege.libelle_commune);
  if (cp && ville) {
    const suffix = `${cp} ${ville}`;
    if (adresse.endsWith(suffix)) {
      return adresse.slice(0, -suffix.length).trim();
    }
  }
  return adresse;
}

function mapResult(raw: RawResult): EntrepriseSearchItem | null {
  const siege = raw.siege;
  if (!siege) return null;

  const name = str(raw.nom_complet) || str(raw.nom_raison_sociale);
  if (!name) return null;

  return {
    name,
    siret: str(siege.siret) || null,
    address: {
      street1: buildStreet1(siege),
      postcode: str(siege.code_postal),
      city: str(siege.libelle_commune),
    },
  };
}

function compareByPostcode(a: EntrepriseSearchItem, b: EntrepriseSearchItem): number {
  const cpA = a.address.postcode;
  const cpB = b.address.postcode;
  if (!cpA && !cpB) return a.name.localeCompare(b.name, 'fr');
  if (!cpA) return 1;
  if (!cpB) return -1;
  const byCp = cpA.localeCompare(cpB, 'fr', { numeric: true });
  if (byCp !== 0) return byCp;
  return a.name.localeCompare(b.name, 'fr');
}

function dedupeKey(item: EntrepriseSearchItem): string {
  return item.siret ?? `${item.name}|${item.address.postcode}`;
}

function mergeItems(
  target: EntrepriseSearchItem[],
  seen: Set<string>,
  incoming: EntrepriseSearchItem[],
  query: string,
): void {
  for (const item of incoming) {
    if (!matchesPartialName(query, item.name)) continue;
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(item);
    if (target.length >= MAX_RESULTS) return;
  }
}

async function fetchRawResults(query: string): Promise<RawResult[]> {
  const url = new URL(API_BASE);
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', String(MAX_RESULTS));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`API Recherche d'entreprises (${response.status})`);
  }

  const data = (await response.json()) as { results?: RawResult[] };
  return data.results ?? [];
}

function mapRawResults(rawResults: RawResult[]): EntrepriseSearchItem[] {
  const items: EntrepriseSearchItem[] = [];
  for (const raw of rawResults) {
    const mapped = mapResult(raw);
    if (mapped) items.push(mapped);
  }
  return items;
}

function buildCompletionCandidates(query: string): string[] {
  const base = query.trim();
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const suffix of COMPLETION_SUFFIXES) {
    const candidate = base + suffix;
    if (candidate.length < MIN_API_TOKEN_LENGTH) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    candidates.push(candidate);
  }

  return candidates;
}

async function searchWithCompletionFallback(
  query: string,
): Promise<EntrepriseSearchItem[]> {
  const candidates = buildCompletionCandidates(query).slice(0, MAX_COMPLETION_REQUESTS);
  if (candidates.length === 0) return [];

  const seen = new Set<string>();
  const items: EntrepriseSearchItem[] = [];

  for (const candidate of candidates) {
    const rawResults = await fetchRawResults(candidate);
    mergeItems(items, seen, mapRawResults(rawResults), query);
    if (items.length >= MAX_RESULTS) break;
  }

  return items;
}

export async function searchEntreprises(query: string): Promise<EntrepriseSearchItem[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const seen = new Set<string>();
  const items: EntrepriseSearchItem[] = [];

  const primaryMapped = mapRawResults(await fetchRawResults(q));

  if (q.length >= MIN_API_TOKEN_LENGTH && primaryMapped.length > 0) {
    return primaryMapped.sort(compareByPostcode);
  }

  mergeItems(items, seen, primaryMapped, q);

  if (items.length < MAX_RESULTS) {
    const completed = await searchWithCompletionFallback(q);
    mergeItems(items, seen, completed, q);
  }

  return items.sort(compareByPostcode);
}
