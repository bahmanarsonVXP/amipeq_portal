function normalizeComparableName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripCivilityPrefix(value) {
  return String(value || '')
    .replace(/^(m\.|mr|mme|mlle|melle|monsieur|madame|mademoiselle)\s+/i, '')
    .trim();
}

function isUpperToken(token) {
  const lettersOnly = String(token || '').replace(/[^A-Za-zÀ-ÿ'’-]/g, '');
  return Boolean(lettersOnly) && lettersOnly === lettersOnly.toLocaleUpperCase('fr-FR');
}

function toTitleCase(value) {
  return String(value || '')
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s'-])([a-zà-ÿ])/giu, (match) => match.toLocaleUpperCase('fr-FR'))
    .trim();
}

function parseContactName(contact) {
  const clean = stripCivilityPrefix(contact);
  if (!clean) {
    return { firstName: '', lastName: '' };
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0].toLocaleUpperCase('fr-FR') };
  }

  if (isUpperToken(parts[0])) {
    if (parts.every((part) => isUpperToken(part))) {
      return {
        firstName: '',
        lastName: parts.join(' ').toLocaleUpperCase('fr-FR'),
      };
    }

    let splitIndex = 1;
    while (splitIndex < parts.length - 1 && isUpperToken(parts[splitIndex])) {
      splitIndex += 1;
    }

    return {
      firstName: toTitleCase(parts.slice(splitIndex).join(' ')),
      lastName: parts.slice(0, splitIndex).join(' ').toLocaleUpperCase('fr-FR'),
    };
  }

  if (isUpperToken(parts[parts.length - 1]) && !isUpperToken(parts[0])) {
    return {
      firstName: toTitleCase(parts.slice(0, -1).join(' ')),
      lastName: parts[parts.length - 1].toLocaleUpperCase('fr-FR'),
    };
  }

  // Le fichier source suit majoritairement la convention "NOM Prénom".
  return {
    firstName: toTitleCase(parts.slice(1).join(' ')),
    lastName: parts[0].toLocaleUpperCase('fr-FR'),
  };
}

function buildPersonNameCandidates(person) {
  const firstName = String(person?.name?.firstName || person?.firstName || '').trim();
  const lastName = String(person?.name?.lastName || person?.lastName || '').trim();
  const candidates = new Set();

  const direct = normalizeComparableName(`${firstName} ${lastName}`);
  const reversed = normalizeComparableName(`${lastName} ${firstName}`);

  if (direct) candidates.add(direct);
  if (reversed) candidates.add(reversed);
  return [...candidates];
}

module.exports = {
  buildPersonNameCandidates,
  normalizeComparableName,
  parseContactName,
  stripCivilityPrefix,
  toTitleCase,
};
