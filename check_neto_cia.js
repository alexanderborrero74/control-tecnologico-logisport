const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Buscar donde se muestra el neto y la formula en cuadrillaDia form
console.log('=== Neto y formula cuadrillaDia ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&(lines[i].includes('nPersonas')||lines[i].includes('netoCalculado')&&lines[i].includes('f.')&&!lines[i].includes('//')))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}

// Ver cuadrillaDiaRecalcular completa
const rcIdx = lines.findIndex(l=>l.includes('const cuadrillaDiaRecalcular'));
console.log('\n=== cuadrillaDiaRecalcular ('+( rcIdx+1)+') ===');
for(let i=rcIdx;i<rcIdx+15;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
