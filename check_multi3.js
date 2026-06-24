const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=0;i<lines.length;i++){
  if(lines[i] && (lines[i].includes('sMultiAdd') || lines[i].includes('Agregar otro servicio') || lines[i].includes('serviciosMulti')))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
