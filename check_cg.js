const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// ciamsaGuardar
const idx = lines.findIndex(l=>l.includes('const ciamsaGuardar'));
console.log('ciamsaGuardar linea:', idx+1);
for(let i=idx;i<idx+40;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));
