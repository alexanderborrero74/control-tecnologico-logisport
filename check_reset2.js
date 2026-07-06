const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar el guardar de SPIA que tiene cuadrillaNombre y servicioNombre
let found = [];
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('const guardar = async')&&lines[i+2]?.includes('cuadrillaNombre'))
    found.push(i);
}
// También buscar por el patrón de validación de SPIA
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('cuadrillaNombre || !form.servicioNombre'))
    found.push(i-1); // línea anterior tiene const guardar
}
const idx = [...new Set(found)].sort((a,b)=>a-b)[0];
console.log('guardar SPIA en linea:', idx+1);
// Ver el reset post-guardar
for(let i=idx+60;i<idx+110;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
