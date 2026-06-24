const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
// Buscar definición de iniciarEdicion en el componente principal
let found = [];
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('const iniciarEdicion') || lines[i].includes('function iniciarEdicion') || lines[i].includes('iniciarEdicion = '))
    found.push((i+1)+': '+lines[i].trim().substring(0,120));
}
console.log('=== Definiciones iniciarEdicion ===');
found.forEach(f=>console.log(f));

// Ver contexto tabla SPIA líneas 4640-4660
console.log('\n=== Tabla SPIA acciones (4645-4660) ===');
for(let i=4644;i<4660;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
