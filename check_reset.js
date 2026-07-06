const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Ver el reset después de guardar SPIA
const gIdx = lines.findIndex(l=>l.includes('const guardar = async'));
console.log('guardar en linea:', gIdx+1);
// Ver desde donde setGuardadoOk hasta el fin del try
for(let i=gIdx+80;i<gIdx+130;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
