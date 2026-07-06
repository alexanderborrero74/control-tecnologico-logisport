const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');
console.log('Linea 2748 completa:');
console.log(lines[2747]);
console.log('\nLineas 2747-2752:');
for(let i=2746;i<2752;i++) console.log((i+1)+': '+lines[i]);
