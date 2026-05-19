export type ContactCompanyBadgeVariant = 'current' | 'other' | 'none';

export function getContactCompanyBadge(
  contact: { companyId: string | null; companyName?: string | null },
  opportunityCompanyId?: string | null,
): { label: string; variant: ContactCompanyBadgeVariant } {
  if (!contact.companyId) {
    return { label: 'Sans société sur la fiche', variant: 'none' };
  }
  if (opportunityCompanyId && contact.companyId === opportunityCompanyId) {
    return { label: 'Fiche : client de l’opportunité', variant: 'current' };
  }
  const name = contact.companyName?.trim();
  return {
    label: name ? `Fiche : ${name}` : 'Fiche : autre client',
    variant: 'other',
  };
}
