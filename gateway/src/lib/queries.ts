export const GET_COMPANIES = `
  query GetCompanies($filter: CompanyFilterInput, $first: Int) {
    companies(filter: $filter, first: $first, orderBy: { name: AscNullsLast }) {
      edges {
        node {
          id
          createdAt
          updatedAt
          name
          domainName { primaryLinkUrl }
          address { addressStreet1 addressCity addressPostcode }
          phone
          statutClient: customFields(key: "statutClient")
          typeClient
          prospecteur: customFields(key: "prospecteur")
          departementNumero: customFields(key: "departementNumero")
          numeroSociete: customFields(key: "numeroSociete")
          siret: customFields(key: "siret")
        }
      }
    }
  }
`;

export const GET_OPPORTUNITIES = `
  query GetOpportunities($filter: OpportunityFilterInput, $first: Int) {
    opportunities(filter: $filter, first: $first, orderBy: { createdAt: DescNullsLast }) {
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
          company { id name address { addressPostcode addressCity addressStreet1 } }
          pointOfContact {
            id
            genre
            name { firstName lastName }
            phones { primaryPhoneNumber primaryPhoneCallingCode }
            emails { primaryEmail }
          }
          closeDate
          bonDeCommandeRef: customFields(key: "bonDeCommandeRef")
          devisportailbundle
        }
      }
    }
  }
`;

/** Une opportunité par id (fallback si REST GET échoue). */
export const GET_OPPORTUNITY_BY_ID = `
  query GetOpportunityById($filter: OpportunityFilterInput!) {
    opportunities(filter: $filter, first: 1) {
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
          devisportailbundle
        }
      }
    }
  }
`;

export const GET_DASHBOARD_STATS = `
  query GetDashboardStats {
    opportunities(filter: { statutDevis: { eq: "EN_ATTENTE" } }) {
      totalCount
    }
  }
`;
