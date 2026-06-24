const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar serviciosMulti - estados y render
for(let i=0;i<lines.length;i++){
  if(lines[i] && lines[i].includes('serviciosMulti') && !lines[i].trim().startsWith('//'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
