export const GET_COMPANIES = `
  query GetCompanies($filter: CompanyFilterInput, $first: Int) {
    companies(filter: $filter, first: $first, orderBy: { name: AscNullsLast }) {
      edges {
        node {
          id
          name
          domainName { primaryLinkUrl }
          address { addressStreet1 addressCity addressPostcode }
          phone
          statutClient: customFields(key: "statutClient")
          typeClient: customFields(key: "typeClient")
          prospecteur: customFields(key: "prospecteur")
        }
      }
    }
  }
`;

export const GET_OPPORTUNITIES = `
  query GetOpportunities($filter: OpportunityFilterInput, $first: Int) {
    opportunities(filter: $filter, first: $first, orderBy: { dateDevis: DescNullsLast }) {
      edges {
        node {
          id
          name
          amount { amountMicros currencyCode }
          stage
          numeroDevis
          statutDevis
          dateDevis
          dateRelance
          prestation
          anneeDevis
          company { id name address { addressPostcode addressCity addressStreet1 } }
          closeDate
        }
      }
    }
  }
`;

export const GET_DASHBOARD_STATS = `
  query GetDashboardStats {
    opportunities(filter: { stage: { eq: "EN_ATTENTE" } }) {
      totalCount
    }
  }
`;
