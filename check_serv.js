const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// 1. Función cargarServicios
const idx = lines.findIndex(l=>l.includes('cargarServicios') && l.includes('const '));
console.log('=== cargarServicios linea:', idx+1);
for(let i=idx;i<idx+20;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// 2. Estado servicios + busqServicioCia
for(let i=0;i<lines.length;i++){
  if(lines[i]&&(lines[i].includes('busqServicioCia')||lines[i].includes('setServicios')||(lines[i].includes('servicios')&&lines[i].includes('useState'))))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
