/**
 * Parse "Norme" field to extract prestations
 *
 * Supported prestation values (TWENTY MULTI_SELECT enum):
 *   DU, MAJ_DU, MAJ_DU_DEMAT, DUERP, MAJ_DUERP, MAJ_DU_DISTANCE,
 *   DU_SITE_DISTANCE, PPMS, MAJ_PPMS, DU_DISTANCE,
 *   RPS, RPS_ENTRETIENS, RPS_ET_ENTRETIENS
 *
 * Multiple values separated by " + " in Excel are supported.
 * Example: "DU + PPMS" → ['DU', 'PPMS']
 */

/**
 * Remove accents and normalize a string for matching
 * @param {string} s
 * @returns {string} uppercase, no accents, collapsed spaces
 */
function normalize(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')   // remove punctuation
    .replace(/\s+/g, ' ')            // collapse spaces
    .trim();
}

/**
 * Match a single normalized part to a TWENTY prestation enum value.
 * Order matters: most specific patterns must come before broader ones.
 *
 * @param {string} part - Already normalized (uppercase, no accents)
 * @returns {string|null} TWENTY enum value or null if unrecognized
 */
function matchPart(part) {
  // --- DU family (check MAJ DUERP before MAJ DU, more specific before less) ---
  if (part.includes('MAJ DUERP'))                                           return 'MAJ_DUERP';
  if (part.includes('MAJ DU') && (part.includes('DEMAT') || part.includes('DEMATER'))) return 'MAJ_DU_DEMAT';
  if (part.includes('MAJ DU') && part.includes('DISTANCE'))                return 'MAJ_DU_DISTANCE';
  if (part.includes('MAJ DU'))                                              return 'MAJ_DU';
  if (part.includes('DUERP') || part.includes('DUER'))                     return 'DUERP';
  if (part.includes('DU') && part.includes('SITE'))                        return 'DU_SITE_DISTANCE';
  if (part.includes('DU') && part.includes('DISTANCE'))                    return 'DU_DISTANCE';
  if (part === 'DU')                                                        return 'DU';

  // --- PPMS family ---
  if (part.includes('MAJ PPMS'))  return 'MAJ_PPMS';
  if (part.includes('PPMS'))      return 'PPMS';

  // --- RPS family (check avec/et before bare RPS) ---
  if (part.includes('RPS') && part.includes('AVEC') && part.includes('ENTRETIEN')) return 'RPS_ENTRETIENS';
  if (part.includes('RPS') && part.includes('ENTRETIEN'))                           return 'RPS_ET_ENTRETIENS';
  if (part.includes('RPS'))                                                          return 'RPS';

  return null;
}

/**
 * Parse the raw NORME string from Excel.
 * Splits on " + " and maps each part to a TWENTY prestation enum value.
 *
 * @param {string|null} norme - Raw value from Excel column L
 * @returns {string[]} Array of TWENTY prestation enum values (deduplicated)
 */
function parseNorme(norme) {
  if (!norme || String(norme).trim() === '') return ['DUERP'];

  const parts = String(norme)
    .split('+')
    .map(p => normalize(p))
    .filter(p => p.length > 0);

  const prestations = [];
  for (const part of parts) {
    const match = matchPart(part);
    if (match && !prestations.includes(match)) {
      prestations.push(match);
    }
  }

  return prestations.length > 0 ? prestations : ['DUERP'];
}

/**
 * Full TWENTY MULTI_SELECT options for the "prestation" field.
 * Use this to update the schema via the metadata API.
 */
const PRESTATION_OPTIONS = [
  { value: 'DU',                label: 'DU',                        color: 'blue',      position: 0 },
  { value: 'MAJ_DU',            label: 'MAJ DU',                    color: 'sky',       position: 1 },
  { value: 'MAJ_DU_DEMAT',      label: 'MAJ DU Démat.',             color: 'sky',       position: 2 },
  { value: 'DUERP',             label: 'DUERP',                     color: 'blue',      position: 3 },
  { value: 'MAJ_DUERP',         label: 'MAJ DUERP',                 color: 'sky',       position: 4 },
  { value: 'MAJ_DU_DISTANCE',   label: 'MAJ DU à Distance',         color: 'purple',    position: 5 },
  { value: 'DU_SITE_DISTANCE',  label: 'DU Sur SITE ou à DISTANCE', color: 'purple',    position: 6 },
  { value: 'PPMS',              label: 'PPMS',                      color: 'green',     position: 7 },
  { value: 'MAJ_PPMS',          label: 'MAJ PPMS',                  color: 'turquoise', position: 8 },
  { value: 'DU_DISTANCE',       label: 'DU à Distance',             color: 'purple',    position: 9 },
  { value: 'RPS',               label: 'RPS',                       color: 'orange',    position: 10 },
  { value: 'RPS_ENTRETIENS',    label: 'RPS avec Entretiens',       color: 'yellow',    position: 11 },
  { value: 'RPS_ET_ENTRETIENS', label: 'RPS et/ou Entretiens',      color: 'yellow',    position: 12 },
];

module.exports = {
  parseNorme,
  PRESTATION_OPTIONS,
};
