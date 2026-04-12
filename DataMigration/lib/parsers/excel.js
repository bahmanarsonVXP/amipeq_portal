/**
 * Parse Excel date to ISO 8601 format
 * Supports Excel serial numbers and various date formats
 *
 * @param {number|string} dateStr - Excel date (serial number or string)
 * @param {string} defaultYear - Default year if not in date string
 * @returns {string|null} ISO 8601 date string or null if invalid
 */
function parseExcelDate(dateStr, defaultYear) {
  if (!dateStr || String(dateStr).trim() === '') return null;

  // If it's a number (serial number Excel)
  if (typeof dateStr === 'number') {
    // Formula: (excelDate - 25569) * 86400 * 1000
    // 25569 = days between 1900-01-01 (Excel) and 1970-01-01 (Unix epoch)
    // Correction for Excel bug (1900 not leap year)
    const offset = dateStr > 60 ? 1 : 0;
    const unixTimestamp = (dateStr - 25569 - offset) * 86400 * 1000;
    const date = new Date(unixTimestamp);
    return date.toISOString().split('T')[0] + 'T00:00:00Z';
  }

  const str = String(dateStr).trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.includes('T') ? str : `${str}T00:00:00Z`;
  }

  // Month abbreviations
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  // Format: "14-Jan-2023" or "14-Jan"
  const match = str.match(/^(\d+)-([A-Za-z]+)(?:-(\d{4}))?$/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = months[monthStr];
    if (month) {
      const finalYear = year || defaultYear;
      return `${finalYear}-${month}-${day.padStart(2, '0')}T00:00:00Z`;
    }
  }

  return null;
}

/**
 * Extract Excel cell background color
 * Returns VERT, GRIS, or BLANC based on RGB color
 *
 * @param {Object} cell - Excel cell object with style info
 * @returns {string} 'VERT', 'GRIS', or 'BLANC'
 */
function getCellColor(cell) {
  if (!cell || !cell.s || !cell.s.fgColor) return 'BLANC';

  const color = cell.s.fgColor;
  const rgb = color.rgb;

  if (!rgb) return 'BLANC';

  const colorUpper = rgb.toUpperCase();

  // Green variations (won/success)
  if (colorUpper.includes('00FF00') ||
      colorUpper.includes('00B050') ||
      colorUpper.includes('92D050')) {
    return 'VERT';
  }

  // Gray variations (lost)
  if (colorUpper.includes('D3D3D3') ||
      colorUpper.includes('BFBFBF') ||
      colorUpper.includes('A6A6A6')) {
    return 'GRIS';
  }

  return 'BLANC';
}

module.exports = {
  parseExcelDate,
  getCellColor
};
