import type { TwentyOppNode } from '../../lib/mapOpportunityRow';

export type OppNode = TwentyOppNode & {
  company: {
    id: string;
    name: string;
    address?: {
      addressPostcode?: string;
      addressCity?: string;
      addressStreet1?: string;
    } | null;
  } | null;
};

export function userLabel(c: { get: (k: string) => unknown }): string {
  const u = c.get('user') as { email?: string; sub?: string } | undefined;
  return u?.email ?? u?.sub ?? 'inconnu';
}

export function mapOpportunityContact(
  pointOfContact:
    | {
        id: string;
        genre?: string | null;
        name?: { firstName?: string | null; lastName?: string | null } | null;
        phones?: {
          primaryPhoneNumber?: string | null;
          primaryPhoneCallingCode?: string | null;
        } | null;
        emails?: { primaryEmail?: string | null } | null;
      }
    | null
    | undefined,
) {
  if (!pointOfContact?.id) return null;

  return {
    id: pointOfContact.id,
    civility: pointOfContact.genre ?? null,
    firstName: pointOfContact.name?.firstName ?? '',
    lastName: pointOfContact.name?.lastName ?? '',
    phone: pointOfContact.phones?.primaryPhoneNumber ?? null,
    phoneCode: pointOfContact.phones?.primaryPhoneCallingCode ?? null,
    email: pointOfContact.emails?.primaryEmail ?? null,
  };
}
