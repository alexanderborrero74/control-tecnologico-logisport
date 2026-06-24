const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar definición de iniciarEdicion (fuera de componentes internos)
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('const iniciarEdicion') || lines[i].includes('function iniciarEdicion') || lines[i].includes('spiaIniciarEdicion'))
    console.log((i+1)+': '+lines[i].trim().substring(0,120));
}
// También mostrar contexto línea 4651
console.log('\n=== Líneas 4645-4660 ===');
for(let i=4644;i<4660;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
