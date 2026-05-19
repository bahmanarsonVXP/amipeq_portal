/**
 * Normalise un numéro de téléphone lu depuis Excel.
 *
 * Problème : Excel stocke les téléphones comme nombres (0612345678 → 612345678).
 * Avec raw:true, xlsx retourne un Number, et String() supprime le zéro de tête.
 *
 * Cette fonction restaure le zéro de tête et nettoie le format.
 *
 * @param {*} raw - Valeur brute depuis la cellule Excel (nombre ou chaîne)
 * @returns {string|null} Numéro normalisé (ex: "0612345678") ou null si invalide
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  // Convertir en string, supprimer espaces, tirets, points, parenthèses
  let s = String(raw).trim().replace(/[\s.\-()]/g, '');

  // Valeurs parasites fréquentes dans l'Excel
  if (!s || s === 'M' || s === 'M.' || s.toLowerCase() === 'mr') return null;

  // Format international +33 → 0
  if (s.startsWith('+33')) {
    s = '0' + s.slice(3);
  }
  // Format 0033 → 0
  else if (s.startsWith('0033')) {
    s = '0' + s.slice(4);
  }

  // Vérifier que c'est bien uniquement des chiffres désormais
  if (!/^\d+$/.test(s)) return null;

  // 9 chiffres commençant par 1-9 → zéro de tête mangé par Excel
  if (s.length === 9 && s[0] !== '0') {
    s = '0' + s;
  }

  // Valider la longueur finale (au moins 6 chiffres pour un numéro cohérent)
  if (s.length < 6) return null;

  return s;
}

module.exports = { normalizePhone };
