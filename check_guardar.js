const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Buscar cuadrillaDiaGuardar
const idx = lines.findIndex(l=>l.includes('const cuadrillaDiaGuardar'));
console.log('cuadrillaDiaGuardar en linea:', idx+1);
for(let i=idx;i<idx+25;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,110));

// Buscar addDoc dentro de cuadrillaDiaGuardar
for(let i=idx;i<idx+60;i++){
  if(lines[i]?.includes('addDoc') || lines[i]?.includes('updateDoc'))
    console.log('>>> '+(i+1)+': '+lines[i]?.trim().substring(0,110));
}
