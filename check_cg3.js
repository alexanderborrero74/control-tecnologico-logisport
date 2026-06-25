const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Ver ciamsaGuardar completo desde linea 2947
for(let i=2946;i<2995;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));
