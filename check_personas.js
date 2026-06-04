const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar todas las lineas con personas en el guardar de SPIA
for(let i=2545;i<2600;i++){
  if(lines[i] && (lines[i].includes('personas') || lines[i].includes('trabsAdicionales')))
    console.log(i+1+': '+lines[i]);
}
