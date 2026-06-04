const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Ver estructura del modal detalle - headers y filas
for(let i=4416;i<4510;i++){
  if(lines[i]) console.log((i+1)+': '+lines[i].trim().substring(0,130));
}
