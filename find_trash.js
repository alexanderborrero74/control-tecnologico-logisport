const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar todos los botones eliminar en la tabla
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('eliminar(op)') || lines[i].includes('Trash2')){
    console.log((i+1)+': '+lines[i].trim().substring(0,100));
    // Mostrar contexto de 3 líneas arriba
    for(let j=Math.max(0,i-3);j<=i+3;j++) console.log('  '+(j+1)+': '+lines[j]?.trim().substring(0,90));
    console.log('---');
  }
}
