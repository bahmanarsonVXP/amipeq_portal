function parseExcelDate(dateStr) {
  if (typeof dateStr === 'number') {
    const offset = dateStr > 60 ? 1 : 0;
    const unixTimestamp = (dateStr - 25569 - offset) * 86400 * 1000;
    const date = new Date(unixTimestamp);
    return date.toISOString().split('T')[0] + 'T00:00:00Z';
  }
  return null;
}

console.log('44929 =>', parseExcelDate(44929)); // Devrait être ~2022-12-31 ou 2023-01-01
console.log('45000 =>', parseExcelDate(45000));
console.log('40000 =>', parseExcelDate(40000));
