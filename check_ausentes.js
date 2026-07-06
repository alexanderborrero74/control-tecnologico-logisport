const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar el panel CON NOVEDAD en el form SPIA
for(let i=0;i<lines.length;i++){
  if(lines[i]&&(lines[i].includes('CON NOVEDAD')||lines[i].includes('ausentesForm')&&lines[i].includes('map')))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
// Ver contexto del ausentesForm map
const idx = lines.findIndex(l=>l.includes('ausentesForm.map'));
console.log('\n=== ausentesForm.map ('+  (idx+1)+') ===');
for(let i=idx-3;i<idx+25;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
