function parseExcelDate(dateStr, defaultYear) {
  if (!dateStr || String(dateStr).trim() === '') return null;

  if (typeof dateStr === 'number') {
    const excelEpoch = new Date(1900, 0, 1).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    const offset = dateStr > 59 ? 1 : 0;
    const date = new Date(excelEpoch + (dateStr - 1 - offset) * msPerDay);
    return date.toISOString();
  }

  return null;
}

console.log('Test: 44929 =>', parseExcelDate(44929, '2023'));
console.log('Test: 45000 =>', parseExcelDate(45000, '2023'));
console.log('Test: 40000 =>', parseExcelDate(40000, '2020'));
