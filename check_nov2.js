const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar el bloque de asistentes en tabla SPIA
for(let i=4460;i<4520;i++){
  if(lines[i] && (lines[i].includes('asisten.slice') || lines[i].includes('asisten.length') || lines[i].includes('Nov.') || lines[i].includes('EditNov')))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
