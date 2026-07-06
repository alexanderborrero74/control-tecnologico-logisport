const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Ver cierre del useEffect línea 2049
console.log('=== useEffect cierre (2060-2080) ===');
for(let i=2059;i<2080;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// Buscar selector de servicio en ciamsa form (individual CIAMSA)
// No en cuadrillaDia - buscar en la sección de ciamsaForm
console.log('\n=== Selectores de servicio en toda la página ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('<select')&&(lines[i].includes('servicioId')||lines[i].includes('Servicio')))
    console.log((i+1)+': '+lines[i].trim().substring(0,100));
}
