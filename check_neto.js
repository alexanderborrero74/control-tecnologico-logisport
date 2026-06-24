const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
for(let i=0;i<lines.length;i++){
  if(lines[i] && (lines[i].includes('calcularNetoOperacion') || lines[i].includes('netoMostrar') || lines[i].includes('netoDisplay') || lines[i].includes('Neto a Pagar') || lines[i].includes('netoAPagar') && lines[i].includes('form.')))
    console.log((i+1)+': '+lines[i].trim().substring(0,130));
}
