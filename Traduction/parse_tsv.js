const fs = require('fs');

const raw = fs.readFileSync('twenty_metadata_fr.tsv', 'utf-8');
const lines = raw.split('\n');
const header = lines[0].split('\t').map(c => c.trim());
console.log("Headers found:", header);
