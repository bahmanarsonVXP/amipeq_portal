'use client';

type ContactNameLike = {
  civility?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function formatContactCivility(civility: string | null | undefined): string | null {
  const normalized = clean(civility).replace(/\./g, '').toUpperCase();
  if (!normalized) return null;
  if (normalized === 'MONSSIEUR' || normalized === 'MONSIEUR' || normalized === 'M') return 'M.';
  if (normalized === 'MADAME' || normalized === 'MME') return 'Mme';
  if (normalized === 'MADEMOISELLE' || normalized === 'MLLE') return 'Mlle';
  if (normalized === 'INCONNU' || normalized === 'INCONNUE' || normalized === 'UNKNOWN') {
    return null;
  }
  return clean(civility);
}

export function formatContactPrimaryLine(contact: ContactNameLike): string {
  const civility = formatContactCivility(contact.civility);
  const lastName = clean(contact.lastName);
  const fallbackName = (lastName || clean(contact.firstName) || 'Sans nom').toLocaleUpperCase('fr-FR');
  return [civility, fallbackName].filter(Boolean).join(' ');
}

export function formatContactFirstName(firstName: string | null | undefined): string | null {
  const trimmed = clean(firstName);
  if (!trimmed) return null;

  return trimmed
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s'-])([a-zà-ÿ])/giu, (match) => match.toLocaleUpperCase('fr-FR'));
}
