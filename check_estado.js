const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
let results = [];
lines.forEach((l,i)=>{
  if(l && (l.includes('sMultiAdd') || l.includes('Agregar otro servicio') || l.includes('cuadrillaNombre &&') || l.includes('tipoSeleccion !==')))
    results.push((i+1)+': '+l.trim().substring(0,120));
});
results.forEach(r=>console.log(r));
