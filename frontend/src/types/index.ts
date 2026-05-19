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

/** Ligne renvoyée par GET /api/companies (liste) */
export interface CompanyListItem {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  name: string;
  numeroSociete?: string | null;
  siret?: string | null;
  typeClient?: string | null;
  statutClient?: string | null;
  prospecteur?: string | null;
  departementNumero?: string | null;
  phone?: string | null;
  address: {
    street1?: string | null;
    city?: string | null;
    postcode?: string | null;
  };
  domainUrl?: string | null;
}

export interface ClientOverviewItem extends CompanyListItem {
  openCount: number;
  openTotalEur: number;
  openOpportunities: OpportunityRow[];
  caByYear: Record<string, number>;
}

export interface ClientOverviewResponse {
  years: number[];
  companies: ClientOverviewItem[];
}

export interface CompanyDetailPerson {
  id: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneCode?: string | null;
  jobTitle?: string | null;
}

/** GET /api/companies/:id */
export interface CompanyDetailPayload {
  id: string;
  name: string;
  phone: string | null;
  siret?: string | null;
  domainUrl: string | null;
  address: {
    street1: string | null;
    city: string | null;
    postcode: string | null;
  };
  people: CompanyDetailPerson[];
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

export interface OpportunityContact {
  id: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  phone: string | null;
  phoneCode: string | null;
  email: string | null;
}

export interface OpportunityNote {
  id: string;
  title: string | null;
  body: string | null;
  createdAt: string | null;
}

export interface OpportunityReminder {
  id: string;
  title: string | null;
  body: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  dueAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Bundle multi-devis (Twenty `devisPortailBundle`, JSON) — aligné gateway */
export type PortailQuoteDocStatus =
  | 'Q_DRAFT_NEW'
  | 'Q_INTERNAL_REVIEW'
  | 'Q_READY_TO_SEND'
  | 'Q_SENT'
  | 'Q_SUPERSEDED'
  | 'Q_CANCELLED';

export type PortailQuoteCommercialStatus = 'EN_ATTENTE' | 'GAGNE' | 'PERDU';

export interface PortailQuote {
  id: string;
  numero: string;
  label: string;
  statut: PortailQuoteDocStatus;
  statutCommercial: PortailQuoteCommercialStatus;
  sentAt: string | null;
  montantBrutEur: number | null;
  tauxRemise: number | null;
  montantNetEur: number | null;
  remiseTexte: string | null;
  prestations: string[];
  documentKey: string | null;
  documentFileName: string | null;
  documentUploadedAt: string | null;
}

export interface PortailStandby {
  active: boolean;
  until: string | null;
  reason: string | null;
}

export interface PortailBundle {
  version: number;
  pilotageId: string | null;
  quotes: PortailQuote[];
  standby: PortailStandby;
  lastSentInitQuoteId: string | null;
}

export interface PortailBundleDetailResponse {
  bundle: PortailBundle;
  stage: string;
  bonDeCommandeRef: string | null;
  remisePresets?: number[];
}

/** Ligne renvoyée par GET /api/opportunities (Twenty via gateway) */
export interface OpportunityRow {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  name: string;
  stage: string;
  amountEur: number | null;
  montantInitialEur: number | null;
  montantRemiseEur: number | null;
  tauxRemise: number | null;
  currencyCode: string;
  prestation: string[];
  companyId: string | null;
  companyName: string | null;
  companyPostcode: string | null;
  companyCity: string | null;
  companyStreet: string | null;
  closeDate: string | null;
  numeroDevis: string | null;
  statutDevis: string | null;
  dateDevis: string | null;
  dateRelance: string | null;
  anneeDevis: number | null;
  bonDeCommandeRef: string | null;
  bcMissing: boolean;
  portailBundle: PortailBundle;
  portailWidgets: { d1: boolean; w1: boolean; d2: boolean; d3: boolean };
  contact: OpportunityContact | null;
}

/** GET /api/opportunities/reports/bc-manquant */
export interface BcManquantReportRow {
  id: string;
  name: string;
  stage: string;
  companyId: string | null;
  companyName: string | null;
  numeroDevis: string | null;
  bonDeCommandeRef: string | null;
  bcMissing: boolean;
}

export interface BcManquantReportResponse {
  opportunities: BcManquantReportRow[];
}

export interface CompanyDetailResponse {
  company: CompanyDetailPayload;
  opportunities: OpportunityRow[];
}

export interface EntrepriseSearchItem {
  name: string;
  siret: string | null;
  address: {
    street1: string;
    postcode: string;
    city: string;
  };
}

export interface EntrepriseSearchResponse {
  results: EntrepriseSearchItem[];
}

export interface CompanyCreatePayload {
  name: string;
  typeClient?: ClientType | string | null;
  numeroSociete?: string | null;
  siret?: string | null;
  address?: {
    street1?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
  };
}

export interface CompanyCreateResponse {
  id: string;
  name: string;
  typeClient?: string | null;
  numeroSociete?: string | null;
  siret?: string | null;
  address?: {
    street1?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
  };
  success: boolean;
}

export interface PersonCreatePayload {
  companyId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneCode?: string | null;
  city?: string | null;
  civility?: string | null;
  jobTitle?: string | null;
}

export interface PersonCreateResponse {
  success: boolean;
  person: CompanyDetailPerson & {
    companyId: string;
  };
}

export interface ContactListItem {
  id: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneCode?: string | null;
  jobTitle?: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ContactsListResponse {
  contacts: ContactListItem[];
}

export interface ContactDetailResponse {
  contact: ContactListItem;
}

export interface PersonUpdatePayload {
  companyId?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneCode?: string | null;
  civility?: string | null;
  jobTitle?: string | null;
}

export interface PersonUpdateResponse {
  success: boolean;
  contact: ContactListItem;
}

export interface OpportunityCreatePayload {
  companyId: string;
  name: string;
  numeroDevis?: string;
  amountEur?: number | null;
  stage?: string;
  dateDevis?: string | null;
  statutDevis?: string;
  prestation?: string[];
  pointOfContactId?: string | null;
  anneeDevis?: number | null;
}

export interface OpportunityContactUpdateResponse {
  success: boolean;
  id: string;
  contact: OpportunityContact | null;
}

export interface OpportunityNotesResponse {
  notes: OpportunityNote[];
}

export interface OpportunityRemindersResponse {
  reminders: OpportunityReminder[];
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
