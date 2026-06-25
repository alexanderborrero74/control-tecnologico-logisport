const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Ver contexto completo del addDoc en cuadrillaDiaGuardar
console.log('=== addDoc en cuadrillaDiaGuardar (2420-2450) ===');
for(let i=2419;i<2455;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));

// Ver ciamsaIniciarEdicion
const ciamsaIdx = lines.findIndex(l=>l.includes('ciamsaIniciarEdicion') && l.includes('const'));
console.log('\n=== ciamsaIniciarEdicion linea:', ciamsaIdx+1);
for(let i=ciamsaIdx;i<ciamsaIdx+25;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));
