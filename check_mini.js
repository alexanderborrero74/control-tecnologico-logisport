const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// Buscar estados de mini cuadrilla
console.log('=== Estados mini cuadrilla ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('mini')&&lines[i].includes('useState')&&lines[i].includes('const'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}

// Buscar dónde se resetea el formulario de mini cuadrilla
console.log('\n=== Resets mini cuadrilla (setMiniForm) ===');
for(let i=0;i<lines.length;i++){
  if(lines[i]&&lines[i].includes('setMiniForm')&&(lines[i].includes('INIT')||lines[i].includes('{}')||lines[i].includes('[]')))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}

// Buscar guardar mini
const gIdx = lines.findIndex(l=>l.includes('guardarMini')||l.includes('miniGuardar'));
console.log('\n=== guardarMini linea:', gIdx+1);
for(let i=gIdx;i<gIdx+20;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,100));
