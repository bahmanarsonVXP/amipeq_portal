const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, 'SUIVIS CLIENTS 2026.xlsx'));
console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  console.log(`\n=== ${sheetName} === Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);

  // Print headers (row 1)
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell ? cell.v : '');
  }
  console.log('Headers:', headers.map((h, i) => `${String.fromCharCode(65 + i)}:${h}`).join(' | '));

  // Print first 3 data rows
  for (let r = 1; r <= Math.min(3, range.e.r); r++) {
    const row = {};
    for (let c = range.s.c; c <= Math.min(range.e.c, 23); c++) { // up to X
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const colLetter = String.fromCharCode(65 + c);
      if (cell) row[colLetter] = cell.v;
    }
    console.log(`Row ${r + 1}:`, JSON.stringify(row));
  }
}
