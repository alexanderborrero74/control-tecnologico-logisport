const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// 1. cuadrillaDiaGuardar - ver si tiene updateDoc
console.log('=== cuadrillaDiaGuardar (2314-2360) ===');
for(let i=2313;i<2365;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));

// 2. ciamsaEditId state
const editIdx = lines.findIndex(l=>l.includes('ciamsaEditId') && l.includes('useState'));
console.log('\n=== ciamsaEditId linea:', editIdx+1);
for(let i=editIdx-1;i<editIdx+4;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));

// 3. Selector de servicio en cuadrillaDia form
const servIdx = lines.findIndex(l=>l.includes('cuadrillaDiaSelServicio') && l.includes('select'));
console.log('\n=== Selector servicio ciamsa linea:', servIdx+1);
for(let i=servIdx-3;i<servIdx+10;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));
