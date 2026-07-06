const fs = require('fs');
const lines = fs.readFileSync('pages/nomina/matriz.js','utf8').split('\n');

// 1. Ver imports actuales de firebase
console.log('=== Imports firebase (lineas 1-35) ===');
for(let i=0;i<35;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));

// 2. Ver si onSnapshot está importado
const hasOnSnapshot = lines.some(l=>l.includes('onSnapshot'));
console.log('\nonSnapshot importado:', hasOnSnapshot);

// 3. Contexto cargarServicios para reemplazar
console.log('\n=== cargarServicios completa ===');
for(let i=2235;i<2248;i++) console.log((i+1)+': '+lines[i]?.trim().substring(0,120));
