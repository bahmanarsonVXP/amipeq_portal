export type ClientType = 'ETABLISSEMENT_SCOLAIRE' | 'MAIRIE_COLLECTIVITE' | 'ENTREPRISE_TPE_PME' | 'AUTRE';
export type ClientStatus = 'PROSPECT' | 'CLIENT_ACTIF' | 'CLIENT_INACTIF' | 'PERDU';
export type QuoteStatus = 'GAGNE' | 'PERDU' | 'EN_ATTENTE';
export type Prestation = 'DUERP' | 'PPMS' | 'RPS' | 'PSE' | 'COVID' | 'RGPD' | 'AUTRE';
export type Nature = 'CREATION' | 'MAJ' | 'CONTRAT_MAJ';
export type Modalite = 'SUR_SITE' | 'A_DISTANCE' | 'SUR_SITE_OU_DISTANCE';

export interface Company {
  id: string;
  name: string;
  numeroSociete: string;
  typeClient: ClientType;
  sousType?: string;
  statutClient: ClientStatus;
  address: {
    street1?: string;
    city?: string;
    postcode?: string;
  };
  phone?: string;
  email?: string;
  prospecteur?: 'ALEX' | 'CL';
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId: string;
}

/** Ligne renvoyée par GET /api/opportunities (Twenty via gateway) */
export interface OpportunityRow {
  id: string;
  name: string;
  stage: string;
  amountEur: number | null;
  currencyCode: string;
  companyId: string | null;
  companyName: string | null;
  companyPostcode: string | null;
  companyCity: string | null;
  companyStreet: string | null;
  closeDate: string | null;
}

export interface Opportunity {
  id: string;
  name: string;
  companyId: string;
  company?: Company;
  personId?: string;
  person?: Person;
  numeroDevis: string;
  dateDevis: string;
  prestation: Prestation[];
  naturePrestation?: Nature;
  modalite?: Modalite;
  amount: number;
  montantRemise?: number;
  tauxRemise?: number;
  statutDevis: QuoteStatus;
  dateRelance?: string;
  anneeDevis: number;
}

export interface Relance {
  opportunity: Opportunity;
  dateRelance: string;
  joursRetard: number;
  status: 'EN_RETARD' | 'AUJOURD_HUI' | 'A_VENIR';
}

export interface DashboardStats {
  caMois: number;
  caVariation: number;
  devisEnAttente: number;
  potentielDevis: number;
  tauxConversion: number;
  conversionVariation: number;
  clientsActifs: number;
  nouveauxClients: number;
  relancesEnRetard: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'franchisee';
}

// ─── Dashboard ────────────────────────────────────────────────

export interface CaPeriode {
  valeur: number
  n1: number | null
  n2: number | null
  deltaN1Pct: number | null
  deltaN2Pct: number | null
  nomMois?: string
  nbDevis: number
  montantDevis: number
  /** Variation % du nb devis vs même période N-1 / N-2 (aligné CA). */
  deltaNbDevisN1Pct?: number | null
  deltaNbDevisN2Pct?: number | null
  /** Variation % du montant total des devis vs N-1 / N-2. */
  deltaMontantDevisN1Pct?: number | null
  deltaMontantDevisN2Pct?: number | null
}

export interface CaData {
  dda: CaPeriode
  glissant12M: CaPeriode
  moisCourant: CaPeriode
}

export interface DashboardKpis {
  ca: CaData
  devisEnAttente: number
  potentielEnAttente: number
  devisEnRetard: number
  devisARelancerAujourdhui: number
  tauxTransformation: number
  tauxTransformationN1: number | null
  tauxTransformationN2: number | null
  facturesAEnvoyer: number
  montantFacturesAEnvoyer: number
  facturesImpayees: number
  montantFacturesImpayees: number
  deplacementsAPlanifier: number
}

export interface OpportunityCard {
  id: string
  numeroDevis: string
  companyName: string
  companyId: string
  departement: string
  montant: number
  prestations: string[]
  stage: string
  statutDevis: 'GAGNE' | 'PERDU' | 'EN_ATTENTE'
  dateRelance: string | null
}

export interface PrioCard {
  id: string
  companyName: string
  departement: string
  montant: number
  prestations: string[]
  dateRelance: string
  joursRetard: number
}

export interface PipelineColumn {
  stage: string
  label: string
  count: number
  totalMontant: number
  cards: OpportunityCard[]
}

export interface PortefeuilleData {
  totalActifs: number
  totalProspects: number
  totalInactifs: number
  parType: { type: string; label: string; count: number }[]
  parPrestation: { prestation: string; count: number }[]
  topDepartements: { dept: string; count: number; ca: number }[]
  topClients: { id: string; name: string; type: string; ca: number }[]
}

export interface PriosData {
  enRetard: PrioCard[]
  aujourdhui: PrioCard[]
  realiseSemaine: PrioCard[]
  resteSemaine: PrioCard[]
}

export interface DashboardData {
  kpis: DashboardKpis
  pipeline: PipelineColumn[]
  prios: PriosData
  portefeuille: PortefeuilleData
}
