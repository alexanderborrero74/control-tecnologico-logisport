const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=0;i<lines.length;i++){
  if(lines[i] && lines[i].includes('fechaStr') && (lines[i].includes('td') || lines[i].includes('op.') || lines[i].includes('fecha')))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
