const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar el modal detalle - tabla con filasFilt
for(let i=4460;i<4620;i++){
  if(lines[i] && (lines[i].includes('filasFilt') || lines[i].includes('f.fecha') || lines[i].includes('f.nombre') || lines[i].includes('Trabajador') || lines[i].includes('thead') || lines[i].includes('Fecha')))
    console.log((i+1)+': '+lines[i].trim().substring(0,130));
}
